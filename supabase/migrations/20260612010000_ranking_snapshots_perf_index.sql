-- ============================================================================
-- Bolao Suprema · índice de performance para current_ranking
-- ----------------------------------------------------------------------------
-- A view current_ranking faz DISTINCT ON (user_id) ORDER BY user_id,
-- snapshot_at DESC, id DESC sobre ranking_snapshots. O único índice existente
-- era em (user_id), entao o Postgres ordenava ~93k linhas em memoria a cada
-- carga do ranking → ~3,7s (perto do timeout de 4,5s da tela).
--
-- Este índice composto deixa o DISTINCT ON ler ja ordenado → ~150ms.
-- (Aplicado em producao via Management API; registrado aqui. Nao apaga dados.)
-- ============================================================================

create index if not exists idx_ranking_snapshots_user_snap
  on public.ranking_snapshots (user_id, snapshot_at desc, id desc);

analyze public.ranking_snapshots;
