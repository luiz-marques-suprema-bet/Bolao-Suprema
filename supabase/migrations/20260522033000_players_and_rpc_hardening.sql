-- Bolao Suprema - players catalog, scorer verification and exposed RPC hardening.

create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated;
grant usage on schema app_private to authenticated;

create or replace function app_private.is_owner(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users
    where id = uid
      and participant_status = 'active'
      and (is_owner = true or user_role = 'owner')
  );
$$;

create or replace function app_private.is_admin(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users
    where id = uid
      and participant_status = 'active'
      and (is_admin = true or is_owner = true or user_role in ('admin','owner'))
  );
$$;

create or replace function app_private.is_marketing(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users
    where id = uid
      and participant_status = 'active'
      and (is_marketing = true or is_admin = true or is_owner = true or user_role in ('marketing','admin','owner'))
  );
$$;

create or replace function public.is_owner(uid uuid default auth.uid())
returns boolean
language sql
stable
set search_path = public, app_private
as $$ select app_private.is_owner(uid); $$;

create or replace function public.is_admin(uid uuid default auth.uid())
returns boolean
language sql
stable
set search_path = public, app_private
as $$ select app_private.is_admin(uid); $$;

create or replace function public.is_marketing(uid uuid default auth.uid())
returns boolean
language sql
stable
set search_path = public, app_private
as $$ select app_private.is_marketing(uid); $$;

create table if not exists public.players (
  id uuid primary key default uuid_generate_v4(),
  team_code text,
  display_name text not null,
  normalized_name text not null,
  external_id text,
  source text not null default 'manual',
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (team_code, normalized_name),
  unique (source, external_id)
);

alter table public.players enable row level security;

drop policy if exists players_select_authenticated on public.players;
create policy players_select_authenticated
on public.players for select to authenticated
using (status = 'active');

drop policy if exists players_admin_insert on public.players;
create policy players_admin_insert
on public.players for insert to authenticated
with check (public.is_admin((select auth.uid())));

drop policy if exists players_admin_update on public.players;
create policy players_admin_update
on public.players for update to authenticated
using (public.is_admin((select auth.uid())))
with check (public.is_admin((select auth.uid())));

drop policy if exists players_admin_delete on public.players;
create policy players_admin_delete
on public.players for delete to authenticated
using (public.is_admin((select auth.uid())));

create index if not exists idx_players_normalized_name
on public.players(normalized_name)
where status = 'active';

alter table public.special_picks
  add column if not exists player_id uuid references public.players(id) on delete set null,
  add column if not exists scorer_unverified boolean not null default false;

create index if not exists idx_special_picks_player_id on public.special_picks(player_id);

drop policy if exists markets_admin_write on public.markets;
drop policy if exists markets_admin_insert on public.markets;
create policy markets_admin_insert
on public.markets for insert to authenticated
with check (public.is_admin((select auth.uid())));

drop policy if exists markets_admin_update on public.markets;
create policy markets_admin_update
on public.markets for update to authenticated
using (public.is_admin((select auth.uid())))
with check (public.is_admin((select auth.uid())));

drop policy if exists markets_admin_delete on public.markets;
create policy markets_admin_delete
on public.markets for delete to authenticated
using (public.is_admin((select auth.uid())));

create or replace function public.save_general_picks(p_champion text, p_vice text, p_scorer text)
returns public.users
language plpgsql
set search_path = public
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

  if not exists (select 1 from public.users where id = v_user_id and participant_status = 'active') then
    raise exception 'Participante pendente, bloqueado ou removido.';
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

    select * into v_match from public.matches where matches.match_code = v_match_code;
    if not found then
      raise exception 'Partida nao encontrada: %', v_match_code;
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

    insert into public.predictions(user_id, match_code, home_score, away_score, submitted_at)
    values (v_user_id, v_match_code, v_home_score, v_away_score, v_submitted_at)
    on conflict (user_id, match_code) do update set
      home_score = excluded.home_score,
      away_score = excluded.away_score,
      submitted_at = excluded.submitted_at,
      points_earned = null
    returning * into v_prediction;

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

do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'admin_bulk_match_status',
        'admin_delete_prediction',
        'admin_set_user_role',
        'admin_update_match_status',
        'create_participant_invite',
        'delete_bracket_pick',
        'moderate_chat_message',
        'redeem_participant_invite',
        'refresh_ranking_snapshots',
        'save_bracket_pick',
        'save_general_picks',
        'save_match_predictions',
        'save_prediction',
        'save_scoring_rule',
        'set_match_market_status',
        'settle_match_result',
        'update_participant_status'
      )
  loop
    execute format('alter function %s security invoker', r.signature);
  end loop;
end $$;

grant select on public.players to authenticated;
grant select, insert, update on public.special_picks to authenticated;
grant execute on function public.save_general_picks(text,text,text) to authenticated;
grant execute on function public.save_match_predictions(jsonb) to authenticated;
revoke execute on function public.close_expired_markets() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'net') then
    revoke all on schema net from public, anon, authenticated;
    revoke all on all tables in schema net from public, anon, authenticated;
    revoke all on all functions in schema net from public, anon, authenticated;
  end if;
end $$;
