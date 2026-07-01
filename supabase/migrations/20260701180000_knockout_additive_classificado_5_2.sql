-- Bolao Suprema · Mata-mata: regras 5.2 OFICIAIS (placar do tempo regulamentar +
-- bônus aditivo do classificado). Decisão do grupo em 2026-07-01.
--
-- Modelo (substitui o "quem passa manda" e o "12→10" que nunca chegaram a valer):
--   PLACAR (conta SÓ o tempo regulamentar / 90 min):
--     • Placar exato ................... 12
--     • Resultado + placar de um time ..  8
--     • Resultado apenas ...............  5
--     • Nada ...........................  0
--   BÔNUS DO CLASSIFICADO (aditivo, em QUALQUER jogo):
--     • Acertou quem passa (incl. prorrogação/pênaltis) .. +2
--   TOTAL = placar + bônus  →  máximo 14.
--
-- A prorrogação NÃO conta para o placar (r_home/r_away = placar dos 90 min); ela só
-- define o classificado (o +2). Como não houve gol de prorrogação até hoje, o placar
-- final armazenado já É o do tempo regulamentar, então o backfill não distorce nada.

-- ── 1) Função de pontuação: placar (tempo normal) + bônus aditivo do classificado ──
create or replace function public.calculate_prediction_points_v2(p_home integer, p_away integer, r_home integer, r_away integer, p_stage text default 'group', p_predicted_advancer text default null, p_real_advancer text default null)
returns integer
language plpgsql
stable
set search_path to 'public'
as $function$
declare
  exact_points integer;
  score1_points integer;
  result_points integer;
  goals1_points integer;
  qualified_points integer;
  same_outcome boolean;
  winner_goals boolean;
  one_team boolean;
  adv_ok boolean;
  is_ko boolean := p_stage <> 'group';
  placar integer;
begin
  select points into exact_points from public.scoring_rules
    where id = case when is_ko then 'ko_exact' else 'group_exact' end;
  select points into score1_points from public.scoring_rules
    where id = case when is_ko then 'ko_score1' else 'group_score1' end;
  select points into result_points from public.scoring_rules
    where id = case when is_ko then 'ko_result' else 'group_result' end;
  select points into goals1_points from public.scoring_rules where id = 'group_goals1';
  select points into qualified_points from public.scoring_rules where id = 'ko_qualified';

  same_outcome :=
    (p_home = p_away and r_home = r_away)
    or (p_home > p_away and r_home > r_away)
    or (p_home < p_away and r_home < r_away);

  -- Gols do time VENCEDOR (usado só no +7 da fase de grupos).
  winner_goals :=
    (r_home > r_away and p_home = r_home)
    or (r_away > r_home and p_away = r_away);

  -- Acertou o placar de UM dos times (qualquer um).
  one_team := p_home = r_home or p_away = r_away;

  -- ── Fase de grupos (inalterada: 10 / 7 / 5 / 1) ──
  if not is_ko then
    if p_home = r_home and p_away = r_away then
      return coalesce(exact_points, 10);
    elsif same_outcome and winner_goals then
      return coalesce(score1_points, 7);
    elsif same_outcome then
      return coalesce(result_points, 5);
    elsif one_team then
      return coalesce(goals1_points, 1);
    end if;
    return 0;
  end if;

  -- ── Mata-mata (regras 5.2) ──
  -- Placar sobre o TEMPO REGULAMENTAR (r_home/r_away = placar dos 90 min):
  if p_home = r_home and p_away = r_away then
    placar := coalesce(exact_points, 12);       -- placar exato
  elsif same_outcome and one_team then
    placar := coalesce(score1_points, 8);       -- resultado + placar de um time
  elsif same_outcome then
    placar := coalesce(result_points, 5);       -- resultado
  else
    placar := 0;
  end if;

  -- Bônus ADITIVO: acertou o classificado (winner real, inclui prorrogação/pênaltis).
  adv_ok :=
    p_real_advancer is not null
    and upper(p_real_advancer) <> 'DRAW'
    and upper(coalesce(p_predicted_advancer, '')) = upper(p_real_advancer);

  return placar + (case when adv_ok then coalesce(qualified_points, 2) else 0 end);
end;
$function$;

-- ── 2) scoring_rules: classificado agora é BÔNUS aditivo (2). Aposenta a regra
--       "ko_score_only" (do modelo antigo, não é mais usada). ──
update public.scoring_rules
set label = 'Classificado (bonus aditivo, incl. prorrogacao/penaltis)', points = 2
where id = 'ko_qualified';

update public.scoring_rules
set is_active = false, label = 'DEPRECATED - nao usado no modelo aditivo'
where id = 'ko_score_only';

-- ── 3) refresh_ranking_snapshots: "cravada" no mata-mata agora é pontos >= 12
--       (12 sem bônus ou 14 com bônus), senão os 14 deixariam de contar. ──
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
           or (m.stage <> 'group' and coalesce(p.points_earned, 0) >= coalesce((select points from public.scoring_rules where id = 'ko_exact'), 12))
      )::int as exact_score,
      bool_or(m.match_code = 'ko-final-1' and coalesce(p.points_earned, 0) >= coalesce((select points from public.scoring_rules where id = 'ko_exact'), 12)) as final_exact
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
$function$;

-- ── 4) Reapura os palpites de mata-mata já encerrados com a regra aditiva.
--       Classificado efetivo = pick explícito do chaveamento OU vencedor do placar
--       cravado (placar decisivo já indica quem passa). ──
update public.predictions p
set points_earned = public.calculate_prediction_points_v2(
  p.home_score, p.away_score, m.home_score, m.away_score, m.stage,
  coalesce(
    (select bp.picked_winner from public.bracket_picks bp
       where bp.user_id = p.user_id and bp.slot_id = public.match_slot_id(m.match_code) limit 1),
    case
      when p.home_score > p.away_score then m.home_code
      when p.home_score < p.away_score then m.away_code
      else null
    end
  ),
  m.winner
)
from public.matches m
where m.match_code = p.match_code
  and m.status = 'finished' and m.stage <> 'group'
  and m.home_score is not null and m.away_score is not null;

select public.refresh_ranking_snapshots();
