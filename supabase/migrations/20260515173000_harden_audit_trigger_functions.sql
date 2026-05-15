-- Trigger audit functions must be callable by triggers after log_audit was made private,
-- but should not be directly executable through the exposed API roles.

create or replace function public.audit_prediction_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.log_audit(
    case when tg_op = 'INSERT' then 'prediction_created' else 'prediction_updated' end,
    'prediction',
    coalesce(new.id, old.id)::text,
    case when tg_op = 'UPDATE' then to_jsonb(old) else null end,
    to_jsonb(new)
  );
  return new;
end;
$$;

create or replace function public.audit_profile_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.log_audit('profile_updated', 'user', new.id::text, to_jsonb(old), to_jsonb(new));
  return new;
end;
$$;

revoke execute on function public.audit_prediction_change() from public, anon, authenticated;
revoke execute on function public.audit_profile_update() from public, anon, authenticated;
