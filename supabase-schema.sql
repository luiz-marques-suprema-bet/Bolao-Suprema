-- ============================================================
-- BOLÃO SUPREMA · Schema PostgreSQL (Supabase)
-- Execute no SQL Editor do Supabase Dashboard
-- ============================================================
-- Este arquivo é idempotente (IF NOT EXISTS / OR REPLACE).
-- Pode ser executado em DB novo ou já existente.
-- ============================================================

-- ── Extensions ───────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ══════════════════════════════════════════════════════════════
-- TABELAS
-- ══════════════════════════════════════════════════════════════

-- ── Users ────────────────────────────────────────────────────
create table if not exists public.users (
  id                  uuid primary key references auth.users(id) on delete cascade,
  email               text not null unique,
  first_name          text not null default '',
  last_name           text not null default '',
  dept                text not null default '',
  initials            text not null default '',
  color               text not null default '#00A651',
  avatar_url          text,
  banner_url          text,
  bio                 text,
  favorite_team       text,
  favorite_player     text,
  favorite_player_img text,
  champion_pick       text,
  vice_pick           text,
  scorer_pick         text,
  since               text not null default extract(year from now())::text,
  is_admin            boolean not null default false,
  is_marketing        boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Migration: add is_marketing if column doesn't exist (existing DBs)
do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'users' and column_name = 'is_marketing'
  ) then
    alter table public.users add column is_marketing boolean not null default false;
  end if;
end $$;

-- ── Matches ───────────────────────────────────────────────────
create table if not exists public.matches (
  id          uuid primary key default uuid_generate_v4(),
  match_code  text unique,     -- e.g. 'g-a-1'  (matches wc2026.ts IDs)
  stage       text not null check (stage in ('group','round_of_32','round_of_16','quarter_final','semi_final','third_place','final')),
  stage_label text not null,   -- e.g. 'GRUPO A · MD1'
  group_code  text,            -- 'A'…'L' for group stage
  matchday    int,             -- 1, 2 or 3 for group stage
  home_code   text not null,
  away_code   text not null,
  home_score  int,
  away_score  int,
  match_date  text not null,   -- display string: 'QUI 11 JUN'
  match_time  text not null,   -- BRT display: '17:00'
  kickoff_utc timestamptz,
  venue       text not null,
  status      text not null default 'scheduled' check (status in ('scheduled','open','live','finished','locked')),
  market_status text not null default 'open' check (market_status in ('open','locked','closed','settled')),
  locked_at   timestamptz,
  locked_by   uuid references public.users(id) on delete set null,
  lock_reason text,
  unlocked_at timestamptz,
  settled_at  timestamptz,
  live_minute text,
  winner      text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Migration: add match_code / group_code / matchday if missing
do $$ begin
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='matches' and column_name='match_code') then
    alter table public.matches add column match_code text unique;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='matches' and column_name='group_code') then
    alter table public.matches add column group_code text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='matches' and column_name='matchday') then
    alter table public.matches add column matchday int;
  end if;
end $$;

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
  round         text not null check (round in ('r32','r16','qf','sf','third','final')),
  picked_winner text not null,
  locked_at     timestamptz,
  is_correct    boolean,
  created_at    timestamptz not null default now(),
  unique (user_id, slot_id)
);

