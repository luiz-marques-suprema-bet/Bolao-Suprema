-- Bolao Suprema internal product governance
-- Additive migration: preserves existing data, buckets and legacy URLs.

create extension if not exists "uuid-ossp";

alter table public.users
  add column if not exists participant_status text not null default 'active'
    check (participant_status in ('pending','active','blocked','removed')),
  add column if not exists user_role text not null default 'user'
    check (user_role in ('user','marketing','admin','owner')),
  add column if not exists is_owner boolean not null default false,
  add column if not exists privacy_hide_email boolean not null default true,
  add column if not exists privacy_hide_profile boolean not null default false,
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by uuid references public.users(id),
  add column if not exists blocked_at timestamptz,
  add column if not exists removed_at timestamptz;

update public.users
set user_role = case
    when is_owner then 'owner'
    when is_admin then 'admin'
    when is_marketing then 'marketing'
    else user_role
  end
where user_role = 'user';

create table if not exists public.audit_logs (
  id uuid primary key default uuid_generate_v4(),
  actor_user_id uuid references public.users(id),
  action text not null,
  entity_type text not null,
  entity_id text,
  before jsonb,
  after jsonb,
  ip text,
  user_agent text,
  created_at timestamptz not null default now()
);

create table if not exists public.participant_invites (
  id uuid primary key default uuid_generate_v4(),
  code text not null unique,
  label text not null default 'Convite Bolao Suprema',
  created_by uuid references public.users(id),
  max_uses integer,
  used_count integer not null default 0,
  expires_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.scoring_rules (
  id text primary key,
  label text not null,
  category text not null,
  stage text not null default 'all',
  points integer not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  updated_by uuid references public.users(id),
  updated_at timestamptz not null default now()
);

insert into public.scoring_rules (id, label, category, stage, points, sort_order)
values
  ('group_exact','Placar exato','match','group',10,10),
  ('group_score1','Resultado + gols de 1 time','match','group',7,20),
  ('group_result','Acerto do vencedor/empate','match','group',5,30),
  ('group_goals1','Gols de uma equipe','match','group',1,40),
  ('ko_exact','Placar exato no mata-mata','match','knockout',12,50),
  ('ko_score1','Resultado + gols no mata-mata','match','knockout',8,60),
  ('ko_result','Resultado no mata-mata','match','knockout',5,70),
  ('ko_qualified','Classificado correto','match','knockout',2,80),
  ('champion','Campeao','general','all',25,90),
  ('vice','Vice-campeao','general','all',15,100),
  ('scorer','Artilheiro','general','all',10,110)
on conflict (id) do update set
  label = excluded.label,
  category = excluded.category,
  stage = excluded.stage,
  points = excluded.points,
  sort_order = excluded.sort_order,
  updated_at = now();

create table if not exists public.notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.users(id) on delete cascade,
  channel text not null default 'in_app' check (channel in ('in_app','email','whatsapp','push')),
  type text not null,
  title text not null,
  body text not null default '',
  entity_type text,
  entity_id text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.bracket_round_locks (
  round text primary key check (round in ('r32','r16','qf','sf','third','final')),
  locked_at timestamptz not null default now(),
  locked_by uuid references public.users(id),
  reason text
);

create table if not exists public.ranking_breakdowns (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  source_type text not null check (source_type in ('match','general','bonus','adjustment')),
  source_id text not null,
  label text not null,
  points integer not null default 0,
  details jsonb not null default '{}'::jsonb,
  calculated_at timestamptz not null default now(),
  unique (user_id, source_type, source_id)
);

create table if not exists public.regulation_versions (
  id uuid primary key default uuid_generate_v4(),
  version_label text not null,
  title text not null,
  body text not null,
  published_by uuid references public.users(id),
  published_at timestamptz not null default now()
);

create table if not exists public.system_events (
  id uuid primary key default uuid_generate_v4(),
  level text not null default 'info' check (level in ('info','warn','error')),
  area text not null,
  message text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.chat_messages
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.users(id),
  add column if not exists is_important boolean not null default false;

alter table public.chat_messages
  drop constraint if exists chat_messages_text_size;
alter table public.chat_messages
  add constraint chat_messages_text_size check (char_length(coalesce(text, '')) <= 1000);

create index if not exists idx_audit_logs_actor_created on public.audit_logs(actor_user_id, created_at desc);
create index if not exists idx_audit_logs_entity on public.audit_logs(entity_type, entity_id, created_at desc);
create index if not exists idx_notifications_user_read on public.notifications(user_id, read_at, created_at desc);
create index if not exists idx_ranking_breakdowns_user on public.ranking_breakdowns(user_id, calculated_at desc);
create index if not exists idx_bulletins_author_id on public.bulletins(author_id);
create index if not exists idx_channel_pins_message_id on public.channel_pins(message_id);
create index if not exists idx_channel_pins_pinned_by on public.channel_pins(pinned_by);
create index if not exists idx_poll_votes_user_id on public.poll_votes(user_id);
create index if not exists idx_users_participant_status on public.users(participant_status);
create index if not exists idx_users_user_role on public.users(user_role);
create index if not exists idx_chat_messages_deleted_at on public.chat_messages(deleted_at);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, participant_status)
  values (new.id, new.email, 'pending')
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function public.auto_grant_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email = 'joao.silva@suprema.group' then
    new.is_admin := true;
    new.is_marketing := true;
    new.is_owner := true;
    new.user_role := 'owner';
    new.participant_status := 'active';
  end if;
  if new.is_owner then
    new.user_role := 'owner';
    new.is_admin := true;
    new.is_marketing := true;
  elsif new.is_admin then
    new.user_role := 'admin';
  elsif new.is_marketing then
    new.user_role := 'marketing';
  end if;
  return new;
end;
$$;

create or replace function public.is_admin(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users
    where id = uid
      and participant_status = 'active'
      and (is_admin = true or is_owner = true or user_role in ('admin','owner'))
  );
$$;

create or replace function public.is_marketing(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users
    where id = uid
      and participant_status = 'active'
      and (is_marketing = true or is_admin = true or is_owner = true or user_role in ('marketing','admin','owner'))
  );
$$;

create or replace function public.is_owner(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users
    where id = uid
      and participant_status = 'active'
      and (is_owner = true or user_role = 'owner')
  );
$$;

create or replace function public.log_audit(
  p_action text,
  p_entity_type text,
  p_entity_id text default null,
  p_before jsonb default null,
  p_after jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  insert into public.audit_logs(actor_user_id, action, entity_type, entity_id, before, after)
  values (auth.uid(), p_action, p_entity_type, p_entity_id, p_before, p_after)
  returning id into new_id;
  return new_id;
end;
$$;

create or replace function public.ensure_active_participant()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.users
    where id = new.user_id
      and participant_status = 'active'
  ) then
    raise exception 'Participante pendente, bloqueado ou removido.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_predictions_active_participant on public.predictions;
create trigger trg_predictions_active_participant
before insert or update on public.predictions
for each row execute function public.ensure_active_participant();

drop trigger if exists trg_chat_active_participant on public.chat_messages;
create trigger trg_chat_active_participant
before insert or update on public.chat_messages
for each row execute function public.ensure_active_participant();

create or replace function public.audit_prediction_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  perform public.log_audit(
    case when tg_op = 'INSERT' then 'prediction_created' else 'prediction_updated' end,
    'prediction',
    coalesce(new.id, old.id)::text,
    case when tg_op = 'UPDATE' then to_jsonb(old) else null end,
    to_jsonb(new)
  );
  return new;
end;
$$;

drop trigger if exists trg_audit_prediction_change on public.predictions;
create trigger trg_audit_prediction_change
after insert or update on public.predictions
for each row execute function public.audit_prediction_change();

create or replace function public.calculate_prediction_points(
  p_home integer,
  p_away integer,
  r_home integer,
  r_away integer,
  p_stage text default 'group'
)
returns integer
language plpgsql
stable
set search_path = public
as $$
declare
  exact_points integer;
  score1_points integer;
  result_points integer;
  goals1_points integer;
  same_outcome boolean;
  one_team boolean;
begin
  select points into exact_points from public.scoring_rules where id = case when p_stage = 'group' then 'group_exact' else 'ko_exact' end;
  select points into score1_points from public.scoring_rules where id = case when p_stage = 'group' then 'group_score1' else 'ko_score1' end;
  select points into result_points from public.scoring_rules where id = case when p_stage = 'group' then 'group_result' else 'ko_result' end;
  select points into goals1_points from public.scoring_rules where id = 'group_goals1';

  if p_home = r_home and p_away = r_away then
    return coalesce(exact_points, 10);
  end if;

  same_outcome :=
    (p_home = p_away and r_home = r_away)
    or (p_home > p_away and r_home > r_away)
    or (p_home < p_away and r_home < r_away);
  one_team := p_home = r_home or p_away = r_away;

  if same_outcome and one_team then
    return coalesce(score1_points, 7);
  elsif same_outcome then
    return coalesce(result_points, 5);
  elsif p_stage = 'group' and one_team then
    return coalesce(goals1_points, 1);
  end if;

  return 0;
end;
$$;

create or replace function public.refresh_ranking_snapshots()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.ranking_breakdowns where source_type = 'match';

  insert into public.ranking_breakdowns(user_id, source_type, source_id, label, points, details)
  select
    p.user_id,
    'match',
    p.match_code,
    concat(m.home_code, ' x ', m.away_code),
    coalesce(p.points_earned, 0),
    jsonb_build_object('home_score', p.home_score, 'away_score', p.away_score, 'match_code', p.match_code)
  from public.predictions p
  join public.matches m on m.match_code = p.match_code
  where p.match_code is not null
  on conflict (user_id, source_type, source_id) do update set
    points = excluded.points,
    details = excluded.details,
    calculated_at = now();

  insert into public.ranking_snapshots(user_id, rank, pts, mov, correct, exact_score, streak)
  select
    user_id,
    row_number() over (order by sum(points) desc, user_id)::int,
    sum(points)::int,
    '—',
    count(*) filter (where points > 0)::int,
    count(*) filter (where points >= coalesce((select points from public.scoring_rules where id = 'group_exact'), 10))::int,
    0
  from public.ranking_breakdowns
  group by user_id;

  perform public.log_audit('ranking_refreshed', 'ranking', null, null, null);
end;
$$;

create or replace function public.set_match_market_status(
  p_match_code text,
  p_market_status text,
  p_reason text default null
)
returns public.matches
language plpgsql
security definer
set search_path = public
as $$
declare
  before_row public.matches%rowtype;
  after_row public.matches%rowtype;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Apenas admin pode alterar mercado.';
  end if;
  if p_market_status not in ('open','locked','closed','settled') then
    raise exception 'Status de mercado invalido.';
  end if;

  select * into before_row from public.matches where match_code = p_match_code;
  if not found then
    raise exception 'Partida nao encontrada.';
  end if;

  update public.matches
  set market_status = p_market_status,
      locked_at = case when p_market_status = 'locked' then now() else locked_at end,
      locked_by = case when p_market_status = 'locked' then auth.uid() else locked_by end,
      lock_reason = case when p_market_status = 'locked' then coalesce(p_reason, 'admin_lock') else lock_reason end,
      unlocked_at = case when p_market_status = 'open' then now() else unlocked_at end,
      settled_at = case when p_market_status = 'settled' then now() else settled_at end
  where match_code = p_match_code
  returning * into after_row;

  perform public.log_audit('market_' || p_market_status, 'match', p_match_code, to_jsonb(before_row), to_jsonb(after_row));
  return after_row;
end;
$$;

create or replace function public.settle_match_result(
  p_match_code text,
  p_home_score integer,
  p_away_score integer
)
returns public.matches
language plpgsql
security definer
set search_path = public
as $$
declare
  before_row public.matches%rowtype;
  after_row public.matches%rowtype;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Apenas admin pode apurar resultado.';
  end if;

  select * into before_row from public.matches where match_code = p_match_code;
  if not found then
    raise exception 'Partida nao encontrada.';
  end if;

  update public.matches
  set home_score = p_home_score,
      away_score = p_away_score,
      status = 'finished',
      market_status = 'settled',
      settled_at = now(),
      winner = case
        when p_home_score > p_away_score then home_code
        when p_home_score < p_away_score then away_code
        else 'draw'
      end
  where match_code = p_match_code
  returning * into after_row;

  update public.predictions p
  set points_earned = public.calculate_prediction_points(p.home_score, p.away_score, p_home_score, p_away_score, before_row.stage)
  where p.match_code = p_match_code;

  perform public.refresh_ranking_snapshots();
  perform public.log_audit('match_settled', 'match', p_match_code, to_jsonb(before_row), to_jsonb(after_row));
  return after_row;
end;
$$;

create or replace function public.moderate_chat_message(
  p_message_id uuid,
  p_action text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  before_row public.chat_messages%rowtype;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Apenas admin pode moderar a Resenha.';
  end if;
  select * into before_row from public.chat_messages where id = p_message_id;
  if not found then return; end if;

  if p_action = 'delete' then
    update public.chat_messages set deleted_at = now(), deleted_by = auth.uid(), text = '[mensagem removida pela administracao]', gif_url = null, poll_data = null where id = p_message_id;
  elsif p_action = 'important' then
    update public.chat_messages set is_important = true where id = p_message_id;
  end if;
  perform public.log_audit('chat_' || p_action, 'chat_message', p_message_id::text, to_jsonb(before_row), null);
end;
$$;

create or replace function public.update_participant_status(
  p_user_id uuid,
  p_status text
)
returns public.users
language plpgsql
security definer
set search_path = public
as $$
declare
  before_row public.users%rowtype;
  after_row public.users%rowtype;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Apenas admin pode gerenciar participantes.';
  end if;
  if p_status not in ('pending','active','blocked','removed') then
    raise exception 'Status invalido.';
  end if;

  select * into before_row from public.users where id = p_user_id;
  if not found then raise exception 'Usuario nao encontrado.'; end if;

  update public.users
  set participant_status = p_status,
      approved_at = case when p_status = 'active' then now() else approved_at end,
      approved_by = case when p_status = 'active' then auth.uid() else approved_by end,
      blocked_at = case when p_status = 'blocked' then now() else blocked_at end,
      removed_at = case when p_status = 'removed' then now() else removed_at end
  where id = p_user_id
  returning * into after_row;

  perform public.log_audit('participant_' || p_status, 'user', p_user_id::text, to_jsonb(before_row), to_jsonb(after_row));
  return after_row;
end;
$$;

create or replace view public.system_health as
select
  (select count(*) from public.users) as users_total,
  (select count(*) from public.users where participant_status = 'pending') as users_pending,
  (select count(*) from public.predictions) as predictions_total,
  (select count(*) from public.chat_messages where deleted_at is null) as chat_messages_total,
  (select count(*) from public.bulletins) as bulletins_total,
  (select count(*) from public.matches where market_status = 'open') as markets_open,
  (select count(*) from public.matches where market_status = 'locked') as markets_locked,
  (select count(*) from public.matches where kickoff_utc is null) as matches_without_kickoff,
  (select max(snapshot_at) from public.ranking_snapshots) as last_ranking_refresh;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 5242880, array['image/jpeg','image/png','image/webp','image/gif']),
  ('banners', 'banners', true, 5242880, array['image/jpeg','image/png','image/webp','image/gif']),
  ('bulletins', 'bulletins', true, 5242880, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif'],
  updated_at = now();

alter table public.audit_logs enable row level security;
alter table public.participant_invites enable row level security;
alter table public.scoring_rules enable row level security;
alter table public.notifications enable row level security;
alter table public.bracket_round_locks enable row level security;
alter table public.ranking_breakdowns enable row level security;
alter table public.regulation_versions enable row level security;
alter table public.system_events enable row level security;

drop policy if exists "audit_admin_select" on public.audit_logs;
create policy "audit_admin_select" on public.audit_logs for select to authenticated using (public.is_admin((select auth.uid())));

drop policy if exists "invites_admin_all" on public.participant_invites;
create policy "invites_admin_all" on public.participant_invites for all to authenticated using (public.is_admin((select auth.uid()))) with check (public.is_admin((select auth.uid())));

drop policy if exists "scoring_select_all" on public.scoring_rules;
create policy "scoring_select_all" on public.scoring_rules for select to authenticated using (true);
drop policy if exists "scoring_admin_write" on public.scoring_rules;
create policy "scoring_admin_write" on public.scoring_rules for all to authenticated using (public.is_admin((select auth.uid()))) with check (public.is_admin((select auth.uid())));

drop policy if exists "notifications_own_select" on public.notifications;
create policy "notifications_own_select" on public.notifications for select to authenticated using (user_id = (select auth.uid()) or public.is_admin((select auth.uid())));
drop policy if exists "notifications_own_update" on public.notifications;
create policy "notifications_own_update" on public.notifications for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "bracket_locks_select_all" on public.bracket_round_locks;
create policy "bracket_locks_select_all" on public.bracket_round_locks for select to authenticated using (true);
drop policy if exists "bracket_locks_admin_all" on public.bracket_round_locks;
create policy "bracket_locks_admin_all" on public.bracket_round_locks for all to authenticated using (public.is_admin((select auth.uid()))) with check (public.is_admin((select auth.uid())));

drop policy if exists "ranking_breakdowns_select_all" on public.ranking_breakdowns;
create policy "ranking_breakdowns_select_all" on public.ranking_breakdowns for select to authenticated using (true);
drop policy if exists "ranking_breakdowns_admin_all" on public.ranking_breakdowns;
create policy "ranking_breakdowns_admin_all" on public.ranking_breakdowns for all to authenticated using (public.is_admin((select auth.uid()))) with check (public.is_admin((select auth.uid())));

drop policy if exists "regulation_select_all" on public.regulation_versions;
create policy "regulation_select_all" on public.regulation_versions for select to authenticated using (true);
drop policy if exists "regulation_admin_all" on public.regulation_versions;
create policy "regulation_admin_all" on public.regulation_versions for all to authenticated using (public.is_admin((select auth.uid())) or public.is_marketing((select auth.uid()))) with check (public.is_admin((select auth.uid())) or public.is_marketing((select auth.uid())));

drop policy if exists "system_events_admin_select" on public.system_events;
create policy "system_events_admin_select" on public.system_events for select to authenticated using (public.is_admin((select auth.uid())));

drop policy if exists "storage_public_legacy_read" on storage.objects;
create policy "storage_public_legacy_read" on storage.objects for select to public using (bucket_id in ('avatars','banners','bulletins','user-media'));
drop policy if exists "storage_avatars_owner_write" on storage.objects;
create policy "storage_avatars_owner_write" on storage.objects for insert to authenticated with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "storage_avatars_owner_update" on storage.objects;
create policy "storage_avatars_owner_update" on storage.objects for update to authenticated using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text) with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "storage_banners_owner_write" on storage.objects;
create policy "storage_banners_owner_write" on storage.objects for insert to authenticated with check (bucket_id = 'banners' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "storage_banners_owner_update" on storage.objects;
create policy "storage_banners_owner_update" on storage.objects for update to authenticated using (bucket_id = 'banners' and (storage.foldername(name))[1] = (select auth.uid())::text) with check (bucket_id = 'banners' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "storage_bulletins_marketing_write" on storage.objects;
create policy "storage_bulletins_marketing_write" on storage.objects for insert to authenticated with check (bucket_id = 'bulletins' and public.is_marketing((select auth.uid())));
drop policy if exists "storage_bulletins_marketing_update" on storage.objects;
create policy "storage_bulletins_marketing_update" on storage.objects for update to authenticated using (bucket_id = 'bulletins' and public.is_marketing((select auth.uid()))) with check (bucket_id = 'bulletins' and public.is_marketing((select auth.uid())));

revoke execute on function public.auto_grant_admin() from anon, authenticated;
revoke execute on function public.handle_new_user() from anon, authenticated;
revoke execute on function public.rls_auto_enable() from anon, authenticated;
grant execute on function public.is_admin(uuid) to authenticated;
grant execute on function public.is_marketing(uuid) to authenticated;
grant execute on function public.is_owner(uuid) to authenticated;
grant execute on function public.set_match_market_status(text,text,text) to authenticated;
grant execute on function public.settle_match_result(text,integer,integer) to authenticated;
grant execute on function public.refresh_ranking_snapshots() to authenticated;
grant execute on function public.moderate_chat_message(uuid,text) to authenticated;
grant execute on function public.update_participant_status(uuid,text) to authenticated;

insert into public.regulation_versions(version_label, title, body)
select 'v1', 'Regulamento inicial', 'Regulamento oficial do Bolao Suprema publicado no aplicativo. Horarios sempre em Horario de Brasilia; palpites fecham no kickoff; mercados podem ser bloqueados por admin; ranking segue regras configuraveis.'
where not exists (select 1 from public.regulation_versions where version_label = 'v1');
