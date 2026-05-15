-- Public buckets serve object URLs without broad storage.objects SELECT policies.
-- Keep legacy URLs renderable while preventing bucket object listing.

drop policy if exists "avatars_read_all" on storage.objects;
drop policy if exists "user_media_read_all" on storage.objects;
drop policy if exists "storage_public_legacy_read" on storage.objects;
