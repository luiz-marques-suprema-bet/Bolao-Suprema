-- Bolao Suprema - launch access guardrails.
--
-- Product decision for launch: approval is not part of onboarding anymore.
-- New and legacy participants can use predictions and Resenha unless an admin
-- explicitly blocks or removes them.

update public.users
set participant_status = 'active'
where participant_status = 'pending';

create or replace function public.ensure_active_participant()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.users
    where id = new.user_id
      and participant_status not in ('blocked', 'removed')
  ) then
    raise exception 'Participante bloqueado ou removido.';
  end if;

  return new;
end;
$$;

drop policy if exists "chat_reactions_insert_own" on public.chat_message_reactions;
create policy "chat_reactions_insert_own"
on public.chat_message_reactions
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.users u
    where u.id = (select auth.uid())
      and u.participant_status not in ('blocked', 'removed')
  )
);

create or replace function app_private.save_general_picks(p_champion text, p_vice text, p_scorer text)
returns public.users
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user public.users%rowtype;
  v_after public.users%rowtype;
  v_champion text := nullif(trim(coalesce(p_champion, '')), '');
  v_vice text := nullif(trim(coalesce(p_vice, '')), '');
  v_scorer text := nullif(regexp_replace(trim(coalesce(p_scorer, '')), '\s+', ' ', 'g'), '');
  v_scorer_norm text;
  v_player_id uuid;
  v_closed boolean;
begin
  select * into v_user from public.users where id = auth.uid();
  if not found or v_user.participant_status in ('blocked', 'removed') then
    raise exception 'Participante bloqueado ou removido.';
  end if;

  select exists (
    select 1
    from public.markets
    where market_type = 'special'
      and scope_type = 'tournament'
      and scope_id in ('champion','vice','scorer')
      and (status <> 'open' or closes_at <= now())
  ) into v_closed;
  if v_closed then
    raise exception 'Mercado de apostas especiais encerrado.';
  end if;

  if v_champion is not null and not exists (select 1 from public.matches where home_code = v_champion or away_code = v_champion) then
    raise exception 'Selecao campea invalida.';
  end if;
  if v_vice is not null and not exists (select 1 from public.matches where home_code = v_vice or away_code = v_vice) then
    raise exception 'Selecao vice invalida.';
  end if;
  if v_champion is not null and v_champion = v_vice then
    raise exception 'Campeao e vice nao podem ser a mesma selecao.';
  end if;
  if v_scorer is not null and (length(v_scorer) < 2 or length(v_scorer) > 100 or v_scorer !~ '^[[:alnum:][:space:].''-]+$') then
    raise exception 'Nome do artilheiro invalido.';
  end if;

  if v_scorer is not null then
    v_scorer_norm := lower(v_scorer);
    select id into v_player_id
    from (
      select id, count(*) over () as match_count
      from public.players
      where normalized_name = v_scorer_norm
        and status = 'active'
    ) p
    where match_count = 1
    limit 1;
  end if;

  insert into public.special_picks(user_id, market_id, pick_type, team_code, player_name, player_id, scorer_unverified)
  select auth.uid(), id, 'champion', v_champion, null, null, false
  from public.markets
  where market_type = 'special' and scope_id = 'champion' and v_champion is not null
  on conflict (user_id, pick_type) do update set
    team_code = excluded.team_code,
    player_name = null,
    player_id = null,
    scorer_unverified = false,
    market_id = excluded.market_id,
    updated_at = now();

  insert into public.special_picks(user_id, market_id, pick_type, team_code, player_name, player_id, scorer_unverified)
  select auth.uid(), id, 'vice', v_vice, null, null, false
  from public.markets
  where market_type = 'special' and scope_id = 'vice' and v_vice is not null
  on conflict (user_id, pick_type) do update set
    team_code = excluded.team_code,
    player_name = null,
    player_id = null,
    scorer_unverified = false,
    market_id = excluded.market_id,
    updated_at = now();

  insert into public.special_picks(user_id, market_id, pick_type, team_code, player_name, player_id, scorer_unverified)
  select auth.uid(), id, 'scorer', null, v_scorer, v_player_id, v_player_id is null
  from public.markets
  where market_type = 'special' and scope_id = 'scorer' and v_scorer is not null
  on conflict (user_id, pick_type) do update set
    team_code = null,
    player_name = excluded.player_name,
    player_id = excluded.player_id,
    scorer_unverified = excluded.scorer_unverified,
    market_id = excluded.market_id,
    updated_at = now();

  perform set_config('app.allow_special_pick_update', '1', true);
  update public.users
  set champion_pick = v_champion,
      vice_pick = v_vice,
      scorer_pick = v_scorer
  where id = auth.uid()
  returning * into v_after;

  perform public.log_audit('general_picks_updated', 'user', auth.uid()::text, to_jsonb(v_user), to_jsonb(v_after));
  return v_after;
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

  if not exists (
    select 1
    from public.users
    where users.id = v_user_id
      and participant_status not in ('blocked', 'removed')
  ) then
    raise exception 'Participante bloqueado ou removido.';
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

grant execute on function public.save_match_predictions(jsonb) to authenticated;
grant execute on function public.save_general_picks(text,text,text) to authenticated;
