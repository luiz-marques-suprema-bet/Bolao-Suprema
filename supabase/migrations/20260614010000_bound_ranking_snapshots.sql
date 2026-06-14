-- ============================================================================
-- Bolao Suprema · Limita ranking_snapshots (anti-inchaco)
-- ----------------------------------------------------------------------------
-- ranking_snapshots era append-only: cada refresh inseria ~200 linhas e nada
-- era apagado (chegou a 98k linhas / 62MB). A view current_ranking so usa o
-- snapshot MAIS RECENTE por usuario, entao os lotes antigos eram peso morto.
--
-- 1) Poda unica: mantem os 2 lotes mais recentes por usuario.
-- 2) refresh_ranking_snapshots passa a auto-podar (mantem 2 por usuario) ao
--    final de cada execucao, deixando a tabela limitada pra sempre (~400 linhas).
-- Aplicado em producao via Management API; registrado aqui. Idempotente.
-- ============================================================================

delete from public.ranking_snapshots rs
using (
  select id, row_number() over (partition by user_id order by snapshot_at desc, id desc) as rn
  from public.ranking_snapshots
) old
where rs.id = old.id and old.rn > 2;

CREATE OR REPLACE FUNCTION public.refresh_ranking_snapshots()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      (case
        when (m.stage = 'group' and coalesce(p.points_earned, 0) >= coalesce((select points from public.scoring_rules where id = 'group_result'), 5))
          or (m.stage <> 'group' and coalesce(p.points_earned, 0) >= coalesce((select points from public.scoring_rules where id = 'ko_result'), 5))
        then 1 else 0 end) as is_hit,
      sum(case
            when (m.stage = 'group' and coalesce(p.points_earned, 0) >= coalesce((select points from public.scoring_rules where id = 'group_result'), 5))
              or (m.stage <> 'group' and coalesce(p.points_earned, 0) >= coalesce((select points from public.scoring_rules where id = 'ko_result'), 5))
            then 0 else 1 end)
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
    where misses_seen = 0 and is_hit = 1
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
  -- auto-poda: mantem so os 2 snapshots mais recentes por usuario (a view
  -- current_ranking so le o mais recente) — impede a tabela de inchar.
  delete from public.ranking_snapshots rs
  using (
    select id, row_number() over (partition by user_id order by snapshot_at desc, id desc) as rn
    from public.ranking_snapshots
  ) old
  where rs.id = old.id and old.rn > 2;

end;
$function$

