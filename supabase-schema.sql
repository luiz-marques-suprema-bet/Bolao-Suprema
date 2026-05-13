-- ============================================================
-- BOLÃO SUPREMA · Schema PostgreSQL (Supabase)
-- Execute no SQL Editor do Supabase
-- ============================================================

-- ── Extensions ───────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ── Users ────────────────────────────────────────────────────
create table if not exists public.users (
  id                 uuid primary key references auth.users(id) on delete cascade,
  email              text not null unique,
  first_name         text not null default '',
  last_name          text not null default '',
  dept               text not null default '',
  initials           text not null default '',
  color              text not null default '#00A651',
  avatar_url         text,
  banner_url         text,
  bio                text,
  favorite_team      text,
  favorite_player    text,
  favorite_player_img text,
  champion_pick      text,
  vice_pick          text,
  scorer_pick        text,
  since              text not null default extract(year from now())::text,
  is_admin           boolean not null default false,
  is_marketing       boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- ── Matches ───────────────────────────────────────────────────
create table if not exists public.matches (
  id          uuid primary key default uuid_generate_v4(),
  stage       text not null check (stage in ('group','round_of_16','quarter_final','semi_final','final')),
  stage_label text not null,
  home_code   text not null,
  away_code   text not null,
  home_score  int,
  away_score  int,
  match_date  text not null,
  match_time  text not null,
  venue       text not null,
  status      text not null default 'scheduled' check (status in ('scheduled','open','live','finished','locked')),
  live_minute text,
  winner      text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ── Predictions ──────────────────────────────────────────────
create table if not exists public.predictions (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references public.users(id) on delete cascade,
  match_id      uuid references public.matches(id) on delete cascade,
  match_code    text,
  home_score    int not null default 0,
  away_score    int not null default 0,
  points_earned int,
  submitted_at  timestamptz not null default now(),
  unique (user_id, match_id)
);

create unique index if not exists predictions_user_match_code
  on public.predictions (user_id, match_code)
  where match_code is not null;

-- ── Bracket Picks ─────────────────────────────────────────────
create table if not exists public.bracket_picks (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references public.users(id) on delete cascade,
  slot_id       text not null,
  round         text not null check (round in ('r16','qf','sf','final')),
  picked_winner text not null,
  locked_at     timestamptz,
  is_correct    boolean,
  created_at    timestamptz not null default now(),
  unique (user_id, slot_id)
);

-- ── Chat Messages ─────────────────────────────────────────────
create table if not exists public.chat_messages (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references public.users(id) on delete cascade,
  channel_id text not null default 'geral',
  text       text not null default '',
  type       text not null default 'text' check (type in ('text','gif','poll')),
  gif_url    text,
  poll_data  jsonb,
  reaction   text,
  created_at timestamptz not null default now()
);

-- ── Poll Votes ────────────────────────────────────────────────
-- Votos persistidos separadamente do poll_data para que updates
-- em tempo real funcionem sem reescrever o jsonb inteiro.
create table if not exists public.poll_votes (
  message_id uuid not null references public.chat_messages(id) on delete cascade,
  user_id    uuid not null references public.users(id) on delete cascade,
  option_id  text not null,
  voted_at   timestamptz not null default now(),
  primary key (message_id, user_id)
);

-- ── Channel Pins ──────────────────────────────────────────────
create table if not exists public.channel_pins (
  channel_id  text primary key,
  message_id  uuid references public.chat_messages(id) on delete set null,
  pinned_by   uuid references public.users(id) on delete set null,
  pinned_at   timestamptz not null default now()
);

-- ── Bulletins (Boletim) ───────────────────────────────────────
-- Visível para todos; escrita restrita a admin + marketing.
create table if not exists public.bulletins (
  id          uuid primary key default uuid_generate_v4(),
  label       text not null,
  title       text not null,
  subtitle    text,
  body        text not null,
  image_url   text,
  author_id   uuid not null references public.users(id) on delete cascade,
  author_name text not null,
  is_pinned   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ── Ranking Snapshots ─────────────────────────────────────────
create table if not exists public.ranking_snapshots (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references public.users(id) on delete cascade,
  rank        int not null,
  pts         int not null default 0,
  mov         text not null default '—',
  correct     int not null default 0,
  exact_score int not null default 0,
  streak      int not null default 0,
  snapshot_at timestamptz not null default now()
);

-- ============================================================
-- ÍNDICES (performance para 300+ usuários)
-- ============================================================

create index if not exists idx_predictions_user     on public.predictions (user_id);
create index if not exists idx_predictions_match    on public.predictions (match_id);
create index if not exists idx_chat_channel_time    on public.chat_messages (channel_id, created_at desc);
create index if not exists idx_chat_user            on public.chat_messages (user_id);
create index if not exists idx_poll_votes_message   on public.poll_votes (message_id);
create index if not exists idx_ranking_user         on public.ranking_snapshots (user_id);
create index if not exists idx_ranking_snap_time    on public.ranking_snapshots (snapshot_at desc);
create index if not exists idx_bulletins_pinned     on public.bulletins (is_pinned desc, created_at desc);
create index if not exists idx_bracket_user         on public.bracket_picks (user_id);

-- ============================================================
-- TRIGGERS: updated_at
-- ============================================================

create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace trigger users_updated_at
  before update on public.users
  for each row execute function public.handle_updated_at();

create or replace trigger matches_updated_at
  before update on public.matches
  for each row execute function public.handle_updated_at();

create or replace trigger bulletins_updated_at
  before update on public.bulletins
  for each row execute function public.handle_updated_at();

-- ============================================================
-- TRIGGER: criar perfil ao registrar usuário
-- ============================================================

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.users             enable row level security;
alter table public.matches           enable row level security;
alter table public.predictions       enable row level security;
alter table public.bracket_picks     enable row level security;
alter table public.chat_messages     enable row level security;
alter table public.poll_votes        enable row level security;
alter table public.channel_pins      enable row level security;
alter table public.bulletins         enable row level security;
alter table public.ranking_snapshots enable row level security;

-- ── Users ────────────────────────────────────────────────────
create policy "users_read_all"   on public.users for select using (auth.role() = 'authenticated');
create policy "users_update_own" on public.users for update using (auth.uid() = id);
create policy "users_insert_own" on public.users for insert with check (auth.uid() = id);

-- ── Matches ──────────────────────────────────────────────────
create policy "matches_read_all" on public.matches for select using (true);

-- ── Predictions ──────────────────────────────────────────────
create policy "predictions_read_all"   on public.predictions for select using (auth.role() = 'authenticated');
create policy "predictions_insert_own" on public.predictions for insert with check (auth.uid() = user_id);
create policy "predictions_update_own" on public.predictions for update using (auth.uid() = user_id);

-- ── Bracket Picks ─────────────────────────────────────────────
create policy "bracket_read_all"   on public.bracket_picks for select using (auth.role() = 'authenticated');
create policy "bracket_insert_own" on public.bracket_picks for insert with check (auth.uid() = user_id);
create policy "bracket_update_own" on public.bracket_picks for update using (auth.uid() = user_id);

-- ── Chat Messages ─────────────────────────────────────────────
create policy "chat_read_all"   on public.chat_messages for select using (auth.role() = 'authenticated');
create policy "chat_insert_own" on public.chat_messages for insert with check (auth.uid() = user_id);

-- ── Poll Votes ────────────────────────────────────────────────
create policy "poll_votes_read_all"   on public.poll_votes for select using (auth.role() = 'authenticated');
create policy "poll_votes_insert_own" on public.poll_votes for insert with check (auth.uid() = user_id);
create policy "poll_votes_update_own" on public.poll_votes for update using (auth.uid() = user_id);

-- ── Channel Pins ──────────────────────────────────────────────
create policy "pins_read_all" on public.channel_pins for select using (auth.role() = 'authenticated');
create policy "pins_admin_write" on public.channel_pins for all
  using (
    exists (select 1 from public.users where id = auth.uid() and is_admin = true)
  );

-- ── Bulletins ─────────────────────────────────────────────────
-- Leitura: todos autenticados
-- Escrita: apenas admin OU marketing
create policy "bulletins_read_all" on public.bulletins
  for select using (auth.role() = 'authenticated');

create policy "bulletins_write_privileged" on public.bulletins
  for all using (
    exists (
      select 1 from public.users
      where id = auth.uid()
        and (is_admin = true or is_marketing = true)
    )
  );

-- ── Ranking ───────────────────────────────────────────────────
create policy "ranking_read_all" on public.ranking_snapshots for select using (auth.role() = 'authenticated');

-- ============================================================
-- REALTIME
-- ============================================================

alter publication supabase_realtime add table public.chat_messages;
alter publication supabase_realtime add table public.poll_votes;
alter publication supabase_realtime add table public.channel_pins;
alter publication supabase_realtime add table public.bulletins;
alter publication supabase_realtime add table public.matches;
alter publication supabase_realtime add table public.ranking_snapshots;

-- ============================================================
-- STORAGE: bucket user-media (avatares + banners)
-- ============================================================

insert into storage.buckets (id, name, public)
values ('user-media', 'user-media', true)
on conflict (id) do nothing;

-- Manter bucket legado 'avatars' por compatibilidade
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "media_read_all"   on storage.objects for select using (bucket_id in ('user-media','avatars'));
create policy "media_upload_own" on storage.objects for insert
  with check (bucket_id in ('user-media','avatars') and auth.uid()::text = (storage.foldername(name))[1]);
create policy "media_update_own" on storage.objects for update
  using (bucket_id in ('user-media','avatars') and auth.uid()::text = (storage.foldername(name))[1]);

-- ============================================================
-- MIGRATIONS (rodar se o banco já existia)
-- ============================================================

alter table public.users add column if not exists banner_url          text;
alter table public.users add column if not exists bio                 text;
alter table public.users add column if not exists favorite_player     text;
alter table public.users add column if not exists favorite_player_img text;
alter table public.users add column if not exists vice_pick           text;
alter table public.users add column if not exists scorer_pick         text;
alter table public.users add column if not exists is_marketing        boolean not null default false;

alter table public.chat_messages add column if not exists type      text not null default 'text';
alter table public.chat_messages add column if not exists gif_url   text;
alter table public.chat_messages add column if not exists poll_data jsonb;

alter table public.predictions add column if not exists match_code text;
