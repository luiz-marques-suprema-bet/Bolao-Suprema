-- Bolao Suprema - markets, special picks, knockout placeholders and RPC hardening.

create table if not exists public.markets (
  id uuid primary key default uuid_generate_v4(),
  market_type text not null check (market_type in ('match_prediction','special','bracket_round','group_batch')),
  scope_type text not null,
  scope_id text not null,
  opens_at timestamptz not null default now(),
  closes_at timestamptz not null,
  status text not null default 'open' check (status in ('scheduled','open','locked','closed','settled')),
  lock_reason text,
  source_of_truth text not null default 'database',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (market_type, scope_type, scope_id)
);

create table if not exists public.special_picks (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  market_id uuid not null references public.markets(id) on delete restrict,
  pick_type text not null check (pick_type in ('champion','vice','scorer')),
  team_code text,
  player_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, pick_type),
  check (
    (pick_type in ('champion','vice') and team_code is not null and player_name is null)
    or (pick_type = 'scorer' and player_name is not null and team_code is null)
  )
);

alter table public.markets enable row level security;
alter table public.special_picks enable row level security;

drop policy if exists markets_select_authenticated on public.markets;
create policy markets_select_authenticated
on public.markets for select to authenticated
using (true);

drop policy if exists markets_admin_write on public.markets;
create policy markets_admin_write
on public.markets for all to authenticated
using (public.is_admin((select auth.uid())))
with check (public.is_admin((select auth.uid())));

drop policy if exists special_picks_own_select on public.special_picks;
create policy special_picks_own_select
on public.special_picks for select to authenticated
using (user_id = (select auth.uid()) or public.is_admin((select auth.uid())));

drop policy if exists special_picks_own_write on public.special_picks;
create policy special_picks_own_write
on public.special_picks for insert to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists special_picks_own_update on public.special_picks;
create policy special_picks_own_update
on public.special_picks for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create index if not exists idx_markets_status_closes_at on public.markets(status, closes_at);
create index if not exists idx_special_picks_market_id on public.special_picks(market_id);