-- ── Bulletins ─────────────────────────────────────────────────
create table if not exists public.bulletins (
  id          uuid primary key default uuid_generate_v4(),
  label       text not null default 'INFO',
  title       text not null,
  subtitle    text,
  body        text not null,
  image_url   text,
  image_fit_mode text not null default 'contain' check (image_fit_mode in ('cover','contain')),
  author_id   uuid not null references public.users(id) on delete cascade,
  author_name text not null,
  is_pinned   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
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
create table if not exists public.poll_votes (
  message_id uuid not null references public.chat_messages(id) on delete cascade,
  user_id    uuid not null references public.users(id) on delete cascade,
  option_id  text not null,
  created_at timestamptz not null default now(),
  voted_at   timestamptz,
  primary key (message_id, user_id)
);

-- ── Channel Pins ──────────────────────────────────────────────
create table if not exists public.channel_pins (
  channel_id  text primary key,
  message_id  uuid not null references public.chat_messages(id) on delete cascade,
  pinned_by   uuid not null references public.users(id) on delete cascade,
  pinned_at   timestamptz not null default now()
);

-- ── Ranking Snapshots ─────────────────────────────────────────
create table if not exists public.ranking_snapshots (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references public.users(id) on delete cascade,
  pts        int not null default 0,
  correct    int not null default 0,
  exact_score int not null default 0,
  rank       int,
  snapshot_at timestamptz not null default now()
);

-- ══════════════════════════════════════════════════════════════
-- INDEXES (performance para 300+ usuários)
-- ══════════════════════════════════════════════════════════════

create index if not exists idx_predictions_user_id      on public.predictions(user_id);
create index if not exists idx_predictions_match_id     on public.predictions(match_id);
create index if not exists idx_predictions_match_code   on public.predictions(match_code);
create index if not exists idx_chat_messages_channel    on public.chat_messages(channel_id, created_at desc);
create index if not exists idx_chat_messages_user_id    on public.chat_messages(user_id);
create index if not exists idx_poll_votes_message_id    on public.poll_votes(message_id);
create index if not exists idx_bracket_picks_user_id    on public.bracket_picks(user_id);
create index if not exists idx_ranking_user_id          on public.ranking_snapshots(user_id, snapshot_at desc);
create index if not exists idx_bulletins_pinned         on public.bulletins(is_pinned, created_at desc);
create index if not exists idx_matches_status           on public.matches(status);
create index if not exists idx_matches_group            on public.matches(group_code, matchday);
create index if not exists idx_matches_locked_by        on public.matches(locked_by);

-- ══════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ══════════════════════════════════════════════════════════════

alter table public.users            enable row level security;
alter table public.matches          enable row level security;
alter table public.predictions      enable row level security;
alter table public.bracket_picks    enable row level security;
alter table public.bulletins        enable row level security;
alter table public.chat_messages    enable row level security;
alter table public.poll_votes       enable row level security;
alter table public.channel_pins     enable row level security;
alter table public.ranking_snapshots enable row level security;

-- Drop existing policies to avoid conflicts on re-run
do $$ declare r record; begin
  for r in select policyname, tablename from pg_policies where schemaname = 'public' loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- Users
create policy "users_select_all"    on public.users for select to authenticated using (true);
create policy "users_insert_own"    on public.users for insert to authenticated with check (auth.uid() = id);
create policy "users_update_own"    on public.users for update to authenticated using (auth.uid() = id);

-- Matches
create policy "matches_select_all"  on public.matches for select to authenticated using (true);
create policy "matches_admin_write" on public.matches for all to authenticated
  using  ((select is_admin from public.users where id = auth.uid()))
  with check ((select is_admin from public.users where id = auth.uid()));

-- Predictions
create policy "predictions_select_all"  on public.predictions for select to authenticated using (true);
create policy "predictions_own_write"   on public.predictions for insert to authenticated with check (user_id = auth.uid());
create policy "predictions_own_update"  on public.predictions for update to authenticated using (user_id = auth.uid());
create policy "predictions_own_delete"  on public.predictions for delete to authenticated using (user_id = auth.uid());

-- Bracket Picks
create policy "bracket_select_all"  on public.bracket_picks for select to authenticated using (true);
create policy "bracket_own_write"   on public.bracket_picks for insert to authenticated with check (user_id = auth.uid());
create policy "bracket_own_update"  on public.bracket_picks for update to authenticated using (user_id = auth.uid());
create policy "bracket_own_delete"  on public.bracket_picks for delete to authenticated using (user_id = auth.uid());

-- Bulletins
create policy "bulletins_select_all"       on public.bulletins for select to authenticated using (true);
create policy "bulletins_write_privileged" on public.bulletins for all to authenticated
  using (
    (select is_admin or is_marketing from public.users where id = auth.uid())
  )
  with check (
    (select is_admin or is_marketing from public.users where id = auth.uid())
  );

-- Chat
create policy "chat_select_all"   on public.chat_messages for select to authenticated using (true);
create policy "chat_insert_own"   on public.chat_messages for insert to authenticated with check (user_id = auth.uid());
create policy "chat_delete_own"   on public.chat_messages for delete to authenticated using (
  user_id = auth.uid() or
  (select is_admin from public.users where id = auth.uid())
);

-- Poll votes
create policy "poll_votes_select_all" on public.poll_votes for select to authenticated using (true);
create policy "poll_votes_own_upsert" on public.poll_votes for insert to authenticated with check (user_id = auth.uid());
create policy "poll_votes_own_update" on public.poll_votes for update to authenticated using (user_id = auth.uid());

-- Channel pins
create policy "pins_select_all"   on public.channel_pins for select to authenticated using (true);
create policy "pins_admin_write"  on public.channel_pins for all to authenticated
  using  ((select is_admin from public.users where id = auth.uid()))
  with check ((select is_admin from public.users where id = auth.uid()));

-- Ranking
create policy "ranking_select_all"  on public.ranking_snapshots for select to authenticated using (true);
create policy "ranking_admin_write" on public.ranking_snapshots for all to authenticated
  using  ((select is_admin from public.users where id = auth.uid()))
  with check ((select is_admin from public.users where id = auth.uid()));

-- ══════════════════════════════════════════════════════════════
-- REALTIME
-- ══════════════════════════════════════════════════════════════

-- Habilitar Realtime para as tabelas relevantes.
-- Alternativa: vá em Database → Replication e ative as tabelas na UI.

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='chat_messages') then
    alter publication supabase_realtime add table public.chat_messages;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='bulletins') then
    alter publication supabase_realtime add table public.bulletins;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='poll_votes') then
    alter publication supabase_realtime add table public.poll_votes;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='channel_pins') then
    alter publication supabase_realtime add table public.channel_pins;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='matches') then
    alter publication supabase_realtime add table public.matches;
  end if;
