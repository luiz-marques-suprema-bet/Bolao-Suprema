-- ============================================================================
-- Bolao Suprema · ranking_snapshots no Realtime
-- ============================================================================
-- A tela de Ranking escuta postgres_changes em public.ranking_snapshots
-- (lib/ranking.ts -> subscribeRankingUpdates). Porem essa tabela nunca foi
-- adicionada a publicacao `supabase_realtime` (apenas ranking_breakdowns e
-- tournament_awards foram). Resultado: quando a apuracao atualiza o ranking,
-- as abas abertas NAO recebem o evento e o ranking so muda com F5.
--
-- Esta migracao adiciona ranking_snapshots a publicacao. Idempotente.
-- ============================================================================

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'ranking_snapshots'
  ) then
    alter publication supabase_realtime add table public.ranking_snapshots;
  end if;
end $$;