insert into public.matches (
  match_code, stage, stage_label, home_code, away_code, match_date, match_time,
  venue, status, kickoff_utc, market_status, lock_reason
)
select *
from (values
  ('ko-r32-1','round_of_32','32 AVOS · 1','TBD','TBD','DOM 28 JUN','14:00','A definir · A definir','scheduled','2026-06-28T17:00:00Z'::timestamptz,'locked','knockout_placeholder'),
  ('ko-r32-2','round_of_32','32 AVOS · 2','TBD','TBD','DOM 28 JUN','17:00','A definir · A definir','scheduled','2026-06-28T20:00:00Z'::timestamptz,'locked','knockout_placeholder'),
  ('ko-r32-3','round_of_32','32 AVOS · 3','TBD','TBD','DOM 28 JUN','20:00','A definir · A definir','scheduled','2026-06-28T23:00:00Z'::timestamptz,'locked','knockout_placeholder'),
  ('ko-r32-4','round_of_32','32 AVOS · 4','TBD','TBD','DOM 28 JUN','23:00','A definir · A definir','scheduled','2026-06-29T02:00:00Z'::timestamptz,'locked','knockout_placeholder'),
  ('ko-r32-5','round_of_32','32 AVOS · 5','TBD','TBD','DOM 28 JUN','14:00','A definir · A definir','scheduled','2026-06-28T17:00:00Z'::timestamptz,'locked','knockout_placeholder'),
  ('ko-r32-6','round_of_32','32 AVOS · 6','TBD','TBD','DOM 28 JUN','17:00','A definir · A definir','scheduled','2026-06-28T20:00:00Z'::timestamptz,'locked','knockout_placeholder'),
  ('ko-r32-7','round_of_32','32 AVOS · 7','TBD','TBD','DOM 28 JUN','20:00','A definir · A definir','scheduled','2026-06-28T23:00:00Z'::timestamptz,'locked','knockout_placeholder'),
  ('ko-r32-8','round_of_32','32 AVOS · 8','TBD','TBD','DOM 28 JUN','23:00','A definir · A definir','scheduled','2026-06-29T02:00:00Z'::timestamptz,'locked','knockout_placeholder'),
  ('ko-r32-9','round_of_32','32 AVOS · 9','TBD','TBD','SEG 29 JUN','14:00','A definir · A definir','scheduled','2026-06-29T17:00:00Z'::timestamptz,'locked','knockout_placeholder'),
  ('ko-r32-10','round_of_32','32 AVOS · 10','TBD','TBD','SEG 29 JUN','17:00','A definir · A definir','scheduled','2026-06-29T20:00:00Z'::timestamptz,'locked','knockout_placeholder'),
  ('ko-r32-11','round_of_32','32 AVOS · 11','TBD','TBD','SEG 29 JUN','20:00','A definir · A definir','scheduled','2026-06-29T23:00:00Z'::timestamptz,'locked','knockout_placeholder'),
  ('ko-r32-12','round_of_32','32 AVOS · 12','TBD','TBD','SEG 29 JUN','23:00','A definir · A definir','scheduled','2026-06-30T02:00:00Z'::timestamptz,'locked','knockout_placeholder'),
  ('ko-r32-13','round_of_32','32 AVOS · 13','TBD','TBD','SEG 29 JUN','14:00','A definir · A definir','scheduled','2026-06-29T17:00:00Z'::timestamptz,'locked','knockout_placeholder'),
  ('ko-r32-14','round_of_32','32 AVOS · 14','TBD','TBD','SEG 29 JUN','17:00','A definir · A definir','scheduled','2026-06-29T20:00:00Z'::timestamptz,'locked','knockout_placeholder'),
  ('ko-r32-15','round_of_32','32 AVOS · 15','TBD','TBD','SEG 29 JUN','20:00','A definir · A definir','scheduled','2026-06-29T23:00:00Z'::timestamptz,'locked','knockout_placeholder'),
  ('ko-r32-16','round_of_32','32 AVOS · 16','TBD','TBD','SEG 29 JUN','23:00','A definir · A definir','scheduled','2026-06-30T02:00:00Z'::timestamptz,'locked','knockout_placeholder'),
  ('ko-r16-1','round_of_16','OITAVAS · 1','TBD','TBD','SAB 04 JUL','14:00','A definir · A definir','scheduled','2026-07-04T17:00:00Z'::timestamptz,'locked','knockout_placeholder'),
  ('ko-r16-2','round_of_16','OITAVAS · 2','TBD','TBD','SAB 04 JUL','17:00','A definir · A definir','scheduled','2026-07-04T20:00:00Z'::timestamptz,'locked','knockout_placeholder'),
  ('ko-r16-3','round_of_16','OITAVAS · 3','TBD','TBD','SAB 04 JUL','20:00','A definir · A definir','scheduled','2026-07-04T23:00:00Z'::timestamptz,'locked','knockout_placeholder'),
  ('ko-r16-4','round_of_16','OITAVAS · 4','TBD','TBD','SAB 04 JUL','23:00','A definir · A definir','scheduled','2026-07-05T02:00:00Z'::timestamptz,'locked','knockout_placeholder'),
  ('ko-r16-5','round_of_16','OITAVAS · 5','TBD','TBD','DOM 05 JUL','14:00','A definir · A definir','scheduled','2026-07-05T17:00:00Z'::timestamptz,'locked','knockout_placeholder'),
  ('ko-r16-6','round_of_16','OITAVAS · 6','TBD','TBD','DOM 05 JUL','17:00','A definir · A definir','scheduled','2026-07-05T20:00:00Z'::timestamptz,'locked','knockout_placeholder'),
  ('ko-r16-7','round_of_16','OITAVAS · 7','TBD','TBD','DOM 05 JUL','20:00','A definir · A definir','scheduled','2026-07-05T23:00:00Z'::timestamptz,'locked','knockout_placeholder'),
  ('ko-r16-8','round_of_16','OITAVAS · 8','TBD','TBD','DOM 05 JUL','23:00','A definir · A definir','scheduled','2026-07-06T02:00:00Z'::timestamptz,'locked','knockout_placeholder'),
  ('ko-qf-1','quarter_final','QUARTAS · 1','TBD','TBD','QUI 09 JUL','17:00','A definir · A definir','scheduled','2026-07-09T20:00:00Z'::timestamptz,'locked','knockout_placeholder'),
  ('ko-qf-2','quarter_final','QUARTAS · 2','TBD','TBD','QUI 09 JUL','23:00','A definir · A definir','scheduled','2026-07-10T02:00:00Z'::timestamptz,'locked','knockout_placeholder'),
  ('ko-qf-3','quarter_final','QUARTAS · 3','TBD','TBD','SEX 10 JUL','17:00','A definir · A definir','scheduled','2026-07-10T20:00:00Z'::timestamptz,'locked','knockout_placeholder'),
  ('ko-qf-4','quarter_final','QUARTAS · 4','TBD','TBD','SEX 10 JUL','23:00','A definir · A definir','scheduled','2026-07-11T02:00:00Z'::timestamptz,'locked','knockout_placeholder'),
  ('ko-sf-1','semi_final','SEMIFINAL · 1','TBD','TBD','TER 14 JUL','22:00','A definir · A definir','scheduled','2026-07-15T01:00:00Z'::timestamptz,'locked','knockout_placeholder'),
  ('ko-sf-2','semi_final','SEMIFINAL · 2','TBD','TBD','QUA 15 JUL','22:00','A definir · A definir','scheduled','2026-07-16T01:00:00Z'::timestamptz,'locked','knockout_placeholder'),
  ('ko-third-1','third_place','TERCEIRO LUGAR','TBD','TBD','SAB 18 JUL','18:00','A definir · A definir','scheduled','2026-07-18T21:00:00Z'::timestamptz,'locked','knockout_placeholder'),
  ('ko-final-1','final','FINAL','TBD','TBD','DOM 19 JUL','19:00','MetLife Stadium · Nova York','scheduled','2026-07-19T22:00:00Z'::timestamptz,'locked','knockout_placeholder')
) as v(match_code, stage, stage_label, home_code, away_code, match_date, match_time, venue, status, kickoff_utc, market_status, lock_reason)
on conflict (match_code) do update set
  stage = excluded.stage,
  stage_label = excluded.stage_label,
  kickoff_utc = excluded.kickoff_utc,
  market_status = coalesce(public.matches.market_status, excluded.market_status),
  lock_reason = coalesce(public.matches.lock_reason, excluded.lock_reason);

