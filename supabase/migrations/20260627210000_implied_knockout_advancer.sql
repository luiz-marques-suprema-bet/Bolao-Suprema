-- Bolao Suprema · Mata-mata: classificador IMPLÍCITO pelo placar cravado.
--
-- Bug: no mata-mata a pontuação é "travada" por quem passa (adv_ok). Se o
-- palpiteiro NÃO tinha o "quem avança" salvo (bracket_pick) para aquele slot, um
-- palpite com RESULTADO CERTO (ex.: 3×1 pro Brasil, real 2×1) pontuava 0 — porque
-- adv_ok=false. Mas um placar decisivo (3×1) JÁ DIZ quem passa (o vencedor do seu
-- placar). Ex. real: Jean cravou 3×1 BRA e levou 0.
--
-- Fix: o "quem passa" efetivo passa a ser COALESCE(palpite explícito do bracket,
-- vencedor do PLACAR cravado quando há vencedor). Só cai pro explícito quando o
-- placar cravado é empate (aí não dá pra inferir). É seguro: só ADICIONA um
-- fallback quando não havia palpite explícito — ninguém perde pontos.

create or replace function public.auto_score_match_predictions()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
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
      -- "quem passa" efetivo: palpite explícito OU, na falta dele, o vencedor do
      -- placar cravado (placar decisivo já indica o classificador). Empate sem
      -- palpite explícito -> null (não dá pra inferir).
      case
        when new.stage = 'group' then null
        else coalesce(
          (select bp.picked_winner
             from public.bracket_picks bp
            where bp.user_id = p.user_id
              and bp.slot_id = v_slot_id
            limit 1),
          case
            when p.home_score > p.away_score then new.home_code
            when p.home_score < p.away_score then new.away_code
            else null
          end
        )
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
$function$;

-- Backfill: re-apura os palpites de mata-mata já encerrados com a regra nova.
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
