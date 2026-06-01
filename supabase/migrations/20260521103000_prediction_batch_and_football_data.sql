-- ============================================================================
-- Bolao Suprema · prediction independence + football-data.org sync foundation
-- ============================================================================
-- Apply this before enabling the Edge Function below.
-- It keeps normal user prediction flow independent from admin screens:
-- users can save one match or a whole group while each match market is open.
-- Admin remains an override layer only.
-- ============================================================================

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
  v_prediction public.predictions%rowtype;
  v_match_code text;
  v_home_score integer;
  v_away_score integer;
  v_submitted_at timestamptz;
begin
  if v_user_id is null then
    raise exception 'Sessao invalida.';
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

    select * into v_match
    from public.matches
    where matches.match_code = v_match_code;

    if not found then
      raise exception 'Partida nao encontrada: %', v_match_code;
    end if;

    if coalesce(v_match.market_status, 'open') <> 'open'
      or v_match.status in ('locked', 'live', 'finished')
      or (v_match.kickoff_utc is not null and v_match.kickoff_utc <= now())
    then
      raise exception 'Mercado fechado para a partida %.', v_match_code;
    end if;

    select * into v_prediction
    from public.predictions p
    where p.user_id = v_user_id
      and p.match_code = v_match_code
    for update;

    if found then
      update public.predictions p
      set home_score = v_home_score,
          away_score = v_away_score,
          submitted_at = v_submitted_at,
          points_earned = null
      where p.id = v_prediction.id
      returning * into v_prediction;
    else
      insert into public.predictions (
        user_id,
        match_code,
        home_score,
        away_score,
        submitted_at
      )
      values (
        v_user_id,
        v_match_code,
        v_home_score,
        v_away_score,
        v_submitted_at
      )
      returning * into v_prediction;
    end if;

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

grant execute on function public.save_match_predictions(jsonb) to authenticated;

-- Make the older market-only helper safe if it is ever used by admin tooling.
create or replace function public.set_match_market_status(
  p_match_code text,
  p_market_status text,
  p_reason text default null
)
returns public.matches
language plpgsql
security definer
set search_path = public
as $$
declare
  before_row public.matches%rowtype;
  after_row public.matches%rowtype;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Apenas admin pode alterar mercado.';
  end if;

  if p_market_status not in ('open','locked','closed','settled') then
    raise exception 'Status de mercado invalido.';
  end if;

  select * into before_row from public.matches where match_code = p_match_code;
  if not found then
    raise exception 'Partida nao encontrada.';
  end if;

  update public.matches
  set market_status = p_market_status,
      status = case
        when p_market_status = 'locked' then 'locked'
        when p_market_status = 'closed' then case when status = 'live' then 'live' else status end
        when p_market_status = 'settled' then 'finished'
        else case when status in ('locked', 'finished') then 'scheduled' else status end
      end,
      locked_at = case when p_market_status = 'locked' then now() else null end,
      locked_by = case when p_market_status = 'locked' then auth.uid() else null end,
      lock_reason = case when p_market_status = 'locked' then coalesce(p_reason, 'admin_lock') else null end,
      unlocked_at = case when p_market_status = 'open' then now() else unlocked_at end,
      settled_at = case when p_market_status = 'settled' then now() when p_market_status = 'open' then null else settled_at end
  where match_code = p_match_code
  returning * into after_row;

  perform public.log_audit('market_' || p_market_status, 'match', p_match_code, to_jsonb(before_row), to_jsonb(after_row));
  return after_row;
end;
$$;

grant execute on function public.set_match_market_status(text, text, text) to authenticated;

alter table public.matches
  add column if not exists football_data_id integer unique,
  add column if not exists football_data_status text,
  add column if not exists football_data_last_updated timestamptz;

create index if not exists idx_matches_football_data_id
  on public.matches(football_data_id)
  where football_data_id is not null;
