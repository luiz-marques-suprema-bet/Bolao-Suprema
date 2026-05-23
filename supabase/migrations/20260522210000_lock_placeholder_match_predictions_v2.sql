-- Bolao Suprema - never accept score predictions for placeholder knockout matches.

update public.matches
set market_status = 'locked',
    lock_reason = coalesce(lock_reason, 'knockout_placeholder'),
    locked_at = coalesce(locked_at, now()),
    stage_label = case
      when stage = 'round_of_32' then replace(stage_label, '32 AVOS', 'FASE DE 32')
      else stage_label
    end
where coalesce(home_code, 'TBD') = 'TBD'
   or coalesce(away_code, 'TBD') = 'TBD';

update public.markets mk
set status = 'locked',
    lock_reason = coalesce(mk.lock_reason, 'knockout_placeholder'),
    updated_at = now()
from public.matches m
where mk.market_type = 'match_prediction'
  and mk.scope_type = 'match'
  and mk.scope_id = m.match_code
  and (coalesce(m.home_code, 'TBD') = 'TBD' or coalesce(m.away_code, 'TBD') = 'TBD');

create or replace function public.ensure_prediction_market_open()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  match_row public.matches%rowtype;
begin
  if tg_op = 'UPDATE'
    and new.match_code       is not distinct from old.match_code
    and new.home_score       is not distinct from old.home_score
    and new.away_score       is not distinct from old.away_score
    and new.points_earned    is distinct from old.points_earned
  then
    return new;
  end if;

  select * into match_row
  from public.matches
  where match_code = new.match_code;

  if not found then
    raise exception 'Partida nao encontrada: %', new.match_code;
  end if;

  if coalesce(match_row.home_code, 'TBD') = 'TBD'
     or coalesce(match_row.away_code, 'TBD') = 'TBD'
  then
    raise exception 'Jogo aguardando classificados. Palpite de placar ainda indisponivel.';
  end if;

  if coalesce(match_row.market_status, 'open') <> 'open'
    or match_row.status in ('locked', 'live', 'finished')
    or (match_row.kickoff_utc is not null and match_row.kickoff_utc <= now())
  then
    raise exception 'Mercado fechado. Palpite nao pode ser criado ou alterado.';
  end if;

  return new;
end;
$$;

create or replace function public.save_match_predictions(p_predictions jsonb)
returns table(
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
  if v_user_id is null then
    raise exception 'Sessao invalida.';
  end if;

  if not exists (select 1 from public.users where users.id = v_user_id and participant_status = 'active') then
    raise exception 'Participante pendente, bloqueado ou removido.';
  end if;

  if p_predictions is null or jsonb_typeof(p_predictions) <> 'array' then
    raise exception 'Payload de palpites invalido.';
  end if;

  for v_item in select value from jsonb_array_elements(p_predictions) loop
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

    if coalesce(v_match.home_code, 'TBD') = 'TBD'
       or coalesce(v_match.away_code, 'TBD') = 'TBD'
    then
      raise exception 'Jogo aguardando classificados. Palpite de placar ainda indisponivel.';
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

    update public.predictions p
    set home_score = v_home_score,
        away_score = v_away_score,
        submitted_at = v_submitted_at,
        points_earned = null
    where p.user_id = v_user_id
      and p.match_code = v_match_code
    returning * into v_prediction;

    if not found then
      insert into public.predictions(user_id, match_code, home_score, away_score, submitted_at)
      values (v_user_id, v_match_code, v_home_score, v_away_score, v_submitted_at)
      returning * into v_prediction;
    end if;

    return query
      select v_prediction.id, v_prediction.user_id, v_prediction.match_code,
             v_prediction.home_score, v_prediction.away_score,
             v_prediction.submitted_at, v_prediction.points_earned;
  end loop;
end;
$$;

revoke execute on function public.ensure_prediction_market_open() from public, anon, authenticated;
grant execute on function public.save_match_predictions(jsonb) to authenticated;
