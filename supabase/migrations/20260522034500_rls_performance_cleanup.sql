-- Bolao Suprema - RLS performance cleanup based on Supabase advisor output.

create index if not exists idx_global_notices_created_by on public.global_notices(created_by);

drop policy if exists "users can insert own profile" on public.users;

drop policy if exists predictions_own_write on public.predictions;
create policy predictions_own_write
on public.predictions for insert to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists predictions_own_update on public.predictions;
create policy predictions_own_update
on public.predictions for update to authenticated
using (user_id = (select auth.uid()));

drop policy if exists predictions_own_delete on public.predictions;
drop policy if exists predictions_admin_delete on public.predictions;
create policy predictions_delete_own_or_admin
on public.predictions for delete to authenticated
using (user_id = (select auth.uid()) or public.is_admin((select auth.uid())));

drop policy if exists bracket_own_write on public.bracket_picks;
create policy bracket_own_write
on public.bracket_picks for insert to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists bracket_own_update on public.bracket_picks;
create policy bracket_own_update
on public.bracket_picks for update to authenticated
using (user_id = (select auth.uid()));

drop policy if exists bracket_own_delete on public.bracket_picks;
create policy bracket_own_delete
on public.bracket_picks for delete to authenticated
using (user_id = (select auth.uid()));

drop policy if exists chat_insert_own on public.chat_messages;
create policy chat_insert_own
on public.chat_messages for insert to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists chat_admin_delete on public.chat_messages;
drop policy if exists chat_delete_admin on public.chat_messages;
drop policy if exists chat_delete_own on public.chat_messages;
create policy chat_delete_own_or_admin
on public.chat_messages for delete to authenticated
using (user_id = (select auth.uid()) or public.is_admin((select auth.uid())));

drop policy if exists poll_votes_own_upsert on public.poll_votes;
create policy poll_votes_own_upsert
on public.poll_votes for insert to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists poll_votes_own_update on public.poll_votes;
create policy poll_votes_own_update
on public.poll_votes for update to authenticated
using (user_id = (select auth.uid()));

drop policy if exists matches_admin_write on public.matches;
create policy matches_admin_insert on public.matches for insert to authenticated
with check (public.is_admin((select auth.uid())));
create policy matches_admin_update on public.matches for update to authenticated
using (public.is_admin((select auth.uid())))
with check (public.is_admin((select auth.uid())));
create policy matches_admin_delete on public.matches for delete to authenticated
using (public.is_admin((select auth.uid())));

drop policy if exists notices_admin_write on public.global_notices;
create policy notices_admin_insert on public.global_notices for insert to authenticated
with check (public.is_admin((select auth.uid())));
create policy notices_admin_update on public.global_notices for update to authenticated
using (public.is_admin((select auth.uid())))
with check (public.is_admin((select auth.uid())));
create policy notices_admin_delete on public.global_notices for delete to authenticated
using (public.is_admin((select auth.uid())));

drop policy if exists bulletins_write_privileged on public.bulletins;
create policy bulletins_insert_privileged on public.bulletins for insert to authenticated
with check (public.is_marketing((select auth.uid())));
create policy bulletins_update_privileged on public.bulletins for update to authenticated
using (public.is_marketing((select auth.uid())))
with check (public.is_marketing((select auth.uid())));
create policy bulletins_delete_privileged on public.bulletins for delete to authenticated
using (public.is_marketing((select auth.uid())));

drop policy if exists pins_admin_write on public.channel_pins;
create policy pins_admin_insert on public.channel_pins for insert to authenticated
with check (public.is_admin((select auth.uid())));
create policy pins_admin_update on public.channel_pins for update to authenticated
using (public.is_admin((select auth.uid())))
with check (public.is_admin((select auth.uid())));
create policy pins_admin_delete on public.channel_pins for delete to authenticated
using (public.is_admin((select auth.uid())));

drop policy if exists ranking_admin_write on public.ranking_snapshots;
create policy ranking_admin_insert on public.ranking_snapshots for insert to authenticated
with check (public.is_admin((select auth.uid())));
create policy ranking_admin_update on public.ranking_snapshots for update to authenticated
using (public.is_admin((select auth.uid())))
with check (public.is_admin((select auth.uid())));
create policy ranking_admin_delete on public.ranking_snapshots for delete to authenticated
using (public.is_admin((select auth.uid())));

drop policy if exists bracket_locks_admin_all on public.bracket_round_locks;
create policy bracket_locks_admin_insert on public.bracket_round_locks for insert to authenticated
with check (public.is_admin((select auth.uid())));
create policy bracket_locks_admin_update on public.bracket_round_locks for update to authenticated
using (public.is_admin((select auth.uid())))
with check (public.is_admin((select auth.uid())));
create policy bracket_locks_admin_delete on public.bracket_round_locks for delete to authenticated
using (public.is_admin((select auth.uid())));

drop policy if exists ranking_breakdowns_admin_all on public.ranking_breakdowns;
create policy ranking_breakdowns_admin_insert on public.ranking_breakdowns for insert to authenticated
with check (public.is_admin((select auth.uid())));
create policy ranking_breakdowns_admin_update on public.ranking_breakdowns for update to authenticated
using (public.is_admin((select auth.uid())))
with check (public.is_admin((select auth.uid())));
create policy ranking_breakdowns_admin_delete on public.ranking_breakdowns for delete to authenticated
using (public.is_admin((select auth.uid())));

drop policy if exists regulation_admin_all on public.regulation_versions;
create policy regulation_admin_insert on public.regulation_versions for insert to authenticated
with check (public.is_admin((select auth.uid())) or public.is_marketing((select auth.uid())));
create policy regulation_admin_update on public.regulation_versions for update to authenticated
using (public.is_admin((select auth.uid())) or public.is_marketing((select auth.uid())))
with check (public.is_admin((select auth.uid())) or public.is_marketing((select auth.uid())));
create policy regulation_admin_delete on public.regulation_versions for delete to authenticated
using (public.is_admin((select auth.uid())) or public.is_marketing((select auth.uid())));

drop policy if exists scoring_admin_write on public.scoring_rules;
create policy scoring_admin_insert on public.scoring_rules for insert to authenticated
with check (public.is_admin((select auth.uid())));
create policy scoring_admin_update on public.scoring_rules for update to authenticated
using (public.is_admin((select auth.uid())))
with check (public.is_admin((select auth.uid())));
create policy scoring_admin_delete on public.scoring_rules for delete to authenticated
using (public.is_admin((select auth.uid())));
