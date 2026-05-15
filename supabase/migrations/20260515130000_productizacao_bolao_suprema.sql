alter table public.matches
  add column if not exists market_status text not null default 'open',
  add column if not exists locked_at timestamptz,
  add column if not exists locked_by uuid references public.users(id) on delete set null,
  add column if not exists lock_reason text,
  add column if not exists unlocked_at timestamptz,
  add column if not exists settled_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'matches_market_status_check'
      and conrelid = 'public.matches'::regclass
  ) then
    alter table public.matches
      add constraint matches_market_status_check
      check (market_status in ('open', 'locked', 'closed', 'settled'));
  end if;
end $$;

alter table public.bulletins
  add column if not exists image_fit_mode text not null default 'contain';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'bulletins_image_fit_mode_check'
      and conrelid = 'public.bulletins'::regclass
  ) then
    alter table public.bulletins
      add constraint bulletins_image_fit_mode_check
      check (image_fit_mode in ('cover', 'contain'));
  end if;
end $$;

with canonical(match_code, kickoff_utc, match_date, match_time) as (
  values
    ('g-a-1', '2026-06-11T19:00:00.000Z'::timestamptz, 'QUI 11 JUN', '16:00'),
    ('g-a-2', '2026-06-12T02:00:00.000Z'::timestamptz, 'QUI 11 JUN', '23:00'),
    ('g-b-1', '2026-06-12T19:00:00.000Z'::timestamptz, 'SEX 12 JUN', '16:00'),
    ('g-d-1', '2026-06-13T01:00:00.000Z'::timestamptz, 'SEX 12 JUN', '22:00'),
    ('g-b-2', '2026-06-13T19:00:00.000Z'::timestamptz, 'SAB 13 JUN', '16:00'),
    ('g-c-1', '2026-06-13T22:00:00.000Z'::timestamptz, 'SAB 13 JUN', '19:00'),
    ('g-c-2', '2026-06-14T01:00:00.000Z'::timestamptz, 'SAB 13 JUN', '22:00'),
    ('g-d-2', '2026-06-14T16:00:00.000Z'::timestamptz, 'DOM 14 JUN', '13:00'),
    ('g-e-1', '2026-06-14T17:00:00.000Z'::timestamptz, 'DOM 14 JUN', '14:00'),
    ('g-f-1', '2026-06-14T20:00:00.000Z'::timestamptz, 'DOM 14 JUN', '17:00'),
    ('g-e-2', '2026-06-14T23:00:00.000Z'::timestamptz, 'DOM 14 JUN', '20:00'),
    ('g-f-2', '2026-06-15T02:00:00.000Z'::timestamptz, 'DOM 14 JUN', '23:00'),
    ('g-h-1', '2026-06-15T16:00:00.000Z'::timestamptz, 'SEG 15 JUN', '13:00'),
    ('g-g-1', '2026-06-15T19:00:00.000Z'::timestamptz, 'SEG 15 JUN', '16:00'),
    ('g-h-2', '2026-06-15T22:00:00.000Z'::timestamptz, 'SEG 15 JUN', '19:00'),
    ('g-g-2', '2026-06-16T01:00:00.000Z'::timestamptz, 'SEG 15 JUN', '22:00'),
    ('g-i-1', '2026-06-16T19:00:00.000Z'::timestamptz, 'TER 16 JUN', '16:00'),
    ('g-i-2', '2026-06-16T22:00:00.000Z'::timestamptz, 'TER 16 JUN', '19:00'),
    ('g-j-1', '2026-06-17T01:00:00.000Z'::timestamptz, 'TER 16 JUN', '22:00'),
    ('g-j-2', '2026-06-17T14:00:00.000Z'::timestamptz, 'QUA 17 JUN', '11:00'),
    ('g-k-1', '2026-06-17T17:00:00.000Z'::timestamptz, 'QUA 17 JUN', '14:00'),
    ('g-l-1', '2026-06-17T20:00:00.000Z'::timestamptz, 'QUA 17 JUN', '17:00'),
    ('g-l-2', '2026-06-17T23:00:00.000Z'::timestamptz, 'QUA 17 JUN', '20:00'),
    ('g-k-2', '2026-06-18T02:00:00.000Z'::timestamptz, 'QUA 17 JUN', '23:00'),
    ('g-a-3', '2026-06-18T16:00:00.000Z'::timestamptz, 'QUI 18 JUN', '13:00'),
    ('g-b-3', '2026-06-18T19:00:00.000Z'::timestamptz, 'QUI 18 JUN', '16:00'),
    ('g-b-4', '2026-06-18T22:00:00.000Z'::timestamptz, 'QUI 18 JUN', '19:00'),
    ('g-a-4', '2026-06-19T01:00:00.000Z'::timestamptz, 'QUI 18 JUN', '22:00'),
    ('g-d-3', '2026-06-19T19:00:00.000Z'::timestamptz, 'SEX 19 JUN', '16:00'),
    ('g-c-3', '2026-06-19T22:00:00.000Z'::timestamptz, 'SEX 19 JUN', '19:00'),
    ('g-c-4', '2026-06-20T00:30:00.000Z'::timestamptz, 'SEX 19 JUN', '21:30'),
    ('g-d-4', '2026-06-20T03:00:00.000Z'::timestamptz, 'SAB 20 JUN', '00:00'),
    ('g-f-3', '2026-06-20T17:00:00.000Z'::timestamptz, 'SAB 20 JUN', '14:00'),
    ('g-e-3', '2026-06-20T20:00:00.000Z'::timestamptz, 'SAB 20 JUN', '17:00'),
    ('g-e-4', '2026-06-21T00:00:00.000Z'::timestamptz, 'SAB 20 JUN', '21:00'),
    ('g-f-4', '2026-06-21T03:00:00.000Z'::timestamptz, 'DOM 21 JUN', '00:00'),
    ('g-h-3', '2026-06-21T16:00:00.000Z'::timestamptz, 'DOM 21 JUN', '13:00'),
    ('g-g-3', '2026-06-21T19:00:00.000Z'::timestamptz, 'DOM 21 JUN', '16:00'),
    ('g-h-4', '2026-06-21T22:00:00.000Z'::timestamptz, 'DOM 21 JUN', '19:00'),
    ('g-g-4', '2026-06-22T01:00:00.000Z'::timestamptz, 'DOM 21 JUN', '22:00'),
    ('g-j-3', '2026-06-22T17:00:00.000Z'::timestamptz, 'SEG 22 JUN', '14:00'),
    ('g-i-3', '2026-06-22T21:00:00.000Z'::timestamptz, 'SEG 22 JUN', '18:00'),
    ('g-i-4', '2026-06-23T00:00:00.000Z'::timestamptz, 'SEG 22 JUN', '21:00'),
    ('g-j-4', '2026-06-23T03:00:00.000Z'::timestamptz, 'TER 23 JUN', '00:00'),
    ('g-k-3', '2026-06-23T17:00:00.000Z'::timestamptz, 'TER 23 JUN', '14:00'),
    ('g-l-3', '2026-06-23T20:00:00.000Z'::timestamptz, 'TER 23 JUN', '17:00'),
    ('g-l-4', '2026-06-23T23:00:00.000Z'::timestamptz, 'TER 23 JUN', '20:00'),
    ('g-k-4', '2026-06-24T02:00:00.000Z'::timestamptz, 'TER 23 JUN', '23:00'),
    ('g-b-5', '2026-06-24T19:00:00.000Z'::timestamptz, 'QUA 24 JUN', '16:00'),
    ('g-b-6', '2026-06-24T19:00:00.000Z'::timestamptz, 'QUA 24 JUN', '16:00'),
    ('g-c-5', '2026-06-24T22:00:00.000Z'::timestamptz, 'QUA 24 JUN', '19:00'),
    ('g-c-6', '2026-06-24T22:00:00.000Z'::timestamptz, 'QUA 24 JUN', '19:00'),
    ('g-a-5', '2026-06-25T01:00:00.000Z'::timestamptz, 'QUA 24 JUN', '22:00'),
    ('g-a-6', '2026-06-25T01:00:00.000Z'::timestamptz, 'QUA 24 JUN', '22:00'),
    ('g-e-5', '2026-06-25T20:00:00.000Z'::timestamptz, 'QUI 25 JUN', '17:00'),
    ('g-e-6', '2026-06-25T20:00:00.000Z'::timestamptz, 'QUI 25 JUN', '17:00'),
    ('g-f-5', '2026-06-25T23:00:00.000Z'::timestamptz, 'QUI 25 JUN', '20:00'),
    ('g-f-6', '2026-06-25T23:00:00.000Z'::timestamptz, 'QUI 25 JUN', '20:00'),
    ('g-d-5', '2026-06-26T02:00:00.000Z'::timestamptz, 'QUI 25 JUN', '23:00'),
    ('g-d-6', '2026-06-26T02:00:00.000Z'::timestamptz, 'QUI 25 JUN', '23:00'),
    ('g-i-5', '2026-06-26T19:00:00.000Z'::timestamptz, 'SEX 26 JUN', '16:00'),
    ('g-i-6', '2026-06-26T19:00:00.000Z'::timestamptz, 'SEX 26 JUN', '16:00'),
    ('g-h-5', '2026-06-27T00:00:00.000Z'::timestamptz, 'SEX 26 JUN', '21:00'),
    ('g-h-6', '2026-06-27T00:00:00.000Z'::timestamptz, 'SEX 26 JUN', '21:00'),
    ('g-g-5', '2026-06-27T03:00:00.000Z'::timestamptz, 'SAB 27 JUN', '00:00'),
    ('g-g-6', '2026-06-27T03:00:00.000Z'::timestamptz, 'SAB 27 JUN', '00:00'),
    ('g-l-5', '2026-06-27T21:00:00.000Z'::timestamptz, 'SAB 27 JUN', '18:00'),
    ('g-l-6', '2026-06-27T21:00:00.000Z'::timestamptz, 'SAB 27 JUN', '18:00'),
    ('g-k-5', '2026-06-27T23:30:00.000Z'::timestamptz, 'SAB 27 JUN', '20:30'),
    ('g-k-6', '2026-06-27T23:30:00.000Z'::timestamptz, 'SAB 27 JUN', '20:30'),
    ('g-j-5', '2026-06-28T02:00:00.000Z'::timestamptz, 'SAB 27 JUN', '23:00'),
    ('g-j-6', '2026-06-28T02:00:00.000Z'::timestamptz, 'SAB 27 JUN', '23:00')
)
update public.matches m
set kickoff_utc = c.kickoff_utc,
    match_date = c.match_date,
    match_time = c.match_time,
    market_status = case
      when m.status = 'locked' then 'locked'
      when m.status = 'finished' then 'settled'
      when m.status = 'live' then 'closed'
      else coalesce(nullif(m.market_status, ''), 'open')
    end,
    updated_at = now()
