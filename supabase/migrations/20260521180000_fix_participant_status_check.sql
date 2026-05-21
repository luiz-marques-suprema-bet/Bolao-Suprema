-- Fix: allow 'pending' users to post predictions and chat messages.
-- Previously the trigger required participant_status = 'active', blocking
-- new users whose status starts as 'pending'. Now it only rejects 'blocked'.

create or replace function public.ensure_active_participant()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if exists (
    select 1 from public.users
    where id = new.user_id
      and participant_status = 'blocked'
  ) then
    raise exception 'Participante bloqueado.';
  end if;
  return new;
end;
$$;
