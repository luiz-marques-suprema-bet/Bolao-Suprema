-- Mata-mata: "quem passa manda". Acertar o CLASSIFICADO é obrigatório pra
-- pontuar de verdade; o placar (tempo regulamentar) é bônus em cima dele.
--
--   ACERTOU quem passa:
--     placar exato (90')        -> 12  (CRAVADA)
--     resultado + gols do venc. -> 8
--     resultado certo (90')     -> 5
--     só acertou quem passa     -> 3
--   ERROU quem passa:
--     cravou o placar (90')     -> 2   (consolação)
--     resto                     -> 0
--
-- Fase de grupos: INALTERADA. Nenhum jogo de mata-mata foi disputado quando
-- esta regra entrou (Jun/2026), então não há reprocessamento de pontos.

-- ── Regras na tabela (fonte editável pelo admin) ──
update public.scoring_rules
  set points = 3, label = 'Só acertou quem passa', sort_order = 80
  where id = 'ko_qualified';

insert into public.scoring_rules (id, label, category, stage, points, sort_order, is_active)
values ('ko_score_only', 'Cravou o placar, mas errou quem passa', 'match', 'knockout', 2, 85, true)
on conflict (id) do update
  set points = excluded.points, label = excluded.label,
      category = excluded.category, stage = excluded.stage,
      sort_order = excluded.sort_order, is_active = true;

-- ── Função de pontuação (autoridade do servidor) ──
create or replace function public.calculate_prediction_points_v2(
  p_home integer, p_away integer, r_home integer, r_away integer,
  p_stage text default 'group',
  p_predicted_advancer text default null,
  p_real_advancer text default null
)
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
  score_only_points integer;
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
  select points into score_only_points from public.scoring_rules where id = 'ko_score_only';

  same_outcome :=
    (p_home = p_away and r_home = r_away)
    or (p_home > p_away and r_home > r_away)
    or (p_home < p_away and r_home < r_away);

  -- Gols do time VENCEDOR (em empate não há vencedor → false).
  winner_goals :=
    (r_home > r_away and p_home = r_home)
    or (r_away > r_home and p_away = r_away);

  -- Gols de qualquer time — usado apenas no nível +1 da fase de grupos.
  one_team := p_home = r_home or p_away = r_away;

  -- ── Fase de grupos (inalterada) ──
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

  -- ── Mata-mata: quem passa manda ──
  adv_ok :=
    p_real_advancer is not null
    and upper(p_real_advancer) <> 'DRAW'
    and upper(coalesce(p_predicted_advancer, '')) = upper(p_real_advancer);

  if adv_ok then
    if p_home = r_home and p_away = r_away then
      return coalesce(exact_points, 12);             -- CRAVADA
    elsif same_outcome and winner_goals then
      return coalesce(score1_points, 8);
    elsif same_outcome then
      return coalesce(result_points, 5);
    else
      return coalesce(qualified_points, 3);          -- só acertou quem passa
    end if;
  else
    -- errou quem passa: só consolação se cravou o placar do tempo normal
    if p_home = r_home and p_away = r_away then
      return coalesce(score_only_points, 2);
    end if;
    return 0;
  end if;
end;
$function$;