from canonical c
where m.match_code = c.match_code;

update public.bulletins
set image_fit_mode = 'contain'
where image_fit_mode is null;

create or replace function public.ensure_prediction_market_open()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  match_row public.matches%rowtype;
begin
  if tg_op = 'UPDATE'
     and new.match_code is not distinct from old.match_code
     and new.home_score is not distinct from old.home_score
     and new.away_score is not distinct from old.away_score then
    return new;
  end if;

  select * into match_row
  from public.matches
  where match_code = new.match_code;

  if not found then
    raise exception 'Partida nao encontrada para palpite: %', new.match_code;
  end if;

  if coalesce(match_row.market_status, 'open') <> 'open'
     or match_row.status in ('locked', 'live', 'finished')
     or (match_row.kickoff_utc is not null and match_row.kickoff_utc <= now()) then
    raise exception 'Mercado fechado para a partida %', new.match_code;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_predictions_market_open on public.predictions;
create trigger trg_predictions_market_open
before insert or update on public.predictions
for each row execute function public.ensure_prediction_market_open();

create or replace function public.team_group(team_code text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when team_code = any(array['MEX','RSA','KOR','CZE']) then 'A'
    when team_code = any(array['CAN','SUI','QAT','BIH']) then 'B'
    when team_code = any(array['BRA','MAR','HTI','SCO']) then 'C'
    when team_code = any(array['USA','PAR','AUS','TUR']) then 'D'
    when team_code = any(array['GER','CUW','CIV','ECU']) then 'E'
    when team_code = any(array['NED','JPN','SWE','TUN']) then 'F'
    when team_code = any(array['BEL','EGY','IRN','NZL']) then 'G'
    when team_code = any(array['ESP','CPV','KSA','URU']) then 'H'
    when team_code = any(array['FRA','SEN','NOR','IRQ']) then 'I'
    when team_code = any(array['ARG','ALG','AUT','JOR']) then 'J'
    when team_code = any(array['POR','COD','UZB','COL']) then 'K'
    when team_code = any(array['ENG','CRO','GHA','PAN']) then 'L'
    else null
  end;
$$;

create or replace function public.validate_general_picks()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.champion_pick is not null and new.vice_pick is not null then
    if new.champion_pick = new.vice_pick then
      raise exception 'Campeao e vice nao podem ser a mesma selecao.';
    end if;

    if public.team_group(new.champion_pick) is not null
       and public.team_group(new.champion_pick) = public.team_group(new.vice_pick) then
      raise exception 'Campeao e vice nao podem ser do mesmo grupo.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_general_picks on public.users;
create trigger trg_validate_general_picks
before insert or update of champion_pick, vice_pick on public.users
for each row execute function public.validate_general_picks();
