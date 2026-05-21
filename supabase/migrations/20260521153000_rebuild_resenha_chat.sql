-- ============================================================================
-- Bolao Suprema - Resenha rebuild
-- ============================================================================
-- Chat model for WhatsApp/Telegram-style group behavior:
-- messages + replies + mentions + media metadata + per-user reactions.

alter table public.chat_messages
  add column if not exists reply_to jsonb,
  add column if not exists media_url text,
  add column if not exists media_kind text,
  add column if not exists media_mime text,
  add column if not exists media_size integer,
  add column if not exists media_duration numeric,
  add column if not exists media_thumbnail_url text,
  add column if not exists mentions uuid[] not null default '{}'::uuid[],
  add column if not exists edited_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

alter table public.chat_messages
  drop constraint if exists chat_messages_type_check;
alter table public.chat_messages
  add constraint chat_messages_type_check
  check (type in ('text', 'gif', 'poll', 'image', 'audio', 'video', 'video_note'));

alter table public.chat_messages
  drop constraint if exists chat_messages_media_kind_check;
alter table public.chat_messages
  add constraint chat_messages_media_kind_check
  check (
    media_kind is null
    or media_kind in ('text', 'gif', 'poll', 'image', 'audio', 'video', 'video_note')
  );

alter table public.chat_messages
  drop constraint if exists chat_messages_media_size_check;
alter table public.chat_messages
  add constraint chat_messages_media_size_check
  check (media_size is null or media_size between 0 and 26214400);

update public.chat_messages
set
  media_url = coalesce(media_url, image_url, audio_url, gif_url),
  media_kind = coalesce(
    media_kind,
    case
      when image_url is not null then 'image'
      when audio_url is not null then 'audio'
      when gif_url is not null then 'gif'
      else type
    end
  ),
  media_duration = coalesce(media_duration, audio_duration)
where media_url is null or media_kind is null or media_duration is null;

create table if not exists public.chat_message_reactions (
  message_id uuid not null references public.chat_messages(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, emoji),
  constraint chat_message_reactions_emoji_size check (char_length(emoji) between 1 and 16)
);

create index if not exists idx_chat_messages_mentions on public.chat_messages using gin (mentions);
create index if not exists idx_chat_messages_media_kind on public.chat_messages(channel_id, media_kind, created_at desc);
create index if not exists idx_chat_message_reactions_user on public.chat_message_reactions(user_id, created_at desc);

alter table public.chat_message_reactions enable row level security;

grant select, insert, delete on public.chat_message_reactions to authenticated;

drop policy if exists "chat_reactions_select_all" on public.chat_message_reactions;
create policy "chat_reactions_select_all"
on public.chat_message_reactions
for select
to authenticated
using (true);

drop policy if exists "chat_reactions_insert_own" on public.chat_message_reactions;
create policy "chat_reactions_insert_own"
on public.chat_message_reactions
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.users u
    where u.id = (select auth.uid())
      and u.participant_status = 'active'
  )
);

drop policy if exists "chat_reactions_delete_own_or_admin" on public.chat_message_reactions;
create policy "chat_reactions_delete_own_or_admin"
on public.chat_message_reactions
for delete
to authenticated
using (
  user_id = (select auth.uid())
  or public.is_admin((select auth.uid()))
);

drop trigger if exists trg_chat_updated_at on public.chat_messages;
create trigger trg_chat_updated_at
before update on public.chat_messages
for each row execute function public.set_updated_at();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-media',
  'chat-media',
  true,
  26214400,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'audio/webm',
    'audio/ogg',
    'audio/mpeg',
    'audio/mp4',
    'audio/wav',
    'audio/x-wav',
    'video/webm',
    'video/mp4',
    'video/quicktime',
    'video/x-matroska',
    'video/x-msvideo',
    'video/avi',
    'video/mpeg',
    'video/3gpp',
    'video/x-ms-wmv'
  ]
)
on conflict (id) do update set
  public = true,
  file_size_limit = 26214400,
  allowed_mime_types = excluded.allowed_mime_types,
  updated_at = now();

drop policy if exists chat_media_insert_own on storage.objects;
create policy chat_media_insert_own
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'chat-media'
  and (storage.foldername(name))[1] = 'chat'
  and (storage.foldername(name))[3] = (select auth.uid())::text
);

drop policy if exists chat_media_update_own on storage.objects;
create policy chat_media_update_own
on storage.objects
for update
to authenticated
using (
  bucket_id = 'chat-media'
  and (storage.foldername(name))[1] = 'chat'
  and (storage.foldername(name))[3] = (select auth.uid())::text
)
with check (
  bucket_id = 'chat-media'
  and (storage.foldername(name))[1] = 'chat'
  and (storage.foldername(name))[3] = (select auth.uid())::text
);

drop policy if exists chat_media_delete_own_or_admin on storage.objects;
create policy chat_media_delete_own_or_admin
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'chat-media'
  and (
    (storage.foldername(name))[3] = (select auth.uid())::text
    or public.is_admin((select auth.uid()))
  )
);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'chat_message_reactions'
  ) then
    alter publication supabase_realtime add table public.chat_message_reactions;
  end if;
end $$;
