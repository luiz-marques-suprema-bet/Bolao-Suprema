-- Bolao Suprema - require active participants for protected writes.
--
-- Reverts the unsafe relaxation that allowed pending users to create
-- predictions and chat messages. Product-critical writes must require
-- participant_status = 'active'; pending, blocked, and removed users are denied.

create or replace function public.ensure_active_participant()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.users
    where id = new.user_id
      and participant_status = 'active'
  ) then
    raise exception 'Participante pendente, bloqueado ou removido.';
  end if;

  return new;
end;
$$;