insert into public.markets (market_type, scope_type, scope_id, opens_at, closes_at, status, lock_reason)
select
  'match_prediction',
  'match',
  m.match_code,
  now(),
  m.kickoff_utc,
  case
    when m.market_status in ('locked','closed','settled') then m.market_status
    when m.kickoff_utc <= now() then 'locked'
    else 'open'
  end,
  case when m.kickoff_utc <= now() then 'kickoff_elapsed' else m.lock_reason end
from public.matches m
where m.match_code is not null and m.kickoff_utc is not null
on conflict (market_type, scope_type, scope_id) do update set
  closes_at = excluded.closes_at,
  status = excluded.status,
  lock_reason = excluded.lock_reason,
  updated_at = now();

insert into public.markets (market_type, scope_type, scope_id, opens_at, closes_at, status, lock_reason)
select
  'special',
  'tournament',
  kind,
  now(),
  (select min(kickoff_utc) from public.matches where stage = 'group' and kickoff_utc is not null),
  case when (select min(kickoff_utc) from public.matches where stage = 'group' and kickoff_utc is not null) <= now() then 'locked' else 'open' end,
  null
from unnest(array['champion','vice','scorer']) as kind
on conflict (market_type, scope_type, scope_id) do update set
  closes_at = excluded.closes_at,
  status = excluded.status,
  updated_at = now();

