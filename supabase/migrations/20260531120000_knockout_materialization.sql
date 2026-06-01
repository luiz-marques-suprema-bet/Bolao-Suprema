-- ============================================================================
-- Bolao Suprema · Materializacao automatica do mata-mata (DRAFT — branch
-- feat/knockout-materialization, NAO mergear sem revisao)
-- ----------------------------------------------------------------------------
-- Hoje os jogos de mata-mata ficam com home_code/away_code = 'TBD' ate alguem
-- preencher. Nao existe backend que materialize os classificados a partir dos
-- resultados dos grupos (auditoria 2026-05-31, §5). Esta migration adiciona:
--   1. compute_group_standings(grupo) — classificacao a partir dos jogos
--      'finished' (pts > saldo > gols > codigo; head-to-head = TODO, ver nota).
--   2. best_third_codes() — regra dos 8 melhores terceiros.
--   3. knockout_slot_map — de qual fonte (1o A, 2o B, 3o melhor n) vem cada slot
--      R32 (espelha src/data/wc2026.ts R32_PLACEHOLDERS).
--   4. materialize_knockout() — preenche home_code/away_code dos ko-r32-* quando
--      as fontes ficam conhecidas e destrava o mercado; idempotente.
--   5. trigger em matches: chama materialize_knockout() quando um jogo termina.
--   6. admin_set_knockout_teams() — fallback manual do admin.
--
-- NOTA DE ALCANCE (revisar antes de produção):
--   * A alocacao dos 8 melhores terceiros aos 8 slots de R32 usa a MESMA
--     simplificacao do frontend (ordem de ranking), NAO a matriz oficial FIFA
--     (que depende de QUAIS grupos classificam o 3o). Trocar por matriz oficial.
--   * Desempate head-to-head ainda nao implementado em SQL (usa pts/saldo/gols/
--     codigo, deterministico). Alinhar com src/lib/groupStandings.ts (M6).
--   * So materializa R32; rodadas seguintes (R16+) continuam dependendo de
--     resultados reais (sync/admin).
-- ============================================================================

-- ─── 1. Classificacao de um grupo (a partir de jogos finished) ───────────────
create or replace function public.compute_group_standings(p_group text)
returns table (code text, pts int, gf int, ga int, gd int, played int, finished_games int)
language sql
stable
security definer
set search_path = public
as $$
  with grp as (
    select home_code, away_code, home_score, away_score, status
    from public.matches
    where stage = 'group' and group_code = p_group
  ),
  teams as (
    select home_code as code from grp
    union
    select away_code from grp
  ),
  fin as (
    select * from grp where status = 'finished' and home_score is not null and away_score is not null
  )
  select
    t.code,
    coalesce(sum(case
      when f.home_code = t.code and f.home_score > f.away_score then 3
      when f.away_code = t.code and f.away_score > f.home_score then 3
      when (f.home_code = t.code or f.away_code = t.code) and f.home_score = f.away_score then 1
      else 0 end), 0)::int as pts,
    coalesce(sum(case when f.home_code = t.code then f.home_score when f.away_code = t.code then f.away_score else 0 end), 0)::int as gf,
    coalesce(sum(case when f.home_code = t.code then f.away_score when f.away_code = t.code then f.home_score else 0 end), 0)::int as ga,
    coalesce(sum(case when f.home_code = t.code then f.home_score - f.away_score
                      when f.away_code = t.code then f.away_score - f.home_score else 0 end), 0)::int as gd,
    (select count(*) from grp)::int as played,
    coalesce(count(f.home_code), 0)::int as finished_games
  from teams t
  left join fin f on (f.home_code = t.code or f.away_code = t.code)
  where t.code is not null and t.code <> 'TBD'
  group by t.code
$$;

-- ordem dentro do grupo: pts > saldo > gols > codigo (deterministico).
-- head-to-head: TODO (ver nota de alcance).
create or replace function public.group_rank(p_group text, p_pos int)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select code
  from public.compute_group_standings(p_group)
  order by pts desc, gd desc, gf desc, code asc
  offset greatest(p_pos - 1, 0) limit 1
$$;

-- ─── 2. Regra dos 8 melhores terceiros ───────────────────────────────────────
create or replace function public.best_third_codes()
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  with thirds as (
    select g as grp, public.group_rank(g, 3) as code
    from (select distinct group_code from public.matches where stage = 'group') q(g)
  ),
  ranked as (
    select t.code, s.pts, s.gd, s.gf
    from thirds t
    join lateral public.compute_group_standings(t.grp) s on s.code = t.code
    where t.code is not null
  )
  select array_agg(code order by pts desc, gd desc, gf desc, code asc)
  from (select code, pts, gd, gf from ranked order by pts desc, gd desc, gf desc, code asc limit 8) x
$$;

-- ─── 3. Mapa de slots R32 (espelha src/data/wc2026.ts R32_PLACEHOLDERS) ───────
-- home_source/away_source: 'W:<grupo>' vencedor, 'R:<grupo>' 2o, 'T:<n>' n-esimo
-- melhor terceiro (1..8). A alocacao dos terceiros e SIMPLIFICADA (ver nota).
create table if not exists public.knockout_slot_map (
  match_code  text primary key,
  home_source text not null,
  away_source text not null
);

