-- ============================================================================
-- Bolao Suprema · Fix: novos usuarios ficavam presos em 'pending'
-- ============================================================================
-- Problema:
--   handle_new_user criava todos os usuarios com participant_status = 'pending'.
--   A funcao updateProfile nunca atualizava esse campo, entao o usuario ficava
--   bloqueado de fazer palpites mesmo apos completar o setup.
--
-- Correcao:
--   1. handle_new_user passa a criar usuarios como 'active'. A autenticacao
--      por OTP com @suprema.group ja e a barreira de entrada — nao ha motivo
--      para exigir aprovacao manual adicional.
--   2. prevent_user_privilege_escalation atualizado para permitir a transicao
--      pending → active (conclusao do setup). Toda outra mudanca de
--      participant_status por usuarios comuns continua bloqueada.
--   3. Usuarios pendentes que ja completaram o perfil sao ativados
--      retroativamente.
-- ============================================================================

-- 1. Atualiza o trigger de seguranca para permitir pending → active
create or replace function public.prevent_user_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin(auth.uid()) then
    if new.is_admin       is distinct from old.is_admin
      or new.is_owner     is distinct from old.is_owner
      or new.is_marketing is distinct from old.is_marketing
      or new.user_role    is distinct from old.user_role
      or new.approved_at  is distinct from old.approved_at
      or new.approved_by  is distinct from old.approved_by
      or new.blocked_at   is distinct from old.blocked_at
      or new.removed_at   is distinct from old.removed_at
    then
      raise exception 'Unauthorized profile identity or privilege change.';
    end if;

    -- Permite apenas pending → active (conclusao do setup pelo proprio usuario)
    if new.participant_status is distinct from old.participant_status
      and not (old.participant_status = 'pending' and new.participant_status = 'active')
    then
      raise exception 'Unauthorized participant_status change.';
    end if;
  end if;

  return new;
end;
$$;

-- 2. Corrige o trigger de criacao de usuario
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, participant_status)
  values (new.id, new.email, 'active')
  on conflict (id) do nothing;
  return new;
end;
$$;

-- 3. Ativa retroativamente usuarios pendentes que ja completaram o perfil
update public.users
set participant_status = 'active'
where participant_status = 'pending'
  and first_name is not null
  and first_name <> '';
