create index if not exists idx_matches_locked_by on public.matches(locked_by);

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
