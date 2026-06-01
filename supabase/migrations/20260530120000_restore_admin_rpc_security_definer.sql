-- ============================================================================
-- Bolao Suprema · H1 remediation · restaura SECURITY DEFINER de RPCs de admin
-- ----------------------------------------------------------------------------
-- A migration 20260522033000 converteu em lote varias RPCs para SECURITY INVOKER.
-- Para as duas funcoes que dao UPDATE em OUTRAS linhas de public.users isso as
-- quebrou: a unica policy de UPDATE em users e users_update_own (auth.uid() = id),
-- entao como INVOKER elas passavam a casar 0 linhas (falha silenciosa, sem erro).
--
-- As duas ja fixam search_path e fazem checagem interna de autorizacao
-- (is_admin para status de participante; is_owner para papeis). Portanto
-- SECURITY DEFINER e a correcao correta e de menor superficie: NAO criamos uma
-- policy ampla de admin-update em public.users.
--
-- Idempotente: ALTER FUNCTION ... SECURITY DEFINER pode rodar repetidas vezes.
-- ============================================================================

alter function public.update_participant_status(uuid, text) security definer;
alter function public.admin_set_user_role(uuid, boolean, boolean) security definer;

-- Verificacao manual:
--   select proname, prosecdef from pg_proc
--   where proname in ('update_participant_status','admin_set_user_role');
--   -- esperado: prosecdef = true (t) para ambas
