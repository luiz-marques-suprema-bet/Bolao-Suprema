-- Bolao Suprema · Mata-mata: distinguir PÊNALTIS de PRORROGAÇÃO. O bônus de +2 do
-- classificado SÓ vale quando o jogo foi decidido nos PÊNALTIS. Prorrogação (gol no
-- tempo extra) e tempo normal NÃO geram +2 — vale só o placar dos 90 min.
--
-- Decisão do grupo (2026-07-01): "+2 é só se CASO for pra pênaltis". Até agora o
-- único jogo decidido na prorrogação foi BEL×SEN (empate 2×2 nos 90 min, BEL na
-- prorrogação). GER×PAR e NED×MAR foram nos pênaltis.
--
-- Truque: a função calculate_prediction_points_v2 NÃO muda. Os chamadores passam o
-- "classificado real" (p_real_advancer) SÓ quando decided_by = 'penalties'; nos demais
-- casos passam null → adv_ok = false → sem +2. Simples e sem mexer na escada.

-- ── 1) Coluna decided_by ──
alter table public.matches add column if not exists decided_by text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'matches_decided_by_check') then
    alter table public.matches add constraint matches_decided_by_check
      check (decided_by is null or decided_by in ('regulation','extra_time','penalties'));
  end if;
end $$;

-- ── 2) Backfill dos jogos já encerrados ──
-- Empates decididos nos pênaltis (mantêm o +2):
update public.matches set decided_by = 'penalties'
  where match_code in ('ko-r32-2','ko-r32-3');
-- BEL×SEN: empate 2×2 no tempo normal, BEL passou na PRORROGAÇÃO. O 3×2 gravado era o
-- placar final (com prorrogação) — corrige pro placar dos 90 min (2×2) e marca prorrogação.
update public.matches set home_score = 2, away_score = 2, decided_by = 'extra_time'
  where match_code = 'ko-r32-10';

-- ── 3) admin_update_match_status: aceita e grava decided_by (DROP+CREATE p/ trocar a
--       assinatura sem virar overload). ──
drop function if exists public.admin_update_match_status(text, text, integer, integer, text, text, text);
create function public.admin_update_match_status(
  p_match_code text, p_status text,
  p_home_score integer default null, p_away_score integer default null,
  p_live_minute text default null, p_winner text default null,
  p_lock_reason text default null, p_decided_by text default null)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_before jsonb;
  v_market text;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Acesso negado.';
  end if;
  if p_status not in ('open', 'scheduled', 'locked', 'live', 'finished') then
    raise exception 'Status de partida inválido: %', p_status;
  end if;
  if p_decided_by is not null and p_decided_by not in ('regulation','extra_time','penalties') then
    raise exception 'decided_by inválido: %', p_decided_by;
  end if;

  select to_jsonb(m) into v_before from public.matches m where m.match_code = p_match_code;
  if not found then
    raise exception 'Partida não encontrada: %', p_match_code;
  end if;

  v_market := case p_status
    when 'locked'   then 'locked'
    when 'finished' then 'settled'
    when 'live'     then 'closed'
    else                 'open'
  end;

  update public.matches set
    status        = p_status,
    market_status = v_market,
    locked_at     = case when p_status = 'locked' then now() when p_status = 'open' then null else locked_at end,
    locked_by     = case when p_status = 'locked' then auth.uid() when p_status = 'open' then null else locked_by end,
    lock_reason   = case when p_status = 'locked' then coalesce(p_lock_reason, 'admin_lock') when p_status = 'open' then null else lock_reason end,
    unlocked_at   = case when p_status = 'open' then now() else unlocked_at end,
    settled_at    = case when p_status = 'finished' then now() when p_status = 'open' then null else settled_at end,
    home_score    = coalesce(p_home_score,  home_score),
    away_score    = coalesce(p_away_score,  away_score),
    live_minute   = coalesce(p_live_minute, live_minute),
    winner        = coalesce(p_winner,      winner),
    decided_by    = coalesce(p_decided_by,  decided_by)
  where match_code = p_match_code;

  perform public.log_audit('match_status_updated', 'match', p_match_code, v_before,
    jsonb_build_object('status', p_status, 'market_status', v_market,
      'home_score', p_home_score, 'away_score', p_away_score,
      'winner', p_winner, 'decided_by', p_decided_by));
end;
$function$;
revoke all on function public.admin_update_match_status(text, text, integer, integer, text, text, text, text) from public, anon;
grant execute on function public.admin_update_match_status(text, text, integer, integer, text, text, text, text) to authenticated;

