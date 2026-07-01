-- Bolao Suprema · Mata-mata: correção — o bônus de +2 do classificado só existe
-- quando o JOGO EMPATA no tempo regulamentar (vai para pênaltis/prorrogação).
--
-- Decisão do grupo (2026-07-01): "resultado em tempo normal não pode ser 14";
-- "2 pts é bônus quando empata e acerta o classificado". Ou seja:
--   • Jogo DECIDIDO nos 90 min → só o placar (12 / 8 / 5 / 0), máximo 12.
--   • Jogo que EMPATOU nos 90 min (foi p/ pênaltis) → placar + 2 se acertou quem
--     passa → máximo 14.
-- Isto corrige a migration anterior (20260701180000), que somava o +2 em QUALQUER
-- jogo (inclusive decisivos). O placar continua contando só o tempo regulamentar.

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

  -- Acertou o classificado (winner real, inclui prorrogação/pênaltis)?
  adv_ok :=
    p_real_advancer is not null
    and upper(p_real_advancer) <> 'DRAW'
    and upper(coalesce(p_predicted_advancer, '')) = upper(p_real_advancer);

  -- Bônus de +2 SÓ quando o jogo EMPATOU no tempo regulamentar (r_home = r_away):
  -- aí a prorrogação/pênaltis decidem quem passa. Jogo decidido nos 90 min: sem bônus.
  return placar + (case when r_home = r_away and adv_ok then coalesce(qualified_points, 2) else 0 end);
end;
$function$;

-- Reapura os palpites de mata-mata já encerrados com a regra corrigida. Classificado
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