create or replace function public.close_expired_markets()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.markets
  set status = 'locked',
      lock_reason = coalesce(lock_reason, 'deadline_elapsed'),
      updated_at = now()
  where status in ('scheduled','open')
    and closes_at <= now();

  get diagnostics v_count = row_count;

  update public.matches m
  set market_status = 'locked',
      status = case when m.status = 'scheduled' then 'locked' else m.status end,
      locked_at = coalesce(m.locked_at, now()),
      lock_reason = coalesce(m.lock_reason, 'deadline_elapsed')
  from public.markets mk
  where mk.market_type = 'match_prediction'
    and mk.scope_id = m.match_code
    and mk.status = 'locked'
    and m.market_status = 'open';

  return v_count;
end;
$$;

create or replace function public.prevent_direct_general_pick_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(current_setting('app.allow_special_pick_update', true), '') <> '1'
     and auth.uid() is not null
     and (
       new.champion_pick is distinct from old.champion_pick
       or new.vice_pick is distinct from old.vice_pick
       or new.scorer_pick is distinct from old.scorer_pick
     )
  then
    raise exception 'Use save_general_picks para alterar apostas especiais.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_direct_general_pick_update on public.users;
create trigger trg_prevent_direct_general_pick_update
before update of champion_pick, vice_pick, scorer_pick on public.users
for each row execute function public.prevent_direct_general_pick_update();

create or replace function public.save_general_picks(p_champion text, p_vice text, p_scorer text)
returns public.users
language plpgsql
set search_path = public
as $$
declare
  v_user public.users%rowtype;
  v_after public.users%rowtype;
  v_champion text := nullif(trim(coalesce(p_champion, '')), '');
  v_vice text := nullif(trim(coalesce(p_vice, '')), '');
  v_scorer text := nullif(trim(coalesce(p_scorer, '')), '');
  v_market public.markets%rowtype;
begin
  perform public.close_expired_markets();

  select * into v_user from public.users where id = auth.uid();
  if not found or v_user.participant_status <> 'active' then
    raise exception 'Participante pendente, bloqueado ou removido.';
  end if;

  if v_champion is not null and not exists (select 1 from public.matches where home_code = v_champion or away_code = v_champion) then
    raise exception 'Selecao campea invalida.';
  end if;
  if v_vice is not null and not exists (select 1 from public.matches where home_code = v_vice or away_code = v_vice) then
    raise exception 'Selecao vice invalida.';
  end if;
  if v_champion is not null and v_champion = v_vice then
    raise exception 'Campeao e vice nao podem ser a mesma selecao.';
  end if;
  if v_scorer is not null and length(v_scorer) > 100 then
    raise exception 'Nome do artilheiro muito longo.';
  end if;

  for v_market in
    select * from public.markets
    where market_type = 'special'
      and scope_type = 'tournament'
      and scope_id in ('champion','vice','scorer')
  loop
    if v_market.status <> 'open' or v_market.closes_at <= now() then
      raise exception 'Mercado de apostas especiais encerrado.';
    end if;
  end loop;

  insert into public.special_picks(user_id, market_id, pick_type, team_code, player_name)
  select auth.uid(), id, 'champion', v_champion, null from public.markets
  where market_type = 'special' and scope_id = 'champion' and v_champion is not null
  on conflict (user_id, pick_type) do update set team_code = excluded.team_code, player_name = null, market_id = excluded.market_id, updated_at = now();

  insert into public.special_picks(user_id, market_id, pick_type, team_code, player_name)
  select auth.uid(), id, 'vice', v_vice, null from public.markets
  where market_type = 'special' and scope_id = 'vice' and v_vice is not null
  on conflict (user_id, pick_type) do update set team_code = excluded.team_code, player_name = null, market_id = excluded.market_id, updated_at = now();

  insert into public.special_picks(user_id, market_id, pick_type, team_code, player_name)
  select auth.uid(), id, 'scorer', null, v_scorer from public.markets
  where market_type = 'special' and scope_id = 'scorer' and v_scorer is not null
  on conflict (user_id, pick_type) do update set team_code = null, player_name = excluded.player_name, market_id = excluded.market_id, updated_at = now();

  perform set_config('app.allow_special_pick_update', '1', true);
  update public.users
  set champion_pick = v_champion,
      vice_pick = v_vice,
      scorer_pick = v_scorer
  where id = auth.uid()
  returning * into v_after;

  perform public.log_audit('general_picks_updated', 'user', auth.uid()::text, to_jsonb(v_user), to_jsonb(v_after));
  return v_after;
