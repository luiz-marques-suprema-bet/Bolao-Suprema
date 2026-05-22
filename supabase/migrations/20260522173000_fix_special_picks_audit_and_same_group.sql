-- Bolao Suprema - allow champion/vice from same group and keep audit internal.

create schema if not exists app_private;
revoke all on schema app_private from public, anon;
grant usage on schema app_private to authenticated;

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
  if not found or v_user.participant_status <> 'active' then
    raise exception 'Participante pendente, bloqueado ou removido.';
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

create or replace function public.validate_general_picks()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.champion_pick is not null
     and new.vice_pick is not null
     and new.champion_pick = new.vice_pick
  then
    raise exception 'Campeao e vice nao podem ser a mesma selecao.';
  end if;

  return new;
end;
$$;

create or replace function public.save_general_picks(p_champion text, p_vice text, p_scorer text)
returns public.users
language sql
set search_path = ''
as $$
  select * from app_private.save_general_picks(p_champion, p_vice, p_scorer);
$$;

revoke execute on function app_private.save_general_picks(text,text,text) from public, anon;
grant execute on function app_private.save_general_picks(text,text,text) to authenticated;
revoke execute on function public.validate_general_picks() from public, anon, authenticated;
revoke execute on function public.log_audit(text,text,text,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.save_general_picks(text,text,text) to authenticated;