insert into public.knockout_slot_map (match_code, home_source, away_source) values
  ('ko-r32-1','W:A','T:1'), ('ko-r32-2','W:B','T:2'), ('ko-r32-3','W:C','T:3'),
  ('ko-r32-4','W:D','T:4'), ('ko-r32-5','W:E','T:5'), ('ko-r32-6','W:F','T:6'),
  ('ko-r32-7','W:G','T:7'), ('ko-r32-8','W:H','T:8'),
  ('ko-r32-9','W:I','R:A'), ('ko-r32-10','W:J','R:B'), ('ko-r32-11','W:K','R:C'),
  ('ko-r32-12','W:L','R:D'), ('ko-r32-13','R:E','R:F'), ('ko-r32-14','R:G','R:H'),
  ('ko-r32-15','R:I','R:J'), ('ko-r32-16','R:K','R:L')
on conflict (match_code) do update
  set home_source = excluded.home_source, away_source = excluded.away_source;

-- ─── 4. Resolve uma fonte para um codigo de time (ou null se ainda indefinido) ─
create or replace function public.resolve_ko_source(p_source text, p_thirds text[])
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  kind text := split_part(p_source, ':', 1);
  arg  text := split_part(p_source, ':', 2);
  grp_done boolean;
begin
  if kind = 'T' then
    -- so quando os 8 terceiros ja foram decididos (todos os grupos terminaram)
    if array_length(p_thirds, 1) is distinct from 8 then return null; end if;
    return p_thirds[arg::int];
  end if;
  -- W/R: exige o grupo 'arg' com todos os jogos finished
  select bool_and(status = 'finished') into grp_done
  from public.matches where stage = 'group' and group_code = arg;
  if not coalesce(grp_done, false) then return null; end if;
  if kind = 'W' then return public.group_rank(arg, 1); end if;
  if kind = 'R' then return public.group_rank(arg, 2); end if;
  return null;
end;
$$;

-- ─── 5. Materializa os slots R32 que ja puderem ser resolvidos ────────────────
create or replace function public.materialize_knockout()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_thirds text[];
  r record;
  v_home text;
  v_away text;
  v_count int := 0;
begin
  -- terceiros so existem quando TODOS os grupos terminaram
  if (select bool_and(status = 'finished') from public.matches where stage = 'group') then
    v_thirds := public.best_third_codes();
  else
    v_thirds := null;
  end if;

  for r in select * from public.knockout_slot_map loop
    -- so materializa slots ainda em TBD (idempotente; nao sobrescreve resolvidos/locks manuais)
    if exists (
      select 1 from public.matches m
      where m.match_code = r.match_code
        and (coalesce(m.home_code,'TBD') = 'TBD' or coalesce(m.away_code,'TBD') = 'TBD')
        and coalesce(m.lock_reason,'') <> 'admin_lock'
    ) then
      v_home := public.resolve_ko_source(r.home_source, v_thirds);
      v_away := public.resolve_ko_source(r.away_source, v_thirds);
      if v_home is not null and v_away is not null and v_home <> v_away then
        update public.matches
        set home_code = v_home,
            away_code = v_away,
            market_status = 'open',
            status = 'scheduled',
            lock_reason = null,
            locked_at = null,
            updated_at = now()
        where match_code = r.match_code;
        v_count := v_count + 1;
      end if;
    end if;
  end loop;

  if v_count > 0 then
    perform public.log_audit('knockout_materialized', 'match', 'r32',
      null, jsonb_build_object('slots_filled', v_count));
  end if;
  return v_count;
end;
$$;

revoke execute on function public.materialize_knockout() from public, anon, authenticated;
revoke execute on function public.resolve_ko_source(text, text[]) from public, anon, authenticated;

-- ─── 6. Trigger: ao terminar um jogo de grupo, tenta materializar ─────────────
create or replace function public.trg_after_group_finish()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.stage = 'group' and new.status = 'finished'
     and old.status is distinct from 'finished' then
    perform public.materialize_knockout();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_materialize_knockout on public.matches;
create trigger trg_materialize_knockout
  after update on public.matches
  for each row
  execute function public.trg_after_group_finish();

-- ─── 7. Fallback admin: define manualmente os times de um jogo de mata-mata ───
create or replace function public.admin_set_knockout_teams(
  p_match_code text, p_home_code text, p_away_code text
)
returns public.matches
language plpgsql
security definer
set search_path = public
as $$
declare after_row public.matches%rowtype;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Apenas admin pode definir times de mata-mata.';
  end if;
  if p_home_code = p_away_code then
    raise exception 'Times nao podem ser iguais.';
  end if;
  update public.matches
  set home_code = p_home_code, away_code = p_away_code,
      market_status = 'open', status = 'scheduled', lock_reason = null, locked_at = null,
      updated_at = now()
  where match_code = p_match_code and stage <> 'group'
  returning * into after_row;
  if not found then raise exception 'Jogo de mata-mata nao encontrado: %', p_match_code; end if;
  perform public.log_audit('knockout_teams_set','match',p_match_code,null,to_jsonb(after_row));
  return after_row;
end;
$$;

revoke execute on function public.admin_set_knockout_teams(text,text,text) from public, anon;
grant execute on function public.admin_set_knockout_teams(text,text,text) to authenticated;

-- RLS de leitura do mapa (publico para autenticados; escrita so admin)
alter table public.knockout_slot_map enable row level security;
drop policy if exists ko_slot_map_select on public.knockout_slot_map;
create policy ko_slot_map_select on public.knockout_slot_map for select to authenticated using (true);
drop policy if exists ko_slot_map_admin on public.knockout_slot_map;
create policy ko_slot_map_admin on public.knockout_slot_map for all to authenticated
  using (public.is_admin((select auth.uid()))) with check (public.is_admin((select auth.uid())));
