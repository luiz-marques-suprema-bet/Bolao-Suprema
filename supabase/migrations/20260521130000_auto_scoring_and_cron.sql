-- ============================================================================
-- Bolao Suprema · Auto-scoring trigger + pg_cron schedule
-- ============================================================================
-- Problema resolvido:
--   A Edge Function football-data-sync ja atualiza matches.status='finished'
--   com o placar correto, mas ninguem chamava calculate_prediction_points()
--   nem refresh_ranking_snapshots() depois.
--
-- Solucao:
--   1. Trigger AFTER UPDATE ON matches: calcula pontos automaticamente sempre
--      que um jogo termina — vale para Edge Function E para admin manual.
--   2. pg_cron: chama a Edge Function a cada 5 minutos.
--
-- ANTES DE APLICAR:
--   Execute no SQL Editor do Supabase (substitua os valores reais):
--
--     ALTER DATABASE postgres
--       SET app.football_sync_url =
--         'https://<project-ref>.supabase.co/functions/v1/football-data-sync?season=2026';
--
--     ALTER DATABASE postgres
--       SET app.supabase_anon_key = '<sua-anon-key>';
--
--   A anon key e publica (esta no .env do frontend). Ela autoriza a chamada
--   HTTP para a Edge Function, que por sua vez usa a service_role_key
--   internamente para acessar o banco.
-- ============================================================================

-- ─── Extensoes necessarias ───────────────────────────────────────────────────
-- pg_net e pg_cron ja vem habilitadas na maioria dos projetos Supabase.
-- O IF NOT EXISTS garante idempotencia caso ainda nao estejam.

create extension if not exists pg_net;
create extension if not exists pg_cron;

-- ─── 1. Funcao do trigger: calcula pontos quando jogo termina ────────────────

create or replace function public.auto_score_match_predictions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Dispara somente quando a partida transiciona para 'finished' com placar valido,
  -- ou quando o placar de uma partida ja finalizada e corrigido.
  if new.status = 'finished'
     and new.home_score is not null
     and new.away_score is not null
     and (
       old.status is distinct from 'finished'
       or old.home_score is distinct from new.home_score
       or old.away_score is distinct from new.away_score
     )
  then
    -- Calcula points_earned para todos os palpites desta partida
    update public.predictions p
    set points_earned = public.calculate_prediction_points(
      p.home_score,
      p.away_score,
      new.home_score,
      new.away_score,
      new.stage
    )
    where p.match_code = new.match_code;

    -- Registra o evento no log do sistema
    insert into public.system_events (level, area, message, details)
    values (
      'info',
      'auto_scoring',
      'Pontos calculados para ' || new.match_code,
      jsonb_build_object(
        'match_code',  new.match_code,
        'home_score',  new.home_score,
        'away_score',  new.away_score,
        'stage',       new.stage,
        'triggered_by', 'trg_auto_score_predictions'
      )
    );

    -- Atualiza ranking_breakdowns e ranking_snapshots
    -- Envolto em bloco de excecao para que uma falha aqui nao bloqueie
    -- a atualizacao do match (o campo points_earned ja foi gravado acima).
    begin
      perform public.refresh_ranking_snapshots();
    exception when others then
      insert into public.system_events (level, area, message, details)
      values (
        'warn',
        'auto_scoring',
        'refresh_ranking_snapshots falhou apos ' || new.match_code || ': ' || sqlerrm,
        jsonb_build_object('match_code', new.match_code)
      );
    end;
  end if;

  return new;
end;
$$;

-- ─── 2. Trigger na tabela matches ────────────────────────────────────────────

drop trigger if exists trg_auto_score_predictions on public.matches;

create trigger trg_auto_score_predictions
  after update on public.matches
  for each row
  execute function public.auto_score_match_predictions();

-- ─── 3. Atualiza settle_match_result para evitar calculo duplicado ───────────
-- O trigger acima ja cobre o calculo de pontos. settle_match_result continua
-- existindo para uso pelo painel Admin, mas nao precisa mais chamar
-- calculate_prediction_points nem refresh_ranking_snapshots manualmente.

create or replace function public.settle_match_result(
  p_match_code text,
  p_home_score integer,
  p_away_score integer
)
returns public.matches
language plpgsql
security definer
set search_path = public
as $$
declare
  before_row public.matches%rowtype;
  after_row  public.matches%rowtype;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Apenas admin pode apurar resultado.';
  end if;

  select * into before_row
  from public.matches
  where match_code = p_match_code;

  if not found then
    raise exception 'Partida nao encontrada.';
  end if;

  -- Esta atualizacao aciona trg_auto_score_predictions automaticamente.
  update public.matches
  set home_score    = p_home_score,
      away_score    = p_away_score,
      status        = 'finished',
      market_status = 'settled',
      settled_at    = now(),
      winner        = case
                        when p_home_score > p_away_score then home_code
                        when p_home_score < p_away_score then away_code
                        else 'draw'
                      end
  where match_code = p_match_code
  returning * into after_row;

  perform public.log_audit(
    'match_settled', 'match', p_match_code,
    to_jsonb(before_row), to_jsonb(after_row)
  );

  return after_row;
end;
$$;

-- ─── 4. pg_cron: sincroniza com football-data.org a cada 5 minutos ───────────
-- Remove agendamento anterior se existir

select cron.unschedule('football-data-sync')
where exists (
  select 1 from cron.job where jobname = 'football-data-sync'
);

-- Agenda nova execucao a cada 5 minutos.
-- current_setting('app.football_sync_url') e current_setting('app.supabase_anon_key')
-- devem ter sido configurados com ALTER DATABASE antes de aplicar esta migration.
-- Se nao estiverem configurados, o cron falha silenciosamente (nao trava o banco).

select cron.schedule(
  'football-data-sync',
  '*/5 * * * *',
  $$
  select net.http_post(
    url     := current_setting('app.football_sync_url', true),
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'Authorization', 'Bearer ' || current_setting('app.supabase_anon_key', true)
               ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 30000
  )
  where current_setting('app.football_sync_url', true) is not null
    and current_setting('app.supabase_anon_key', true) is not null
  $$
);
