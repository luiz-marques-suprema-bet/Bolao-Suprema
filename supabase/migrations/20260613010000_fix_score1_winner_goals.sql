-- ============================================================================
-- Bolao Suprema · Correcao do +7/+8: exige os gols do VENCEDOR
-- ----------------------------------------------------------------------------
-- A regra documentada ao usuario (tela Ranking) sempre foi "Resultado + gols do
-- vencedor". A funcao, porem, concedia o +7 (grupos) / +8 (mata-mata) com o
-- resultado certo + gols de QUALQUER time — inclusive os do perdedor. Ex.: jogo
-- 4x1, palpite 2x1 ganhava 7 (gols do perdedor 1=1) quando deveria ganhar 5
-- (errou os gols do vencedor: 2<>4).
--
-- Esta migration corrige `calculate_prediction_points_v2` para exigir os gols do
-- time vencedor no nivel score1 e REAPURA todos os jogos ja encerrados, alem de
-- reconstruir o snapshot do ranking. Em empate nao ha vencedor, entao o teto com
-- resultado certo e 5. O nivel +1 (grupos, "gols de uma equipe") segue valendo
-- para qualquer time, pois nele o resultado nao foi acertado.
-- ============================================================================

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
  winner_goals boolean;
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

  -- Gols do time VENCEDOR (em empate nao ha vencedor → false).
  winner_goals :=
    (r_home > r_away and p_home = r_home)
    or (r_away > r_home and p_away = r_away);

  -- Gols de qualquer time — usado apenas no nivel +1 (resultado nao acertado).
  one_team := p_home = r_home or p_away = r_away;

  if same_outcome and winner_goals then
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

-- ── Reapuracao dos jogos ja encerrados com a regra corrigida ─────────────────
update public.predictions p
set points_earned = public.calculate_prediction_points_v2(
  p.home_score,
  p.away_score,
  m.home_score,
  m.away_score,
  m.stage,
  case
    when m.stage <> 'group' then (
      select bp.picked_winner
      from public.bracket_picks bp
      where bp.user_id = p.user_id
        and bp.slot_id = public.match_slot_id(m.match_code)
      limit 1
    )
    else null
  end,
  case when m.stage <> 'group' then m.winner else null end
)
from public.matches m
where m.match_code = p.match_code
  and m.status = 'finished'
  and m.home_score is not null
  and m.away_score is not null;

-- ── Reconstroi breakdowns + snapshot do ranking com os novos pontos ──────────
select public.refresh_ranking_snapshots();
