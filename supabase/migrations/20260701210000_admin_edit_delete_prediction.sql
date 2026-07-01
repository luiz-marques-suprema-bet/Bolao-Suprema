-- Bolao Suprema · Admin pode EDITAR e APAGAR o palpite de um participante (correção
-- pela tela de Pessoas). Ambos são RPC security definer com checagem is_admin (que já
-- cobre user_role admin/owner) e atualizam o ranking quando o jogo já foi apurado.

-- ── 1) Editar o placar de um palpite (novo) ──
-- Se o jogo já terminou, re-pontua com a MESMA lógica do trigger (classificado
-- efetivo = pick explícito do chaveamento OU vencedor do placar decisivo) e atualiza
-- o ranking. Não mexe em submitted_at (preserva o desempate de "primeiro palpite").
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
     or p_home_score < 0 or p_away_score < 0
     or p_home_score > 30 or p_away_score > 30 then
    raise exception 'Placar inválido.';
  end if;

  select * into v_pred from public.predictions where id = p_prediction_id;
  if not found then
    raise exception 'Palpite não encontrado: %', p_prediction_id;
  end if;

  select * into v_match from public.matches where match_code = v_pred.match_code;

  update public.predictions
  set home_score = p_home_score, away_score = p_away_score
  where id = p_prediction_id;

  -- Jogo já apurado → re-pontua este palpite e atualiza o ranking.
  if v_match.status = 'finished'
     and v_match.home_score is not null and v_match.away_score is not null then
    v_adv := coalesce(
      (select bp.picked_winner from public.bracket_picks bp
         where bp.user_id = v_pred.user_id
           and bp.slot_id = public.match_slot_id(v_pred.match_code) limit 1),
      case
        when p_home_score > p_away_score then v_match.home_code
        when p_home_score < p_away_score then v_match.away_code
        else null
      end
    );
    v_pts := public.calculate_prediction_points_v2(
      p_home_score, p_away_score, v_match.home_score, v_match.away_score,
      v_match.stage, v_adv, v_match.winner);
    update public.predictions set points_earned = v_pts where id = p_prediction_id;
    perform public.refresh_ranking_snapshots();
  end if;

  perform public.log_audit(
    'prediction_updated', 'prediction', p_prediction_id::text,
    to_jsonb(v_pred),
    jsonb_build_object('home_score', p_home_score, 'away_score', p_away_score));
end;
$function$;

revoke all on function public.admin_update_prediction(uuid, integer, integer) from public, anon;
grant execute on function public.admin_update_prediction(uuid, integer, integer) to authenticated;

-- ── 2) Apagar palpite (ajuste): agora atualiza o ranking quando o palpite já
--       tinha pontos apurados (senão os pontos ficavam no snapshot). ──
create or replace function public.admin_delete_prediction(p_prediction_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_pred public.predictions;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Acesso negado.';
  end if;

  select * into v_pred from public.predictions where id = p_prediction_id;
  if not found then
    raise exception 'Palpite não encontrado: %', p_prediction_id;
  end if;

  delete from public.predictions where id = p_prediction_id;

  perform public.log_audit(
    'prediction_deleted', 'prediction', p_prediction_id::text,
    to_jsonb(v_pred), null);

  if v_pred.points_earned is not null then
    perform public.refresh_ranking_snapshots();
  end if;
end;
$function$;
