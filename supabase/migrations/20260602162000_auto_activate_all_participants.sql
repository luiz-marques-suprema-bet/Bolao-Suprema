-- Bolao Suprema - self-service participants.
--
-- Product decision for launch: any authenticated @suprema.group user must be
-- able to predict, post in Resenha, and use the app without manual approval.
-- Admin can still block/remove exceptional users.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (
    id,
    email,
    first_name,
    last_name,
    dept,
    initials,
    color,
    since,
    is_admin,
    is_marketing,
    user_role,
    participant_status
  )
  values (
    new.id,
    coalesce(new.email, ''),
    '',
    '',
    '',
    '',
    '#00A651',
    extract(year from now())::text,
    false,
    false,
    'user',
    'active'
  )
  on conflict (id) do update
    set email = excluded.email,
        participant_status = case
          when public.users.participant_status in ('blocked', 'removed') then public.users.participant_status
          else 'active'
        end;

  return new;
end;
$$;

update public.users
set participant_status = 'active'
where participant_status = 'pending';
