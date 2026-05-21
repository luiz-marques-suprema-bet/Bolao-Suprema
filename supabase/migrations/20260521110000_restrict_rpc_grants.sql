-- ============================================================================
-- Bolao Suprema · restrict exposed RPC grants
-- ============================================================================

revoke execute on function public.save_match_predictions(jsonb) from public, anon;
revoke execute on function public.admin_update_match_status(text, text, integer, integer, text, text, text) from public, anon;
revoke execute on function public.admin_bulk_match_status(text, text[], text[], text) from public, anon;
revoke execute on function public.set_match_market_status(text, text, text) from public, anon;
revoke execute on function public.settle_match_result(text, integer, integer) from public, anon;
revoke execute on function public.admin_delete_prediction(uuid) from public, anon;
revoke execute on function public.admin_set_user_role(uuid, boolean, boolean) from public, anon;

grant execute on function public.save_match_predictions(jsonb) to authenticated;
grant execute on function public.admin_update_match_status(text, text, integer, integer, text, text, text) to authenticated;
grant execute on function public.admin_bulk_match_status(text, text[], text[], text) to authenticated;
grant execute on function public.set_match_market_status(text, text, text) to authenticated;
grant execute on function public.settle_match_result(text, integer, integer) to authenticated;
grant execute on function public.admin_delete_prediction(uuid) to authenticated;
grant execute on function public.admin_set_user_role(uuid, boolean, boolean) to authenticated;
