-- ============================================================================
-- Bolao Suprema - restore SECURITY DEFINER for RPCs that call log_audit
-- ----------------------------------------------------------------------------
-- 20260522033000 converted several public RPCs to SECURITY INVOKER. Functions
-- that call public.log_audit then fail for authenticated users because direct
-- execute on log_audit is intentionally revoked.
--
-- Keep log_audit revoked. Restore SECURITY DEFINER only for RPCs that either:
--   - perform admin actions and audit them; or
--   - save audited special picks through server-side checks.
--
-- Idempotent and tolerant of functions that may not exist in older DBs.
-- ============================================================================

do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'admin_bulk_match_status',
        'admin_delete_prediction',
        'admin_set_user_role',
        'admin_update_match_status',
        'moderate_chat_message',
        'refresh_ranking_snapshots',
        'save_general_picks',
        'save_scoring_rule',
        'set_match_market_status',
        'settle_match_result',
        'update_participant_status'
      )
  loop
    execute format('alter function %s security definer', r.signature);
  end loop;
end $$;

-- Verification:
--   select n.nspname, p.proname, p.oid::regprocedure as signature, p.prosecdef
--   from pg_proc p
--   join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public'
--     and p.proname in (
--       'admin_bulk_match_status','admin_delete_prediction','admin_set_user_role',
--       'admin_update_match_status','moderate_chat_message','refresh_ranking_snapshots',
--       'save_general_picks','save_scoring_rule','set_match_market_status',
--       'settle_match_result','update_participant_status'
--     )
--   order by p.proname, signature::text;
