-- ============================================================================
-- Bolão Suprema · Hardening: RPCs auditáveis para operações de partida
-- ============================================================================
-- Contexto:
--   O painel admin fazia updates diretos na tabela `matches` via API REST,
--   contornando qualquer controle de auditoria. Estas funções centralizam
--   todas as mudanças de status de partida com verificação de admin e log.
--
-- Funções criadas:
--   - admin_update_match_status   → atualiza status de uma partida
--   - admin_bulk_match_status     → atualiza status de múltiplas partidas
-- ============================================================================

-- ── admin_update_match_status ─────────────────────────────────────────────────

create or replace function public.admin_update_match_status(
  p_match_code  text,
  p_status      text,
  p_home_score  integer default null,
  p_away_score  integer default null,
  p_live_minute text    default null,
  p_winner      text    default null,
  p_lock_reason text    default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before  jsonb;
  v_market  text;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Acesso negado.';
  end if;

  select to_jsonb(m) into v_before
  from public.matches m
  where m.match_code = p_match_code;

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
    locked_at     = case
                      when p_status = 'locked'   then now()
                      when p_status = 'open'     then null
                      else locked_at
                    end,
    lock_reason   = case
                      when p_status = 'locked'   then coalesce(p_lock_reason, 'admin_lock')
                      when p_status = 'open'     then null
                      else lock_reason
                    end,
    unlocked_at   = case
                      when p_status = 'open'     then now()
                      else unlocked_at
                    end,
    settled_at    = case
                      when p_status = 'finished' then now()
                      when p_status = 'open'     then null
                      else settled_at
                    end,
    home_score    = coalesce(p_home_score,  home_score),
    away_score    = coalesce(p_away_score,  away_score),
    live_minute   = coalesce(p_live_minute, live_minute),
    winner        = coalesce(p_winner,      winner)
  where match_code = p_match_code;

  perform public.log_audit(
    'match_status_updated',
    'match',
    p_match_code,
    v_before,
    jsonb_build_object(
      'status',        p_status,
      'market_status', v_market,
      'home_score',    p_home_score,
      'away_score',    p_away_score,
      'winner',        p_winner
    )
  );
end;
$$;

-- ── admin_bulk_match_status ───────────────────────────────────────────────────

create or replace function public.admin_bulk_match_status(
  p_status        text,
  p_from_statuses text[],
  p_match_codes   text[]  default null,
  p_lock_reason   text    default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count   integer;
  v_market  text;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Acesso negado.';
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
    locked_at     = case
                      when p_status = 'locked' then now()
                      when p_status = 'open'   then null
                      else locked_at
                    end,
    lock_reason   = case
                      when p_status = 'locked' then coalesce(p_lock_reason, 'bulk_admin_lock')
                      when p_status = 'open'   then null
                      else lock_reason
                    end,
    unlocked_at   = case
                      when p_status = 'open'   then now()
                      else unlocked_at
                    end,
    settled_at    = case
                      when p_status = 'finished' then now()
                      when p_status = 'open'     then null
                      else settled_at
                    end
  where status = any(p_from_statuses)
    and (p_match_codes is null or match_code = any(p_match_codes));

  get diagnostics v_count = row_count;

  perform public.log_audit(
    'bulk_match_status_updated',
    'match',
    null,
    null,
    jsonb_build_object(
      'status',       p_status,
      'from_statuses', p_from_statuses,
      'match_codes',  p_match_codes,
      'count',        v_count
    )
  );

  return v_count;
end;
$$;

-- Grant to authenticated (admin check is enforced inside each function)
grant execute on function public.admin_update_match_status(text, text, integer, integer, text, text, text)
  to authenticated;

grant execute on function public.admin_bulk_match_status(text, text[], text[], text)
  to authenticated;
