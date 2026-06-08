-- ============================================================================
-- Bolão Suprema · Realtime: incluir tabelas do chat na publicação
-- ============================================================================
-- Contexto:
--   A reconstrução da Resenha (20260521153000) adicionou apenas
--   `chat_message_reactions` à publicação `supabase_realtime`. As tabelas
--   `chat_messages`, `poll_votes` e `channel_pins` ficaram de fora, então
--   reações atualizavam em tempo real mas novas MENSAGENS só apareciam após F5.
--
-- Esta migração garante (de forma idempotente) que as tabelas do chat estejam
-- na publicação de Realtime. Segura para reaplicar.
-- ============================================================================

do $$
declare
  tbl text;
begin
  foreach tbl in array array['chat_messages', 'poll_votes', 'channel_pins'] loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = tbl
    ) then
      execute format('alter publication supabase_realtime add table public.%I', tbl);
    end if;
  end loop;
end $$;
