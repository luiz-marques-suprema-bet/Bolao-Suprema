-- Harden public profile reads so privacy is enforced by RLS, not only the UI.

drop policy if exists users_select_all on public.users;
drop policy if exists users_select_profile_privacy on public.users;

create policy users_select_profile_privacy on public.users
  for select to authenticated
  using (
    id = (select auth.uid())
    or coalesce(privacy_hide_profile, false) = false
    or public.is_admin((select auth.uid()))
  );

drop policy if exists users_insert_own on public.users;
create policy users_insert_own on public.users
  for insert to authenticated
  with check ((select auth.uid()) = id);

drop policy if exists users_update_own on public.users;
create policy users_update_own on public.users
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);
