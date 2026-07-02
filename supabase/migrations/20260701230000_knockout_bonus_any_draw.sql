-- Bolao Suprema · Mata-mata: o +2 do classificado volta a valer em QUALQUER empate
-- (prorrogação OU pênaltis), não só nos pênaltis. Decisão do grupo: "classificação na
-- prorrogação e pênaltis é a mesma coisa". Reverte a 20260701220000 (que restringia o
-- +2 a decided_by='penalties').
--
-- A função calculate_prediction_points_v2 (ESCADA) NÃO muda — ela já dá o +2 quando
-- r_home=r_away (empate no tempo regulamentar) e adv_ok. Basta os chamadores voltarem
-- a passar o classificado real (winner) para TODO jogo de mata-mata (não só pênaltis).
-- A coluna decided_by continua existindo só para a EXIBIÇÃO (prorrogação vs pênaltis).

-- ── 1) Trigger de auto-pontuação: classificado real = winner em todo KO ──
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
      -- Classificado REAL para TODO mata-mata (o +2 sai em qualquer empate; a função
      -- só o aplica quando o placar do tempo regulamentar foi empate).
      case when new.stage <> 'group' then new.winner else null end
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

-- ── 2) admin_update_prediction: mesmo — winner para todo KO ──
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
      case when v_match.stage <> 'group' then v_match.winner else null end);
    update public.predictions set points_earned = v_pts where id = p_prediction_id;
    perform public.refresh_ranking_snapshots();
  end if;

  perform public.log_audit('prediction_updated', 'prediction', p_prediction_id::text,
    to_jsonb(v_pred), jsonb_build_object('home_score', p_home_score, 'away_score', p_away_score));
end;
$function$;

-- ── 3) Reapura TODOS os palpites de mata-mata já encerrados (winner p/ todo KO). ──
update public.predictions p
set points_earned = public.calculate_prediction_points_v2(
  p.home_score, p.away_score, m.home_score, m.away_score, m.stage,
  coalesce(
    (select bp.picked_winner from public.bracket_picks bp
       where bp.user_id = p.user_id and bp.slot_id = public.match_slot_id(m.match_code) limit 1),
    case when p.home_score > p.away_score then m.home_code
         when p.home_score < p.away_score then m.away_code else null end),
  case when m.stage <> 'group' then m.winner else null end
)
from public.matches m
where m.match_code = p.match_code
  and m.status = 'finished' and m.stage <> 'group'
  and m.home_score is not null and m.away_score is not null;

select public.refresh_ranking_snapshots();
