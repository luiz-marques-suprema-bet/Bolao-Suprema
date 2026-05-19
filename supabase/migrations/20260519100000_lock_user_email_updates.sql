-- ============================================================================
-- Bolão Suprema · Hardening: bloqueio contra alteração direta de e-mail
-- ============================================================================
-- Objetivo:
--   Estender a proteção de campos privilegiados para incluir `email`.
--   O e-mail é a identidade principal vinculada ao Supabase Auth e ao domínio
--   corporativo @suprema.group. Alterações devem ocorrer exclusivamente por
--   fluxo controlado de autenticação, não por update direto na tabela de perfil.
--
-- Nota:
--   Esta migration substitui a função prevent_user_privilege_escalation
--   definida em 20260519090000, adicionando a verificação de `email`.
--   O trigger é recriado sobre a mesma tabela.
-- ============================================================================

create or replace function public.prevent_user_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Admins/owners continuam podendo gerenciar usuários via fluxo autorizado.
  if not public.is_admin(auth.uid()) then
    if new.email              is distinct from old.email
      or new.is_admin         is distinct from old.is_admin
      or new.is_owner         is distinct from old.is_owner
      or new.is_marketing     is distinct from old.is_marketing
      or new.user_role        is distinct from old.user_role
      or new.participant_status is distinct from old.participant_status
      or new.approved_at      is distinct from old.approved_at
      or new.approved_by      is distinct from old.approved_by
      or new.blocked_at       is distinct from old.blocked_at
      or new.removed_at       is distinct from old.removed_at
    then
      raise exception 'Unauthorized profile identity or privilege change.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_prevent_user_privilege_escalation on public.users;

create trigger trg_prevent_user_privilege_escalation
before update on public.users
for each row
execute function public.prevent_user_privilege_escalation();

-- Deny direct execution — only invoked internally by the trigger engine.
revoke execute on function public.prevent_user_privilege_escalation()
  from public, anon, authenticated;
