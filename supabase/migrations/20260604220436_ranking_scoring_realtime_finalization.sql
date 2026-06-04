-- Bolao Suprema - final scoring/ranking automation and live transparency.
-- This migration keeps existing picks intact and makes ranking_snapshots the
-- database source of truth for the app ranking.

alter table public.ranking_snapshots
  add column if not exists match_points integer not null default 0,
  add column if not exists special_points integer not null default 0,
  add column if not exists knockout_points integer not null default 0,
  add column if not exists final_exact boolean not null default false,
  add column if not exists scorer_tiebreak_goals integer not null default 0,
  add column if not exists scorer_pick_hit boolean not null default false,
  add column if not exists first_prediction_at timestamptz,
  add column if not exists tie_breaker jsonb not null default '{}'::jsonb;

create index if not exists idx_ranking_snapshots_current
  on public.ranking_snapshots(user_id, snapshot_at desc);

create table if not exists public.tournament_awards (
  id text primary key check (id in ('champion','vice','scorer')),
  team_code text,
  player_id uuid references public.players(id) on delete set null,
  player_name text,
  goals integer,
  source text not null default 'auto',
  decided_at timestamptz,
  updated_at timestamptz not null default now(),
  check (
    (id in ('champion','vice') and team_code is not null and player_name is null)
    or (id = 'scorer' and player_name is not null and team_code is null)
  )
);

create table if not exists public.player_goal_totals (
  id uuid primary key default uuid_generate_v4(),
  player_id uuid references public.players(id) on delete set null,
  player_name text not null,
  normalized_name text not null,
  team_code text,
  goals integer not null default 0 check (goals >= 0),
  assists integer,
  source text not null default 'football-data',
  external_player_id text,
  updated_at timestamptz not null default now(),
  unique (source, external_player_id)
);

create index if not exists idx_player_goal_totals_goals
  on public.player_goal_totals(goals desc, normalized_name);

create index if not exists idx_player_goal_totals_normalized_name
  on public.player_goal_totals(normalized_name);

alter table public.tournament_awards enable row level security;
alter table public.player_goal_totals enable row level security;

drop policy if exists tournament_awards_select_authenticated on public.tournament_awards;
create policy tournament_awards_select_authenticated
on public.tournament_awards for select to authenticated
using (true);

drop policy if exists tournament_awards_admin_insert on public.tournament_awards;
create policy tournament_awards_admin_insert
on public.tournament_awards for insert to authenticated
with check (public.is_admin((select auth.uid())));

drop policy if exists tournament_awards_admin_update on public.tournament_awards;
create policy tournament_awards_admin_update
on public.tournament_awards for update to authenticated
using (public.is_admin((select auth.uid())))
with check (public.is_admin((select auth.uid())));

drop policy if exists tournament_awards_admin_delete on public.tournament_awards;
create policy tournament_awards_admin_delete
on public.tournament_awards for delete to authenticated
using (public.is_admin((select auth.uid())));

drop policy if exists player_goal_totals_select_authenticated on public.player_goal_totals;
create policy player_goal_totals_select_authenticated
on public.player_goal_totals for select to authenticated
using (true);

drop policy if exists player_goal_totals_admin_insert on public.player_goal_totals;
create policy player_goal_totals_admin_insert
on public.player_goal_totals for insert to authenticated
with check (public.is_admin((select auth.uid())));

drop policy if exists player_goal_totals_admin_update on public.player_goal_totals;
create policy player_goal_totals_admin_update
on public.player_goal_totals for update to authenticated
using (public.is_admin((select auth.uid())))
with check (public.is_admin((select auth.uid())));

drop policy if exists player_goal_totals_admin_delete on public.player_goal_totals;
create policy player_goal_totals_admin_delete
on public.player_goal_totals for delete to authenticated
using (public.is_admin((select auth.uid())));

grant select on public.tournament_awards to authenticated;
grant select on public.player_goal_totals to authenticated;

