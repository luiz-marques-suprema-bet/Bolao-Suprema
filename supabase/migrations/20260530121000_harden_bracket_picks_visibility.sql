-- ============================================================================
-- Bolao Suprema · M3 remediation · visibilidade de bracket_picks
-- ----------------------------------------------------------------------------
-- bracket_picks usava `bracket_select_all USING (true)` (supabase-schema.sql),
-- nunca substituido por migration: qualquer usuario autenticado conseguia ler o
-- chaveamento completo dos outros ANTES do fechamento (mesma falha que a
-- migration 20260519110000 corrigiu para `predictions`).
--
-- Alinha bracket_picks ao padrao de predictions_select_visible:
--   - o usuario sempre ve os proprios picks;
--   - admin ve todos;
--   - picks de uma rodada so ficam visiveis aos demais depois que a rodada e
--     travada (existe linha em bracket_round_locks para aquela round).
--
-- Idempotente: drop if exists antes de recriar.
-- ============================================================================

drop policy if exists bracket_select_all on public.bracket_picks;
drop policy if exists bracket_select_own_or_locked on public.bracket_picks;

create policy bracket_select_own_or_locked on public.bracket_picks
  for select to authenticated using (
    user_id = (select auth.uid())
    or public.is_admin((select auth.uid()))
    or exists (
      select 1 from public.bracket_round_locks l
      where l.round = bracket_picks.round
    )
  );