end $$;

-- ══════════════════════════════════════════════════════════════
-- TRIGGER: Auto-admin para joao.silva@suprema.group
-- ══════════════════════════════════════════════════════════════

create or replace function public.auto_grant_admin()
returns trigger language plpgsql security definer as $$
begin
  if new.email = 'joao.silva@suprema.group' then
    new.is_admin     := true;
    new.is_marketing := true;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_auto_grant_admin on public.users;
create trigger trg_auto_grant_admin
  before insert or update of email on public.users
  for each row execute function public.auto_grant_admin();

-- Garante o acesso caso o usuário já exista
update public.users
set is_admin = true, is_marketing = true
where email = 'joao.silva@suprema.group';

-- ══════════════════════════════════════════════════════════════
-- FUNÇÃO: updated_at automático
-- ══════════════════════════════════════════════════════════════

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_users_updated_at    on public.users;
drop trigger if exists trg_matches_updated_at  on public.matches;
drop trigger if exists trg_bulletins_updated_at on public.bulletins;

create trigger trg_users_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

create trigger trg_matches_updated_at
  before update on public.matches
  for each row execute function public.set_updated_at();

create trigger trg_bulletins_updated_at
  before update on public.bulletins
  for each row execute function public.set_updated_at();

-- ══════════════════════════════════════════════════════════════
-- CALENDÁRIO COPA DO MUNDO 2026 — FASE DE GRUPOS (72 partidas)
-- Horários em BRT (UTC-3)
-- Execute apenas uma vez. Idempotente via ON CONFLICT DO NOTHING.
-- ══════════════════════════════════════════════════════════════

insert into public.matches
  (match_code, stage, stage_label, group_code, matchday, home_code, away_code, match_date, match_time, venue, status)
