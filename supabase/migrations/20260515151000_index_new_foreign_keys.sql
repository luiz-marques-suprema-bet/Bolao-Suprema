-- Cover new product foreign keys reported by Supabase advisors.

create index if not exists idx_bracket_round_locks_locked_by on public.bracket_round_locks(locked_by);
create index if not exists idx_chat_messages_deleted_by on public.chat_messages(deleted_by);
create index if not exists idx_participant_invites_created_by on public.participant_invites(created_by);
create index if not exists idx_regulation_versions_published_by on public.regulation_versions(published_by);
create index if not exists idx_scoring_rules_updated_by on public.scoring_rules(updated_by);
create index if not exists idx_users_approved_by on public.users(approved_by);

revoke execute on function public.log_audit(text,text,text,jsonb,jsonb) from public, anon, authenticated;
