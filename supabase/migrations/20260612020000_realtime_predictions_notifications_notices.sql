-- ============================================================================
-- Bolao Suprema · Realtime para predictions, notifications e global_notices
-- ----------------------------------------------------------------------------
-- Faltavam na publicacao supabase_realtime:
--   predictions     → Espiadinha reage na hora a novos palpites/apuracao
--   notifications   → central de avisos por usuario atualiza sem refresh
--   global_notices  → avisos da organizacao aparecem sem refresh
-- Aplicado em producao via Management API; registrado aqui. Idempotente.
-- ============================================================================

do $$
declare tbl text;
begin
  foreach tbl in array array['predictions','notifications','global_notices'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = tbl
    ) then
      execute format('alter publication supabase_realtime add table public.%I', tbl);
    end if;
  end loop;
end $$;