end;
$$;

create or replace function public.save_match_predictions(p_predictions jsonb)
returns table (
  id uuid,
  user_id uuid,
  match_code text,
  home_score integer,
  away_score integer,
  submitted_at timestamptz,
  points_earned integer
)
language plpgsql
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_item jsonb;
  v_match public.matches%rowtype;
  v_market public.markets%rowtype;
  v_prediction public.predictions%rowtype;
  v_match_code text;
  v_home_score integer;
  v_away_score integer;
  v_submitted_at timestamptz;
begin
  perform public.close_expired_markets();

  if v_user_id is null then
    raise exception 'Sessao invalida.';
  end if;

  if not exists (select 1 from public.users where id = v_user_id and participant_status = 'active') then
    raise exception 'Participante pendente, bloqueado ou removido.';
  end if;

  if p_predictions is null or jsonb_typeof(p_predictions) <> 'array' then
    raise exception 'Payload de palpites invalido.';
  end if;

  for v_item in select value from jsonb_array_elements(p_predictions)
  loop
    v_match_code := nullif(v_item->>'match_code', '');
    v_home_score := (v_item->>'home_score')::integer;
    v_away_score := (v_item->>'away_score')::integer;
    v_submitted_at := coalesce((v_item->>'submitted_at')::timestamptz, now());

    if v_match_code is null then
      raise exception 'match_code obrigatorio.';
    end if;
    if v_home_score < 0 or v_away_score < 0 or v_home_score > 99 or v_away_score > 99 then
      raise exception 'Placar invalido para %. Use valores entre 0 e 99.', v_match_code;
    end if;

    select * into v_match from public.matches where matches.match_code = v_match_code;
    if not found then
      raise exception 'Partida nao encontrada: %', v_match_code;
    end if;

    select * into v_market
    from public.markets
    where market_type = 'match_prediction' and scope_type = 'match' and scope_id = v_match_code;

    if not found or v_market.status <> 'open' or v_market.closes_at <= now()
      or coalesce(v_match.market_status, 'open') <> 'open'
      or v_match.status in ('locked', 'live', 'finished')
    then
      raise exception 'Mercado fechado para a partida %.', v_match_code;
    end if;

    insert into public.predictions(user_id, match_code, home_score, away_score, submitted_at)
    values (v_user_id, v_match_code, v_home_score, v_away_score, v_submitted_at)
    on conflict (user_id, match_code) do update set
      home_score = excluded.home_score,
      away_score = excluded.away_score,
      submitted_at = excluded.submitted_at,
      points_earned = null
    returning * into v_prediction;

    return query select
      v_prediction.id,
      v_prediction.user_id,
      v_prediction.match_code,
      v_prediction.home_score,
      v_prediction.away_score,
      v_prediction.submitted_at,
      v_prediction.points_earned;
  end loop;
end;
$$;

grant select on public.markets to authenticated;
grant select, insert, update on public.special_picks to authenticated;
grant execute on function public.save_general_picks(text,text,text) to authenticated;
grant execute on function public.save_match_predictions(jsonb) to authenticated;
revoke execute on function public.auto_score_match_predictions() from public, anon, authenticated;
revoke execute on function public.close_expired_markets() from public, anon;
