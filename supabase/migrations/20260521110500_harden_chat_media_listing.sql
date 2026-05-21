-- ============================================================================
-- Bolao Suprema · prevent broad listing on public chat-media bucket
-- ============================================================================
-- Public object URLs still work for rendering media. This only prevents clients
-- from listing every object in the bucket through storage.objects.

drop policy if exists chat_media_read_all on storage.objects;
