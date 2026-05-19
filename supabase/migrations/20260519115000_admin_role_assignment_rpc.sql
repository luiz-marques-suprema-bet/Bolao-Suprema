-- ============================================================================
-- Bolão Suprema · RPC: admin_set_user_role
-- Permite que owners concedam/revoguem papel de admin ou marketing a outros
-- usuários. Admins comuns não podem escalar privilégios.
-- ============================================================================

create or replace function public.admin_set_user_role(
  p_user_id   uuid,
  p_is_admin  boolean default null,
  p_is_marketing boolean default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before jsonb;
  v_target_role text;
begin
  -- Apenas owner pode conceder/revogar papéis
  if not public.is_owner(auth.uid()) then
    raise exception 'Apenas o proprietário pode alterar papéis de usuários.';
  end if;

  -- Não pode alterar o próprio papel
  if p_user_id = auth.uid() then
    raise exception 'Não é possível alterar seu próprio papel.';
  end if;

  -- Capturar estado anterior para auditoria
  select to_jsonb(u) into v_before
  from public.users u
  where u.id = p_user_id;

  if not found then
    raise exception 'Usuário não encontrado: %', p_user_id;
  end if;

  -- Verificar que o alvo não é owner (não pode rebaixar owner)
  select user_role into v_target_role from public.users where id = p_user_id;
  if v_target_role = 'owner' then
    raise exception 'Não é possível alterar o papel de um proprietário.';
  end if;

  update public.users set
    is_admin     = coalesce(p_is_admin,     is_admin),
    is_marketing = coalesce(p_is_marketing, is_marketing),
    user_role    = case
                     when coalesce(p_is_admin, is_admin) = true then 'admin'
                     when coalesce(p_is_marketing, is_marketing) = true then 'marketing'
                     else 'user'
                   end
  where id = p_user_id;

  perform public.log_audit(
    'user_role_updated',
    'user',
    p_user_id::text,
    v_before,
    jsonb_build_object(
      'is_admin',     p_is_admin,
      'is_marketing', p_is_marketing
    )
  );
end;
$$;

grant execute on function public.admin_set_user_role(uuid, boolean, boolean)
  to authenticated;
