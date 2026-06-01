-- ============================================================================
-- Bolao Suprema · Corrige ensure_prediction_market_open p/ re-apuracao idempotente
-- ----------------------------------------------------------------------------
-- A versao anterior so permitia UPDATE em predictions de mercado fechado quando
-- points_earned MUDAVA. Resultado: re-apuracao idempotente (admin re-settle, ou
-- o cron football-data-sync re-sincronizando um jogo ja 'finished') tentava
-- gravar o MESMO points_earned -> a condicao falhava -> a trava disparava
-- "Mercado fechado" e abortava o UPDATE do matches inteiro.
--
-- Correcao: permite QUALQUER update que NAO altere o palpite (match_code,
-- home_score, away_score), independente de points_earned. A trava de aposta
-- (mudar o palpite apos o fechamento) continua 100% enforced.
-- ============================================================================
create or replace function public.ensure_prediction_market_open()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  match_row public.matches%rowtype;
begin
  -- Permite updates internos (pontuacao, locked_at, etc.) — desde que o PALPITE
  -- nao mude. Apenas mudancas de palpite passam pela checagem de mercado.
  if tg_op = 'UPDATE'
    and new.match_code is not distinct from old.match_code
    and new.home_score is not distinct from old.home_score
    and new.away_score is not distinct from old.away_score
  then
    return new;
  end if;

  select * into match_row from public.matches where match_code = new.match_code;
  if not found then
    raise exception 'Partida nao encontrada: %', new.match_code;
  end if;

  if coalesce(match_row.home_code, 'TBD') = 'TBD'
     or coalesce(match_row.away_code, 'TBD') = 'TBD'
  then
    raise exception 'Jogo aguardando classificados. Palpite de placar ainda indisponivel.';
  end if;

  if coalesce(match_row.market_status, 'open') <> 'open'
    or match_row.status in ('locked', 'live', 'finished')
    or (match_row.kickoff_utc is not null and match_row.kickoff_utc <= now())
  then
    raise exception 'Mercado fechado. Palpite nao pode ser criado ou alterado.';
  end if;

  return new;
end;
$function$;