values
  -- ── MATCHDAY 1 ──────────────────────────────────────────────
  -- June 11 — Grupo A
  ('g-a-1','group','GRUPO A · MD1','A',1,'MEX','RSA','QUI 11 JUN','17:00','Estadio Azteca · Cidade do México','scheduled'),
  ('g-a-2','group','GRUPO A · MD1','A',1,'KOR','CZE','QUI 11 JUN','00:00','Estadio Akron · Guadalajara','scheduled'),
  -- June 12 — Grupos B, D
  ('g-b-1','group','GRUPO B · MD1','B',1,'CAN','BIH','SEX 12 JUN','16:00','BMO Field · Toronto','scheduled'),
  ('g-d-1','group','GRUPO D · MD1','D',1,'USA','PAR','SEX 12 JUN','01:00','SoFi Stadium · Los Angeles','scheduled'),
  -- June 13 — Grupos B, C
  ('g-b-2','group','GRUPO B · MD1','B',1,'QAT','SUI','SAB 13 JUN','19:00','Levi''s Stadium · San Francisco','scheduled'),
  ('g-c-1','group','GRUPO C · MD1','C',1,'BRA','MAR','SAB 13 JUN','19:00','MetLife Stadium · Nova York','scheduled'),
  ('g-c-2','group','GRUPO C · MD1','C',1,'HTI','SCO','SAB 13 JUN','22:00','Gillette Stadium · Boston','scheduled'),
  -- June 14 — Grupos D, E, F
  ('g-d-2','group','GRUPO D · MD1','D',1,'AUS','TUR','DOM 14 JUN','16:00','BC Place · Vancouver','scheduled'),
  ('g-e-1','group','GRUPO E · MD1','E',1,'GER','CUW','DOM 14 JUN','15:00','NRG Stadium · Houston','scheduled'),
  ('g-f-1','group','GRUPO F · MD1','F',1,'NED','JPN','DOM 14 JUN','18:00','AT&T Stadium · Dallas','scheduled'),
  ('g-e-2','group','GRUPO E · MD1','E',1,'CIV','ECU','DOM 14 JUN','20:00','Lincoln Financial Field · Filadélfia','scheduled'),
  ('g-f-2','group','GRUPO F · MD1','F',1,'SWE','TUN','DOM 14 JUN','00:00','Estadio BBVA · Monterrey','scheduled'),
  -- June 15 — Grupos G, H
  ('g-h-1','group','GRUPO H · MD1','H',1,'ESP','CPV','SEG 15 JUN','13:00','Mercedes-Benz Stadium · Atlanta','scheduled'),
  ('g-g-1','group','GRUPO G · MD1','G',1,'BEL','EGY','SEG 15 JUN','19:00','Lumen Field · Seattle','scheduled'),
  ('g-h-2','group','GRUPO H · MD1','H',1,'KSA','URU','SEG 15 JUN','19:00','Hard Rock Stadium · Miami','scheduled'),
  ('g-g-2','group','GRUPO G · MD1','G',1,'IRN','NZL','SEG 15 JUN','01:00','SoFi Stadium · Los Angeles','scheduled'),
  -- June 16 — Grupos I, J
  ('g-i-1','group','GRUPO I · MD1','I',1,'FRA','SEN','TER 16 JUN','16:00','MetLife Stadium · Nova York','scheduled'),
  ('g-i-2','group','GRUPO I · MD1','I',1,'IRQ','NOR','TER 16 JUN','19:00','Gillette Stadium · Boston','scheduled'),
  ('g-j-1','group','GRUPO J · MD1','J',1,'ARG','ALG','TER 16 JUN','23:00','Arrowhead Stadium · Kansas City','scheduled'),
  -- June 17 — Grupos J, K, L
  ('g-j-2','group','GRUPO J · MD1','J',1,'AUT','JOR','QUA 17 JUN','14:00','Levi''s Stadium · San Francisco','scheduled'),
  ('g-k-1','group','GRUPO K · MD1','K',1,'POR','COD','QUA 17 JUN','15:00','NRG Stadium · Houston','scheduled'),
  ('g-l-1','group','GRUPO L · MD1','L',1,'ENG','CRO','QUA 17 JUN','18:00','AT&T Stadium · Dallas','scheduled'),
  ('g-l-2','group','GRUPO L · MD1','L',1,'GHA','PAN','QUA 17 JUN','20:00','BMO Field · Toronto','scheduled'),
  ('g-k-2','group','GRUPO K · MD1','K',1,'UZB','COL','QUA 17 JUN','00:00','Estadio Azteca · Cidade do México','scheduled'),
  -- ── MATCHDAY 2 ──────────────────────────────────────────────
  -- June 18 — Grupos A, B
  ('g-a-3','group','GRUPO A · MD2','A',2,'CZE','RSA','QUI 18 JUN','13:00','Mercedes-Benz Stadium · Atlanta','scheduled'),
  ('g-b-3','group','GRUPO B · MD2','B',2,'SUI','BIH','QUI 18 JUN','19:00','SoFi Stadium · Los Angeles','scheduled'),
  ('g-b-4','group','GRUPO B · MD2','B',2,'CAN','QAT','QUI 18 JUN','22:00','BC Place · Vancouver','scheduled'),
  ('g-a-4','group','GRUPO A · MD2','A',2,'MEX','KOR','QUI 18 JUN','23:00','Estadio Akron · Guadalajara','scheduled'),
  -- June 19 — Grupos C, D
  ('g-d-3','group','GRUPO D · MD2','D',2,'USA','AUS','SEX 19 JUN','19:00','Lumen Field · Seattle','scheduled'),
  ('g-c-3','group','GRUPO C · MD2','C',2,'SCO','MAR','SEX 19 JUN','19:00','Gillette Stadium · Boston','scheduled'),
  ('g-c-4','group','GRUPO C · MD2','C',2,'BRA','HTI','SEX 19 JUN','21:30','Lincoln Financial Field · Filadélfia','scheduled'),
  ('g-d-4','group','GRUPO D · MD2','D',2,'TUR','PAR','SEX 19 JUN','03:00','Levi''s Stadium · San Francisco','scheduled'),
  -- June 20 — Grupos E, F
  ('g-f-3','group','GRUPO F · MD2','F',2,'NED','SWE','SAB 20 JUN','15:00','NRG Stadium · Houston','scheduled'),
  ('g-e-3','group','GRUPO E · MD2','E',2,'GER','CIV','SAB 20 JUN','17:00','BMO Field · Toronto','scheduled'),
  ('g-e-4','group','GRUPO E · MD2','E',2,'ECU','CUW','SAB 20 JUN','22:00','Arrowhead Stadium · Kansas City','scheduled'),
  ('g-f-4','group','GRUPO F · MD2','F',2,'TUN','JPN','SAB 20 JUN','01:00','Estadio BBVA · Monterrey','scheduled'),
  -- June 21 — Grupos G, H
  ('g-h-3','group','GRUPO H · MD2','H',2,'ESP','KSA','DOM 21 JUN','13:00','Mercedes-Benz Stadium · Atlanta','scheduled'),
  ('g-g-3','group','GRUPO G · MD2','G',2,'BEL','IRN','DOM 21 JUN','19:00','SoFi Stadium · Los Angeles','scheduled'),
  ('g-h-4','group','GRUPO H · MD2','H',2,'URU','CPV','DOM 21 JUN','19:00','Hard Rock Stadium · Miami','scheduled'),
  ('g-g-4','group','GRUPO G · MD2','G',2,'NZL','EGY','DOM 21 JUN','01:00','BC Place · Vancouver','scheduled'),
  -- June 22 — Grupos I, J
  ('g-j-3','group','GRUPO J · MD2','J',2,'ARG','AUT','SEG 22 JUN','15:00','AT&T Stadium · Dallas','scheduled'),
  ('g-i-3','group','GRUPO I · MD2','I',2,'FRA','IRQ','SEG 22 JUN','18:00','Lincoln Financial Field · Filadélfia','scheduled'),
  ('g-i-4','group','GRUPO I · MD2','I',2,'NOR','SEN','SEG 22 JUN','21:00','MetLife Stadium · Nova York','scheduled'),
  ('g-j-4','group','GRUPO J · MD2','J',2,'JOR','ALG','SEG 22 JUN','03:00','Levi''s Stadium · San Francisco','scheduled'),
  -- June 23 — Grupos K, L
  ('g-k-3','group','GRUPO K · MD2','K',2,'POR','UZB','TER 23 JUN','15:00','NRG Stadium · Houston','scheduled'),
  ('g-l-3','group','GRUPO L · MD2','L',2,'ENG','GHA','TER 23 JUN','17:00','Gillette Stadium · Boston','scheduled'),
  ('g-l-4','group','GRUPO L · MD2','L',2,'PAN','CRO','TER 23 JUN','20:00','BMO Field · Toronto','scheduled'),
  ('g-k-4','group','GRUPO K · MD2','K',2,'COL','COD','TER 23 JUN','00:00','Estadio Akron · Guadalajara','scheduled'),
  -- ── MATCHDAY 3 (simultâneas por grupo) ──────────────────────
  -- June 24 — Grupos A, B, C
  ('g-b-5','group','GRUPO B · MD3','B',3,'SUI','CAN','QUA 24 JUN','19:00','BC Place · Vancouver','scheduled'),
  ('g-b-6','group','GRUPO B · MD3','B',3,'BIH','QAT','QUA 24 JUN','19:00','Lumen Field · Seattle','scheduled'),
  ('g-c-5','group','GRUPO C · MD3','C',3,'SCO','BRA','QUA 24 JUN','19:00','Hard Rock Stadium · Miami','scheduled'),
  ('g-c-6','group','GRUPO C · MD3','C',3,'MAR','HTI','QUA 24 JUN','19:00','Mercedes-Benz Stadium · Atlanta','scheduled'),
  ('g-a-5','group','GRUPO A · MD3','A',3,'CZE','MEX','QUA 24 JUN','23:00','Estadio Azteca · Cidade do México','scheduled'),
  ('g-a-6','group','GRUPO A · MD3','A',3,'RSA','KOR','QUA 24 JUN','23:00','Estadio BBVA · Monterrey','scheduled'),
  -- June 25 — Grupos D, E, F
  ('g-e-5','group','GRUPO E · MD3','E',3,'CUW','CIV','QUI 25 JUN','17:00','Lincoln Financial Field · Filadélfia','scheduled'),
  ('g-e-6','group','GRUPO E · MD3','E',3,'ECU','GER','QUI 25 JUN','17:00','MetLife Stadium · Nova York','scheduled'),
  ('g-f-5','group','GRUPO F · MD3','F',3,'JPN','SWE','QUI 25 JUN','21:00','AT&T Stadium · Dallas','scheduled'),
  ('g-f-6','group','GRUPO F · MD3','F',3,'TUN','NED','QUI 25 JUN','21:00','Arrowhead Stadium · Kansas City','scheduled'),
  ('g-d-5','group','GRUPO D · MD3','D',3,'TUR','USA','QUI 25 JUN','02:00','SoFi Stadium · Los Angeles','scheduled'),
  ('g-d-6','group','GRUPO D · MD3','D',3,'PAR','AUS','QUI 25 JUN','02:00','Levi''s Stadium · San Francisco','scheduled'),
  -- June 26 — Grupos G, H, I
  ('g-i-5','group','GRUPO I · MD3','I',3,'NOR','FRA','SEX 26 JUN','16:00','Gillette Stadium · Boston','scheduled'),
  ('g-i-6','group','GRUPO I · MD3','I',3,'SEN','IRQ','SEX 26 JUN','16:00','BMO Field · Toronto','scheduled'),
  ('g-h-5','group','GRUPO H · MD3','H',3,'CPV','KSA','SEX 26 JUN','22:00','NRG Stadium · Houston','scheduled'),
  ('g-h-6','group','GRUPO H · MD3','H',3,'URU','ESP','SEX 26 JUN','22:00','Estadio Akron · Guadalajara','scheduled'),
  ('g-g-5','group','GRUPO G · MD3','G',3,'EGY','IRN','SEX 26 JUN','03:00','Lumen Field · Seattle','scheduled'),
  ('g-g-6','group','GRUPO G · MD3','G',3,'NZL','BEL','SEX 26 JUN','03:00','BC Place · Vancouver','scheduled'),
  -- June 27 — Grupos J, K, L
  ('g-l-5','group','GRUPO L · MD3','L',3,'PAN','ENG','SAB 27 JUN','18:00','MetLife Stadium · Nova York','scheduled'),
  ('g-l-6','group','GRUPO L · MD3','L',3,'CRO','GHA','SAB 27 JUN','18:00','Lincoln Financial Field · Filadélfia','scheduled'),
  ('g-k-5','group','GRUPO K · MD3','K',3,'COL','POR','SAB 27 JUN','20:30','Hard Rock Stadium · Miami','scheduled'),
  ('g-k-6','group','GRUPO K · MD3','K',3,'COD','UZB','SAB 27 JUN','20:30','Mercedes-Benz Stadium · Atlanta','scheduled'),
  ('g-j-5','group','GRUPO J · MD3','J',3,'ALG','AUT','SAB 27 JUN','00:00','Arrowhead Stadium · Kansas City','scheduled'),
  ('g-j-6','group','GRUPO J · MD3','J',3,'JOR','ARG','SAB 27 JUN','00:00','AT&T Stadium · Dallas','scheduled')
on conflict (match_code) do nothing;

-- ══════════════════════════════════════════════════════════════
-- ⚙  CONFIGURAÇÃO OTP (fazer no Dashboard do Supabase)
-- ══════════════════════════════════════════════════════════════
-- 1. Authentication → Providers → Email
--    ✓ Enable Email Provider
--    ✓ Disable "Confirm email" (ou manter — OTP funciona dos dois modos)
--    ✓ Enable "Email OTP" (ou "Magic Link" — ambos usam signInWithOtp)
--
-- 2. Authentication → URL Configuration
--    Site URL: https://ojozinho.github.io/Bolao-Suprema
--
-- 3. Authentication → Email Templates → Magic Link
--    Cole o conteúdo do arquivo `email-template.html`
--    Subject: Seu código de acesso ao Bolão Suprema
--
-- 4. Authentication → Rate Limits
--    OTP Rate Limit: 5 por hora por e-mail (default OK)
-- ══════════════════════════════════════════════════════════════
