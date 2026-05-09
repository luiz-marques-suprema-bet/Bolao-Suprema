-- ============================================================
-- BOLÃO SUPREMA · Schema PostgreSQL (Supabase)
-- Execute no SQL Editor do Supabase
-- ============================================================

-- ── Extensions ───────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ── Users ────────────────────────────────────────────────────
create table if not exists public.users (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text not null unique,
  first_name    text not null default '',
  last_name     text not null default '',
  dept          text not null default '',
  initials      text not null default '',
  color         text not null default '#00A651',
  avatar_url    text,
  favorite_team text,
  champion_pick text,
  since         text not null default extract(year from now())::text,
  is_admin      boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
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
  id             uuid primary key default uuid_generate_v4(),
  user_id        uuid not null references public.users(id) on delete cascade,
  match_id       uuid not null references public.matches(id) on delete cascade,
  home_score     int not null default 0,
  away_score     int not null default 0,
  points_earned  int,
  submitted_at   timestamptz not null default now(),
  unique (user_id, match_id)
);

-- ── Bracket Picks ─────────────────────────────────────────────
create table if not exists public.bracket_picks (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references public.users(id) on delete cascade,
  slot_id         text not null,  -- e.g. 'r16_1', 'qf_2', 'sf_1', 'final_1'
  round           text not null check (round in ('r16','qf','sf','final')),
  picked_winner   text not null,  -- team code
  locked_at       timestamptz,
  is_correct      boolean,
  created_at      timestamptz not null default now(),
  unique (user_id, slot_id)
);

-- ── Chat Messages ─────────────────────────────────────────────
create table if not exists public.chat_messages (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references public.users(id) on delete cascade,
  channel_id  text not null default 'geral',
  text        text not null,
  reaction    text,
  created_at  timestamptz not null default now()
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

alter table public.users          enable row level security;
alter table public.matches        enable row level security;
alter table public.predictions    enable row level security;
alter table public.bracket_picks  enable row level security;
alter table public.chat_messages  enable row level security;
alter table public.ranking_snapshots enable row level security;

-- Users: qualquer autenticado lê todos; cada um edita só o seu
create policy "users_read_all"   on public.users for select using (auth.role() = 'authenticated');
create policy "users_update_own" on public.users for update using (auth.uid() = id);
create policy "users_insert_own" on public.users for insert with check (auth.uid() = id);

-- Matches: todos leem; só admin escreve (via service role)
create policy "matches_read_all" on public.matches for select using (true);

-- Predictions: todos leem; cada um gerencia as suas
create policy "predictions_read_all"   on public.predictions for select using (auth.role() = 'authenticated');
create policy "predictions_insert_own" on public.predictions for insert with check (auth.uid() = user_id);
create policy "predictions_update_own" on public.predictions for update using (auth.uid() = user_id);

-- Bracket picks: todos leem; cada um gerencia os seus
create policy "bracket_read_all"   on public.bracket_picks for select using (auth.role() = 'authenticated');
create policy "bracket_insert_own" on public.bracket_picks for insert with check (auth.uid() = user_id);
create policy "bracket_update_own" on public.bracket_picks for update using (auth.uid() = user_id);

-- Chat: todos autenticados leem e escrevem
create policy "chat_read_all"   on public.chat_messages for select using (auth.role() = 'authenticated');
create policy "chat_insert_own" on public.chat_messages for insert with check (auth.uid() = user_id);

-- Ranking: todos leem
create policy "ranking_read_all" on public.ranking_snapshots for select using (auth.role() = 'authenticated');

-- ============================================================
-- REALTIME: habilitar nas tabelas de leitura em tempo real
-- ============================================================

alter publication supabase_realtime add table public.chat_messages;
alter publication supabase_realtime add table public.matches;
alter publication supabase_realtime add table public.ranking_snapshots;

-- ============================================================
-- STORAGE: bucket para avatares
-- ============================================================

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "avatars_read_all"   on storage.objects for select using (bucket_id = 'avatars');
create policy "avatars_upload_own" on storage.objects for insert
  with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
