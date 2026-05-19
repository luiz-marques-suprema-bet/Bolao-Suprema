-- ============================================================================
-- Bolão Suprema · Hardening: RPCs auditáveis para operações de palpite
-- ============================================================================
-- Contexto:
--   O painel admin apurava pontos client-side (loop de updates individuais)
--   e removia palpites com DELETE direto — sem auditoria e susceptível a
--   manipulação de payload no navegador.
--
-- Funções criadas:
--   - calculate_match_points     → helper de pontuação (replicado do frontend)
--   - admin_settle_match_result  → apura partida + pontua palpites server-side
--   - admin_delete_prediction    → remove palpite com log de auditoria
-- ============================================================================

-- ── calculate_match_points (helper interno) ───────────────────────────────────

create or replace function public.calculate_match_points(
  p_pred_home   integer,
  p_pred_away   integer,
  p_result_home integer,
  p_result_away integer,
  p_stage       text     -- 'group' | 'knockout'
)
returns integer
language plpgsql
set search_path = public
as $$
declare
  v_exact           boolean;
  v_correct_outcome boolean;
  v_one_team        boolean;
  v_pred_out        text;
  v_result_out      text;
begin
  v_exact      := (p_pred_home = p_result_home and p_pred_away = p_result_away);

  v_pred_out   := case
    when p_pred_home   > p_pred_away   then 'home'
    when p_pred_away   > p_pred_home   then 'away'
    else 'draw'
  end;
  v_result_out := case
    when p_result_home > p_result_away then 'home'
    when p_result_away > p_result_home then 'away'
    else 'draw'
  end;

  v_correct_outcome := (v_pred_out = v_result_out);
  v_one_team        := (p_pred_home = p_result_home or p_pred_away = p_result_away);

  if p_stage = 'group' then
    if v_exact                          then return 10; end if;
    if v_correct_outcome and v_one_team then return 7;  end if;
    if v_correct_outcome                then return 5;  end if;
    if v_one_team                       then return 1;  end if;
    return 0;
  else
    -- Fase eliminatória
    if v_exact                          then return 12; end if;
    if v_correct_outcome and v_one_team then return 8;  end if;
    if v_correct_outcome                then return 5;  end if;
    return 0;
  end if;
end;
$$;

-- Internal helper — callers go through admin_settle_match_result
revoke execute on function public.calculate_match_points(integer, integer, integer, integer, text)
  from public, anon, authenticated;

-- ── admin_settle_match_result ─────────────────────────────────────────────────

create or replace function public.admin_settle_match_result(
  p_match_code  text,
  p_home_score  integer,
  p_away_score  integer,
  p_stage       text,    -- 'group' | 'knockout'
  p_winner      text     default null
)
returns integer          -- número de palpites pontuados
language plpgsql
security definer
set search_path = public
as $$
declare
  v_scored integer := 0;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Acesso negado.';
  end if;

  -- Marcar partida como finalizada
  update public.matches set
    status        = 'finished',
    market_status = 'settled',
    settled_at    = now(),
    home_score    = p_home_score,
    away_score    = p_away_score,
    winner        = p_winner
  where match_code = p_match_code;

  if not found then
    raise exception 'Partida não encontrada: %', p_match_code;
  end if;

  -- Pontuar todos os palpites desta partida server-side
  -- A trigger trg_predictions_market_open tem exemption para updates
  -- onde apenas points_earned muda → esta atualização passa sem bloqueio.
  update public.predictions set
    points_earned = public.calculate_match_points(
      home_score, away_score,
      p_home_score, p_away_score,
      p_stage
    )
  where match_code = p_match_code;

  get diagnostics v_scored = row_count;

  perform public.log_audit(
    'match_settled',
    'match',
    p_match_code,
    null,
    jsonb_build_object(
      'home_score',          p_home_score,
      'away_score',          p_away_score,
      'stage',               p_stage,
      'winner',              p_winner,
      'predictions_scored',  v_scored
    )
  );

  return v_scored;
end;
$$;

-- ── admin_delete_prediction ───────────────────────────────────────────────────

create or replace function public.admin_delete_prediction(
  p_prediction_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pred jsonb;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Acesso negado.';
  end if;

  select to_jsonb(p) into v_pred
  from public.predictions p
  where id = p_prediction_id;

  if not found then
    raise exception 'Palpite não encontrado: %', p_prediction_id;
  end if;

  delete from public.predictions where id = p_prediction_id;

  perform public.log_audit(
    'prediction_deleted',
    'prediction',
    p_prediction_id::text,
    v_pred,
    null
  );
end;
$$;

-- Grant to authenticated (admin check is enforced inside each function)
grant execute on function public.admin_settle_match_result(text, integer, integer, text, text)
  to authenticated;

grant execute on function public.admin_delete_prediction(uuid)
  to authenticated;
