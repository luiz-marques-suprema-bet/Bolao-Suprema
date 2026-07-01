-- Bolao Suprema · Mata-mata: pontuação conforme as regras 5.2 (placar DESACOPLADO
-- do classificado).
--
-- Problema: a regra antiga "quem passa manda" TRAVAVA o placar pelo classificado
-- — quem cravava o placar (ex.: 1×1) mas errava quem passa levava só 2 em vez de
-- 12. Errado. Pelas regras 5.2, o placar/resultado valem por si e o classificado
-- é apenas um piso:
--   • Placar exato (conta prorrogação) ............ 12
--   • Resultado + placar de um time ............... 8
--   • Resultado apenas ............................ 5
--   • Só acertou o classificado (incl. pênaltis) .. 2
--   • Nada ........................................ 0
-- O "placar exato" usa o placar FINAL (que já inclui prorrogação); os pênaltis só
-- definem o classificado (o piso de 2).

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

  -- ── Mata-mata (regras 5.2): placar por si; classificado é só o piso de 2 ──
  adv_ok :=
    p_real_advancer is not null
    and upper(p_real_advancer) <> 'DRAW'
    and upper(coalesce(p_predicted_advancer, '')) = upper(p_real_advancer);

  if p_home = r_home and p_away = r_away then
    return coalesce(exact_points, 12);          -- placar exato (conta prorrogação)
  elsif same_outcome and one_team then
    return coalesce(score1_points, 8);          -- resultado + placar de um time
  elsif same_outcome then
    return coalesce(result_points, 5);          -- resultado
  elsif adv_ok then
    return coalesce(qualified_points, 2);       -- só acertou o classificado (incl. pênaltis)
  end if;
  return 0;
end;
$function$;

-- "Só acertou o classificado" agora vale 2 (era 3 na regra antiga).
update public.scoring_rules set points = 2 where id = 'ko_qualified';

-- Reapura os palpites de mata-mata já encerrados com a regra nova. Classificador
-- efetivo = pick explícito do chaveamento OU vencedor do placar cravado (decisivo).
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
