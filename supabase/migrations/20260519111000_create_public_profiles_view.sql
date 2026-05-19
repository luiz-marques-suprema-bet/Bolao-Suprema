-- ============================================================================
-- Bolão Suprema · Privacidade: view public_profiles (sem e-mail)
-- ============================================================================
-- Contexto:
--   A tabela `users` expõe e-mail e outros campos sensíveis via API Supabase
--   para qualquer authenticated user que tenha permissão de SELECT na tabela.
--   Esta view oferece um subconjunto seguro para leitura pública entre pares.
--
-- Segurança:
--   - `security_invoker = true` garante que a RLS da tabela `users` seja
--     aplicada com as permissões do chamador (não do dono da view).
--   - O campo `email` é excluído completamente desta view.
--   - Campos administrativos (approved_by, blocked_at, removed_at, etc.)
--     também são excluídos — visíveis apenas pelo painel admin via `users`.
-- ============================================================================

drop view if exists public.public_profiles;

create view public.public_profiles
with (security_invoker = true)
as
  select
    id,
    first_name,
    last_name,
    initials,
    color,
    dept,
    avatar_url,
    banner_url,
    bio,
    favorite_team,
    favorite_player,
    favorite_player_img,
    since,
    is_admin,
    is_marketing,
    is_owner,
    user_role,
    participant_status,
    privacy_hide_email,
    privacy_hide_profile,
    created_at
  from public.users;

grant select on public.public_profiles to authenticated;