create or replace function public.normalize_player_name(p_name text)
returns text
language sql
immutable
set search_path = public
as $$
  select lower(regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g'));
$$;

create or replace function public.match_slot_id(p_match_code text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when p_match_code ~ '^ko-r32-[0-9]+$' then replace(p_match_code, 'ko-r32-', 'r32_')
    when p_match_code ~ '^ko-r16-[0-9]+$' then replace(p_match_code, 'ko-r16-', 'r16_')
    when p_match_code ~ '^ko-qf-[0-9]+$' then replace(p_match_code, 'ko-qf-', 'qf_')
    when p_match_code ~ '^ko-sf-[0-9]+$' then replace(p_match_code, 'ko-sf-', 'sf_')
    when p_match_code = 'ko-third-1' then 'third_1'
    when p_match_code = 'ko-final-1' then 'final_1'
    else null
  end;
$$;

create or replace function public.calculate_prediction_points_v2(
  p_home integer,
  p_away integer,
  r_home integer,
  r_away integer,
  p_stage text default 'group',
  p_predicted_advancer text default null,
  p_real_advancer text default null
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
  qualified_points integer;
  same_outcome boolean;
  one_team boolean;
begin
  select points into exact_points
  from public.scoring_rules
  where id = case when p_stage = 'group' then 'group_exact' else 'ko_exact' end;

  select points into score1_points
  from public.scoring_rules
  where id = case when p_stage = 'group' then 'group_score1' else 'ko_score1' end;

  select points into result_points
  from public.scoring_rules
  where id = case when p_stage = 'group' then 'group_result' else 'ko_result' end;

  select points into goals1_points from public.scoring_rules where id = 'group_goals1';
  select points into qualified_points from public.scoring_rules where id = 'ko_qualified';

  if p_home = r_home and p_away = r_away then
    return coalesce(exact_points, case when p_stage = 'group' then 10 else 12 end);
  end if;

  same_outcome :=
    (p_home = p_away and r_home = r_away)
    or (p_home > p_away and r_home > r_away)
    or (p_home < p_away and r_home < r_away);
  one_team := p_home = r_home or p_away = r_away;

  if same_outcome and one_team then
    return coalesce(score1_points, case when p_stage = 'group' then 7 else 8 end);
  elsif same_outcome then
    return coalesce(result_points, 5);
  elsif p_stage = 'group' and one_team then
    return coalesce(goals1_points, 1);
  elsif p_stage <> 'group'
    and p_real_advancer is not null
    and p_real_advancer <> 'draw'
    and upper(coalesce(p_predicted_advancer, '')) = upper(p_real_advancer)
  then
    return coalesce(qualified_points, 2);
  end if;

  return 0;
end;
$$;

create or replace function public.calculate_prediction_points(
  p_home integer,
  p_away integer,
  r_home integer,
  r_away integer,
  p_stage text default 'group'
)
returns integer
language sql
stable
set search_path = public
as $$
  select public.calculate_prediction_points_v2(p_home, p_away, r_home, r_away, p_stage, null, null);
$$;

create or replace function public.auto_score_match_predictions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slot_id text;
begin
  if new.status = 'finished'
     and new.home_score is not null
     and new.away_score is not null
     and (
       old.status is distinct from 'finished'
       or old.home_score is distinct from new.home_score
       or old.away_score is distinct from new.away_score
       or old.winner is distinct from new.winner
     )
  then
    v_slot_id := public.match_slot_id(new.match_code);

    update public.predictions p
    set points_earned = public.calculate_prediction_points_v2(
      p.home_score,
      p.away_score,
      new.home_score,
      new.away_score,
      new.stage,
      case
        when new.stage <> 'group' then (
          select bp.picked_winner
          from public.bracket_picks bp
          where bp.user_id = p.user_id
            and bp.slot_id = v_slot_id
          limit 1
        )
        else null
      end,
      case when new.stage <> 'group' then new.winner else null end
    )
    where p.match_code = new.match_code;

    if v_slot_id is not null and new.stage <> 'group' and new.winner is not null and new.winner <> 'draw' then
      update public.bracket_picks bp
      set is_correct = (upper(bp.picked_winner) = upper(new.winner))
      where bp.slot_id = v_slot_id;
    end if;

    insert into public.system_events (level, area, message, details)
    values (
      'info',
      'auto_scoring',
      'Pontos calculados para ' || new.match_code,
      jsonb_build_object(
        'match_code', new.match_code,
        'home_score', new.home_score,
        'away_score', new.away_score,
        'stage', new.stage,
        'winner', new.winner,
        'slot_id', v_slot_id,
        'triggered_by', 'trg_auto_score_predictions'
      )
    );

    begin
      perform public.refresh_ranking_snapshots();
    exception when others then
      insert into public.system_events (level, area, message, details)
      values (
        'warn',
        'auto_scoring',
        'refresh_ranking_snapshots falhou apos ' || new.match_code || ': ' || sqlerrm,
        jsonb_build_object('match_code', new.match_code)
      );
    end;
  end if;

  return new;
end;
$$;

create or replace function public.refresh_ranking_snapshots()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.ranking_breakdowns
  where source_type = 'match'
     or (source_type = 'general' and source_id in ('champion','vice','scorer'));

  insert into public.ranking_breakdowns(user_id, source_type, source_id, label, points, details)
  select
    p.user_id,
    'match',
    p.match_code,
    concat(m.home_code, ' x ', m.away_code),
    coalesce(p.points_earned, 0),
    jsonb_build_object(
      'home_score', p.home_score,
      'away_score', p.away_score,
      'match_code', p.match_code,
      'stage', m.stage,
      'official_home_score', m.home_score,
      'official_away_score', m.away_score,
      'winner', m.winner
    )
  from public.predictions p
  join public.matches m on m.match_code = p.match_code
  where p.match_code is not null
    and m.status = 'finished'
    and m.home_score is not null
    and m.away_score is not null
  on conflict (user_id, source_type, source_id) do update set
    label = excluded.label,
    points = excluded.points,
    details = excluded.details,
    calculated_at = now();

  insert into public.ranking_breakdowns(user_id, source_type, source_id, label, points, details)
  select
    sp.user_id,
    'general',
    sp.pick_type,
    case sp.pick_type
      when 'champion' then 'Campeao'
      when 'vice' then 'Vice-campeao'
      else 'Artilheiro'
    end,
    sr.points,
    jsonb_build_object(
      'pick_type', sp.pick_type,
      'picked_team', sp.team_code,
      'picked_player', sp.player_name,
      'official_team', ta.team_code,
      'official_player', ta.player_name,
      'official_goals', ta.goals
    )
  from public.special_picks sp
  join public.scoring_rules sr on sr.id = sp.pick_type and sr.is_active
  join public.tournament_awards ta on ta.id = sp.pick_type and ta.decided_at is not null
  where (
      sp.pick_type in ('champion','vice')
      and sp.team_code is not null
      and upper(sp.team_code) = upper(ta.team_code)
    )
    or (
      sp.pick_type = 'scorer'
      and sp.player_name is not null
      and (
        (sp.player_id is not null and ta.player_id is not null and sp.player_id = ta.player_id)
        or public.normalize_player_name(sp.player_name) = public.normalize_player_name(ta.player_name)
      )
    )
  on conflict (user_id, source_type, source_id) do update set
    label = excluded.label,
    points = excluded.points,
    details = excluded.details,
    calculated_at = now();

  with active_users as (
    select id as user_id
    from public.users
    where participant_status = 'active'
      and trim(first_name) <> ''
  ),
  match_stats as (
    select
      p.user_id,
      sum(coalesce(p.points_earned, 0))::int as match_points,
      sum(case when m.stage <> 'group' then coalesce(p.points_earned, 0) else 0 end)::int as knockout_points,
      count(*) filter (
        where (m.stage = 'group' and coalesce(p.points_earned, 0) >= coalesce((select points from public.scoring_rules where id = 'group_result'), 5))
           or (m.stage <> 'group' and coalesce(p.points_earned, 0) >= coalesce((select points from public.scoring_rules where id = 'ko_result'), 5))
      )::int as correct,
      count(*) filter (
        where (m.stage = 'group' and coalesce(p.points_earned, 0) = coalesce((select points from public.scoring_rules where id = 'group_exact'), 10))
           or (m.stage <> 'group' and coalesce(p.points_earned, 0) = coalesce((select points from public.scoring_rules where id = 'ko_exact'), 12))
      )::int as exact_score,
      bool_or(m.match_code = 'ko-final-1' and coalesce(p.points_earned, 0) = coalesce((select points from public.scoring_rules where id = 'ko_exact'), 12)) as final_exact
    from public.predictions p
    join public.matches m on m.match_code = p.match_code
    where m.status = 'finished'
      and m.home_score is not null
      and m.away_score is not null
    group by p.user_id
  ),
  streak_scan as (
    select
      p.user_id,
      coalesce(p.points_earned, 0) as points,
      sum(case when coalesce(p.points_earned, 0) <= 0 then 1 else 0 end)
        over (
          partition by p.user_id
          order by m.kickoff_utc desc nulls last, m.match_code desc
          rows between unbounded preceding and current row
        ) as misses_seen
    from public.predictions p
    join public.matches m on m.match_code = p.match_code
    where m.status = 'finished'
      and m.home_score is not null
      and m.away_score is not null
  ),
  streaks as (
    select user_id, count(*)::int as streak
    from streak_scan
    where misses_seen = 0 and points > 0
    group by user_id
  ),
  special_stats as (
    select user_id, sum(points)::int as special_points
    from public.ranking_breakdowns
    where source_type = 'general'
      and source_id in ('champion','vice','scorer')
    group by user_id
  ),
  scorer_picks as (
    select
      sp.user_id,
      exists (
        select 1
        from public.ranking_breakdowns rb
        where rb.user_id = sp.user_id
          and rb.source_type = 'general'
          and rb.source_id = 'scorer'
          and rb.points > 0
      ) as scorer_pick_hit,
      coalesce(max(pgt.goals), 0)::int as scorer_tiebreak_goals
    from public.special_picks sp
    left join public.player_goal_totals pgt
      on (
        sp.pick_type = 'scorer'
        and (
          (sp.player_id is not null and pgt.player_id is not null and sp.player_id = pgt.player_id)
          or public.normalize_player_name(sp.player_name) = pgt.normalized_name
        )
      )
    where sp.pick_type = 'scorer'
    group by sp.user_id
  ),
  first_submissions as (
    select user_id, min(sent_at) as first_prediction_at
    from (
      select user_id, submitted_at as sent_at from public.predictions
      union all
      select user_id, created_at as sent_at from public.special_picks
      union all
      select user_id, created_at as sent_at from public.bracket_picks
    ) s
    group by user_id
  ),
  totals as (
    select
      au.user_id,
      coalesce(ms.match_points, 0) as match_points,
      coalesce(ss.special_points, 0) as special_points,
      coalesce(ms.match_points, 0) + coalesce(ss.special_points, 0) as pts,
      coalesce(ms.correct, 0) as correct,
      coalesce(ms.exact_score, 0) as exact_score,
      coalesce(st.streak, 0) as streak,
      coalesce(ms.knockout_points, 0) as knockout_points,
      coalesce(ms.final_exact, false) as final_exact,
      coalesce(sp.scorer_pick_hit, false) as scorer_pick_hit,
      coalesce(sp.scorer_tiebreak_goals, 0) as scorer_tiebreak_goals,
      fs.first_prediction_at
    from active_users au
    left join match_stats ms on ms.user_id = au.user_id
    left join special_stats ss on ss.user_id = au.user_id
    left join streaks st on st.user_id = au.user_id
    left join scorer_picks sp on sp.user_id = au.user_id
    left join first_submissions fs on fs.user_id = au.user_id
  ),
  ranked as (
    select
      *,
      row_number() over (
        order by
          pts desc,
          exact_score desc,
          scorer_pick_hit desc,
          scorer_tiebreak_goals desc,
          knockout_points desc,
          final_exact desc,
          first_prediction_at asc nulls last,
          user_id asc
      )::int as rank
    from totals
  )
  insert into public.ranking_snapshots(
    user_id,
    rank,
    pts,
    mov,
    correct,
    exact_score,
    streak,
    match_points,
    special_points,
    knockout_points,
    final_exact,
    scorer_tiebreak_goals,
    scorer_pick_hit,
    first_prediction_at,
    tie_breaker
  )
  select
    user_id,
    rank,
    pts,
    '—',
    correct,
    exact_score,
    streak,
    match_points,
    special_points,
    knockout_points,
    final_exact,
    scorer_tiebreak_goals,
    scorer_pick_hit,
    first_prediction_at,
    jsonb_build_object(
      'order', array[
        'points',
        'exact_score',
        'scorer_pick',
        'scorer_goals',
        'knockout_points',
        'final_exact',
        'first_prediction_at'
      ],
      'points', pts,
      'exact_score', exact_score,
      'scorer_pick_hit', scorer_pick_hit,
      'scorer_tiebreak_goals', scorer_tiebreak_goals,
      'knockout_points', knockout_points,
      'final_exact', final_exact,
      'first_prediction_at', first_prediction_at
    )
  from ranked;

  perform public.log_audit('ranking_refreshed', 'ranking', null, null, null);
end;
$$;

create or replace view public.current_ranking
with (security_invoker = true)
as
  with latest as (
    select distinct on (rs.user_id)
      rs.*
    from public.ranking_snapshots rs
    order by rs.user_id, rs.snapshot_at desc, rs.id desc
  )
  select
    l.rank,
    l.user_id,
    l.pts,
    l.mov,
    l.correct,
    l.exact_score,
    l.streak,
    l.match_points,
    l.special_points,
    l.knockout_points,
    l.final_exact,
    l.scorer_tiebreak_goals,
    l.scorer_pick_hit,
    l.first_prediction_at,
    l.tie_breaker,
    l.snapshot_at,
    u.first_name,
    u.last_name,
    u.dept,
    u.initials,
    u.color,
    u.avatar_url,
    u.participant_status,
    u.privacy_hide_profile
  from latest l
  join public.users u on u.id = l.user_id
  where u.participant_status = 'active'
    and trim(u.first_name) <> '';

grant select on public.current_ranking to authenticated;

create or replace function public.sync_final_awards_from_matches()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_champion text;
  v_vice text;
begin
  if new.match_code <> 'ko-final-1'
     or new.status <> 'finished'
     or new.winner is null
     or new.winner = 'draw'
     or new.home_code = 'TBD'
     or new.away_code = 'TBD'
  then
    return new;
  end if;

  v_champion := new.winner;
  v_vice := case
    when new.winner = new.home_code then new.away_code
    when new.winner = new.away_code then new.home_code
    else null
  end;

  if v_vice is null then
    return new;
  end if;

  insert into public.tournament_awards(id, team_code, source, decided_at, updated_at)
  values ('champion', v_champion, 'final_match', coalesce(new.settled_at, now()), now())
  on conflict (id) do update set
    team_code = excluded.team_code,
    player_id = null,
    player_name = null,
    goals = null,
    source = excluded.source,
    decided_at = excluded.decided_at,
    updated_at = now();

  insert into public.tournament_awards(id, team_code, source, decided_at, updated_at)
  values ('vice', v_vice, 'final_match', coalesce(new.settled_at, now()), now())
  on conflict (id) do update set
    team_code = excluded.team_code,
    player_id = null,
    player_name = null,
    goals = null,
    source = excluded.source,
    decided_at = excluded.decided_at,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists trg_sync_final_awards on public.matches;
create trigger trg_sync_final_awards
after update on public.matches
for each row
execute function public.sync_final_awards_from_matches();

create or replace function public.sync_top_scorer_from_goal_totals()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_top public.player_goal_totals%rowtype;
begin
  select *
  into v_top
  from public.player_goal_totals
  where goals > 0
  order by goals desc, normalized_name asc
  limit 1;

  if not found then
    return;
  end if;

  insert into public.tournament_awards(id, player_id, player_name, goals, source, decided_at, updated_at)
  values ('scorer', v_top.player_id, v_top.player_name, v_top.goals, v_top.source, now(), now())
  on conflict (id) do update set
    team_code = null,
    player_id = excluded.player_id,
    player_name = excluded.player_name,
    goals = excluded.goals,
    source = excluded.source,
    decided_at = excluded.decided_at,
    updated_at = now();
end;
$$;

create or replace function public.trg_sync_top_scorer_from_goal_totals()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.sync_top_scorer_from_goal_totals();
  return null;
end;
$$;

drop trigger if exists trg_player_goal_totals_sync_top_scorer on public.player_goal_totals;
create trigger trg_player_goal_totals_sync_top_scorer
after insert or update or delete on public.player_goal_totals
for each statement
execute function public.trg_sync_top_scorer_from_goal_totals();

create or replace function public.refresh_ranking_after_award_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.refresh_ranking_snapshots();
  return null;
end;
$$;

drop trigger if exists trg_tournament_awards_refresh_ranking on public.tournament_awards;
create trigger trg_tournament_awards_refresh_ranking
after insert or update or delete on public.tournament_awards
for each statement
execute function public.refresh_ranking_after_award_change();

create or replace function public.admin_set_tournament_scorer(
  p_player_name text,
  p_goals integer default null,
  p_player_id uuid default null
)
returns public.tournament_awards
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := nullif(regexp_replace(trim(coalesce(p_player_name, '')), '\s+', ' ', 'g'), '');
  v_award public.tournament_awards%rowtype;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Apenas admin pode definir artilheiro oficial.';
  end if;

  if v_name is null then
    raise exception 'Nome do artilheiro obrigatorio.';
  end if;

  insert into public.tournament_awards(id, player_id, player_name, goals, source, decided_at, updated_at)
  values ('scorer', p_player_id, v_name, p_goals, 'admin', now(), now())
  on conflict (id) do update set
    team_code = null,
    player_id = excluded.player_id,
    player_name = excluded.player_name,
    goals = excluded.goals,
    source = excluded.source,
    decided_at = excluded.decided_at,
    updated_at = now()
  returning * into v_award;

  return v_award;
end;
$$;

revoke execute on function public.match_slot_id(text) from public, anon, authenticated;
revoke execute on function public.sync_final_awards_from_matches() from public, anon, authenticated;
revoke execute on function public.sync_top_scorer_from_goal_totals() from public, anon, authenticated;
revoke execute on function public.trg_sync_top_scorer_from_goal_totals() from public, anon, authenticated;
revoke execute on function public.refresh_ranking_after_award_change() from public, anon, authenticated;
revoke execute on function public.auto_score_match_predictions() from public, anon, authenticated;

grant execute on function public.refresh_ranking_snapshots() to authenticated;
grant execute on function public.admin_set_tournament_scorer(text, integer, uuid) to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'ranking_breakdowns'
  ) then
    alter publication supabase_realtime add table public.ranking_breakdowns;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'tournament_awards'
  ) then
    alter publication supabase_realtime add table public.tournament_awards;
  end if;
end $$;

select public.refresh_ranking_snapshots();
