-- ─────────────────────────────────────────────────────────────────────────────
-- Fix: novos usuários não conseguem salvar perfil no onboarding (Setup)
--
-- Raiz do problema: updateProfile() faz upsert em public.users, mas para
-- usuários novos (sem linha ainda) isso é um INSERT — e faltava a policy
-- de INSERT no RLS. Corrigimos em três frentes:
--
--  1. Policy INSERT em public.users (fix imediato para quem já cadastrou)
--  2. Trigger que cria a linha stub em public.users no signup do auth
--     (previne o problema para todos os próximos cadastros)
--  3. Backfill: cria linhas stub para auth.users que ainda não têm perfil
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Policy INSERT: usuário autenticado pode inserir sua própria linha
DROP POLICY IF EXISTS "users can insert own profile" ON public.users;
CREATE POLICY "users can insert own profile" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- 2. Trigger function: cria linha stub em public.users assim que o auth.users
--    ganha um novo registro (evita que o INSERT policy precise ser usado)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (
    id, email,
    first_name, last_name, dept, initials,
    color, since,
    is_admin, is_marketing,
    user_role, participant_status
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    '', '', '', '',
    '#00A651',
    EXTRACT(year FROM NOW())::text,
    false, false,
    'user', 'pending'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- 3. Attach trigger a auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 4. Backfill: cria linhas stub para qualquer auth.user sem perfil ainda
INSERT INTO public.users (
  id, email,
  first_name, last_name, dept, initials,
  color, since,
  is_admin, is_marketing,
  user_role, participant_status
)
SELECT
  au.id,
  COALESCE(au.email, ''),
  '', '', '', '',
  '#00A651',
  EXTRACT(year FROM NOW())::text,
  false, false,
  'user', 'pending'
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM public.users pu WHERE pu.id = au.id
);

-- ─── Storage: garantir políticas nos buckets de avatar ───────────────────────
-- Usuários autenticados podem fazer upload e update no próprio diretório
-- (path = {userId}/avatar  ou  {userId}/banner)

-- avatars
DROP POLICY IF EXISTS "users upload own avatar"  ON storage.objects;
DROP POLICY IF EXISTS "users update own avatar"  ON storage.objects;
CREATE POLICY "users upload own avatar" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND name LIKE (auth.uid()::text || '/%'));
CREATE POLICY "users update own avatar" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND name LIKE (auth.uid()::text || '/%'));

-- banners
DROP POLICY IF EXISTS "users upload own banner"  ON storage.objects;
DROP POLICY IF EXISTS "users update own banner"  ON storage.objects;
CREATE POLICY "users upload own banner" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'banners' AND name LIKE (auth.uid()::text || '/%'));
CREATE POLICY "users update own banner" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'banners' AND name LIKE (auth.uid()::text || '/%'));

-- user-media (bucket de fallback)
DROP POLICY IF EXISTS "users upload to user-media"  ON storage.objects;
DROP POLICY IF EXISTS "users update in user-media"  ON storage.objects;
CREATE POLICY "users upload to user-media" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'user-media' AND name LIKE (auth.uid()::text || '/%'));
CREATE POLICY "users update in user-media" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'user-media' AND name LIKE (auth.uid()::text || '/%'));