-- ── 4) Trigger de auto-pontuação: classificado real só nos pênaltis; e re-dispara
--       quando decided_by muda (correção de prorrogação↔pênaltis pelo admin). ──
create or replace function public.auto_score_match_predictions()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_slot_id text;
begin
  if new.status = 'finished'
     and new.home_score is not null and new.away_score is not null
     and (
       old.status is distinct from 'finished'
       or old.home_score is distinct from new.home_score
       or old.away_score is distinct from new.away_score
       or old.winner is distinct from new.winner
       or old.decided_by is distinct from new.decided_by
     )
  then
    v_slot_id := public.match_slot_id(new.match_code);

    update public.predictions p
    set points_earned = public.calculate_prediction_points_v2(
      p.home_score, p.away_score, new.home_score, new.away_score, new.stage,
      case when new.stage = 'group' then null
        else coalesce(
          (select bp.picked_winner from public.bracket_picks bp
             where bp.user_id = p.user_id and bp.slot_id = v_slot_id limit 1),
          case when p.home_score > p.away_score then new.home_code
               when p.home_score < p.away_score then new.away_code else null end)
      end,
      -- Classificado REAL só entra quando foi decidido nos PÊNALTIS (senão sem +2).
      case when new.stage <> 'group' and new.decided_by = 'penalties' then new.winner else null end
    )
    where p.match_code = new.match_code;

    if v_slot_id is not null and new.stage <> 'group' and new.winner is not null and new.winner <> 'draw' then
      update public.bracket_picks bp set is_correct = (upper(bp.picked_winner) = upper(new.winner))
      where bp.slot_id = v_slot_id;
    end if;

    insert into public.system_events (level, area, message, details)
    values ('info', 'auto_scoring', 'Pontos calculados para ' || new.match_code,
      jsonb_build_object('match_code', new.match_code, 'home_score', new.home_score,
        'away_score', new.away_score, 'stage', new.stage, 'winner', new.winner,
        'decided_by', new.decided_by, 'slot_id', v_slot_id, 'triggered_by', 'trg_auto_score_predictions'));

    begin
      perform public.refresh_ranking_snapshots();
    exception when others then
      insert into public.system_events (level, area, message, details)
      values ('warn', 'auto_scoring', 'refresh_ranking_snapshots falhou apos ' || new.match_code || ': ' || sqlerrm,
        jsonb_build_object('match_code', new.match_code));
    end;
  end if;
  return new;
end;
$function$;

-- ── 5) admin_update_prediction: mesmo critério (classificado real só nos pênaltis). ──
create or replace function public.admin_update_prediction(p_prediction_id uuid, p_home_score integer, p_away_score integer)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_pred public.predictions;
  v_match public.matches;
  v_adv text;
  v_pts integer;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Acesso negado.';
  end if;
  if p_home_score is null or p_away_score is null
     or p_home_score < 0 or p_away_score < 0 or p_home_score > 30 or p_away_score > 30 then
    raise exception 'Placar inválido.';
  end if;

  select * into v_pred from public.predictions where id = p_prediction_id;
  if not found then raise exception 'Palpite não encontrado: %', p_prediction_id; end if;

  select * into v_match from public.matches where match_code = v_pred.match_code;

  update public.predictions set home_score = p_home_score, away_score = p_away_score
  where id = p_prediction_id;

  if v_match.status = 'finished' and v_match.home_score is not null and v_match.away_score is not null then
    v_adv := coalesce(
      (select bp.picked_winner from public.bracket_picks bp
         where bp.user_id = v_pred.user_id and bp.slot_id = public.match_slot_id(v_pred.match_code) limit 1),
      case when p_home_score > p_away_score then v_match.home_code
           when p_home_score < p_away_score then v_match.away_code else null end);
    v_pts := public.calculate_prediction_points_v2(
      p_home_score, p_away_score, v_match.home_score, v_match.away_score, v_match.stage,
      v_adv,
      case when v_match.decided_by = 'penalties' then v_match.winner else null end);
    update public.predictions set points_earned = v_pts where id = p_prediction_id;
    perform public.refresh_ranking_snapshots();
  end if;

  perform public.log_audit('prediction_updated', 'prediction', p_prediction_id::text,
    to_jsonb(v_pred), jsonb_build_object('home_score', p_home_score, 'away_score', p_away_score));
end;
$function$;

-- ── 6) Reapura TODOS os palpites de mata-mata já encerrados com o novo critério. ──
update public.predictions p
set points_earned = public.calculate_prediction_points_v2(
  p.home_score, p.away_score, m.home_score, m.away_score, m.stage,
  coalesce(
    (select bp.picked_winner from public.bracket_picks bp
       where bp.user_id = p.user_id and bp.slot_id = public.match_slot_id(m.match_code) limit 1),
    case when p.home_score > p.away_score then m.home_code
         when p.home_score < p.away_score then m.away_code else null end),
  case when m.decided_by = 'penalties' then m.winner else null end
)
from public.matches m
where m.match_code = p.match_code
  and m.status = 'finished' and m.stage <> 'group'
  and m.home_score is not null and m.away_score is not null;

select public.refresh_ranking_snapshots();
