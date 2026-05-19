-- ============================================================================
-- Bolão Suprema · Hardening: privacidade de palpites
-- ============================================================================
-- Contexto:
--   Usuários comuns não devem ver os palpites de outros participantes antes
--   do fechamento do mercado ou do kickoff da partida — isso evita que um
--   participante copie os palpites de outro antes do prazo encerrar.
--
-- Regra:
--   - O próprio usuário sempre vê seus palpites.
--   - Admin vê tudo.
--   - Outros usuários só veem após: market_status ≠ 'open'
--     OU status ∈ (locked, live, finished) OU kickoff_utc ≤ now().
-- ============================================================================

drop policy if exists predictions_select_own     on public.predictions;
drop policy if exists predictions_select_all     on public.predictions;
drop policy if exists predictions_select_visible on public.predictions;

create policy predictions_select_visible on public.predictions
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_admin((select auth.uid()))
    or exists (
      select 1
      from public.matches m
      where m.match_code = predictions.match_code
        and (
          coalesce(m.market_status, 'open') <> 'open'
          or m.status in ('locked', 'live', 'finished')
          or (m.kickoff_utc is not null and m.kickoff_utc <= now())
        )
    )
  );
