-- Harden exposed RPC permissions and make health view invoker-safe.

create or replace view public.system_health
with (security_invoker = true)
as
select
  (select count(*) from public.users) as users_total,
  (select count(*) from public.users where participant_status = 'pending') as users_pending,
  (select count(*) from public.predictions) as predictions_total,
  (select count(*) from public.chat_messages where deleted_at is null) as chat_messages_total,
  (select count(*) from public.bulletins) as bulletins_total,
  (select count(*) from public.matches where market_status = 'open') as markets_open,
  (select count(*) from public.matches where market_status = 'locked') as markets_locked,
  (select count(*) from public.matches where kickoff_utc is null) as matches_without_kickoff,
  (select max(snapshot_at) from public.ranking_snapshots) as last_ranking_refresh;

revoke execute on function public.auto_grant_admin() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
revoke execute on function public.is_admin(uuid) from public, anon;
revoke execute on function public.is_marketing(uuid) from public, anon;
revoke execute on function public.is_owner(uuid) from public, anon;
revoke execute on function public.log_audit(text,text,text,jsonb,jsonb) from public, anon;
revoke execute on function public.set_match_market_status(text,text,text) from public, anon;
revoke execute on function public.settle_match_result(text,integer,integer) from public, anon;
revoke execute on function public.refresh_ranking_snapshots() from public, anon;
revoke execute on function public.moderate_chat_message(uuid,text) from public, anon;
revoke execute on function public.update_participant_status(uuid,text) from public, anon;

grant execute on function public.is_admin(uuid) to authenticated;
grant execute on function public.is_marketing(uuid) to authenticated;
grant execute on function public.is_owner(uuid) to authenticated;
grant execute on function public.log_audit(text,text,text,jsonb,jsonb) to authenticated;
grant execute on function public.set_match_market_status(text,text,text) to authenticated;
grant execute on function public.settle_match_result(text,integer,integer) to authenticated;
grant execute on function public.refresh_ranking_snapshots() to authenticated;
grant execute on function public.moderate_chat_message(uuid,text) to authenticated;
grant execute on function public.update_participant_status(uuid,text) to authenticated;
