-- ============================================================================
-- Bolao Suprema · Materializacao e avanco automatico do mata-mata (completo)
-- ----------------------------------------------------------------------------
-- Cobre o torneio inteiro:
--   * Classificacao dos grupos a partir dos jogos 'finished'.
--   * Regra dos 8 melhores terceiros.
--   * Materializacao da Fase de 32 quando os grupos relevantes terminam.
--   * Avanco automatico dos vencedores: R32 -> Oitavas -> Quartas -> Semis ->
--     Final, e perdedores das Semis -> Disputa de 3o lugar.
--   * Abre o mercado (matches + markets) somente quando os DOIS times reais do
--     confronto estao definidos; placeholders continuam bloqueados.
--   * Nao sobrescreve confronto ja definido nem lock manual de admin.
--   * Fallback admin para corrigir qualquer confronto.
--   * Auditoria (log_audit) e idempotencia.
--
-- LIMITACOES CONHECIDAS (ver docs/FINAL_READINESS_2026-06-01.md; NAO vender como
-- 100% automatico):
--   1. Desempate de grupo usa pontos > saldo > gols > codigo (deterministico).
--      Confronto direto (head-to-head), fair-play e ranking FIFA NAO estao
--      implementados em SQL — o frontend (groupStandings.ts) aplica H2H. Em
--      empate real isso pode divergir; corrigir via admin_set_knockout_teams.
--   2. Alocacao dos 8 melhores terceiros aos 8 slots da Fase de 32 usa o
--      pareamento simplificado do app (ordem de ranking), NAO a matriz oficial
--      FIFA (que depende de QUAIS grupos classificam o 3o). Corrigir via admin.
--   3. Avanco automatico so ocorre com vencedor claro (matches.winner = time).
--      Jogos decididos nos penaltis com empate no tempo normal (winner='draw')
--      NAO avancam sozinhos — admin define o classificado (admin_set_knockout_teams).
-- ============================================================================

-- ─── 1. Classificacao de um grupo (a partir de jogos 'finished') ─────────────
create or replace function public.compute_group_standings(p_group text)
returns table (code text, pts int, gf int, ga int, gd int, played int, finished_games int)
language sql stable security definer set search_path = public as $$
  with grp as (
    select home_code, away_code, home_score, away_score, status
    from public.matches where stage = 'group' and group_code = p_group
  ),
  teams as (select home_code as code from grp union select away_code from grp),
  fin as (select * from grp where status = 'finished' and home_score is not null and away_score is not null)
  select t.code,
    coalesce(sum(case
      when f.home_code=t.code and f.home_score>f.away_score then 3
      when f.away_code=t.code and f.away_score>f.home_score then 3
      when (f.home_code=t.code or f.away_code=t.code) and f.home_score=f.away_score then 1
      else 0 end),0)::int as pts,
    coalesce(sum(case when f.home_code=t.code then f.home_score when f.away_code=t.code then f.away_score else 0 end),0)::int as gf,
    coalesce(sum(case when f.home_code=t.code then f.away_score when f.away_code=t.code then f.home_score else 0 end),0)::int as ga,
    coalesce(sum(case when f.home_code=t.code then f.home_score-f.away_score
                      when f.away_code=t.code then f.away_score-f.home_score else 0 end),0)::int as gd,
    (select count(*) from grp)::int as played,
    coalesce(count(f.home_code),0)::int as finished_games
  from teams t left join fin f on (f.home_code=t.code or f.away_code=t.code)
  where t.code is not null and t.code <> 'TBD'
  group by t.code
$$;

create or replace function public.group_rank(p_group text, p_pos int)
returns text language sql stable security definer set search_path = public as $$
  select code from public.compute_group_standings(p_group)
  order by pts desc, gd desc, gf desc, code asc
  offset greatest(p_pos - 1, 0) limit 1
$$;

-- ─── 2. Regra dos 8 melhores terceiros ───────────────────────────────────────
create or replace function public.best_third_codes()
returns text[] language sql stable security definer set search_path = public as $$
  select array_agg(code order by pts desc, gd desc, gf desc, code asc)
  from (
    select th.code, st.pts, st.gd, st.gf
    from (
      select public.group_rank(g,3) as code, g as grp
      from (select distinct group_code from public.matches where stage='group') q(g)
    ) th
    join lateral (select pts,gd,gf from public.compute_group_standings(th.grp) where code = th.code) st on true
    where th.code is not null
    order by st.pts desc, st.gd desc, st.gf desc, th.code asc
    limit 8
  ) x
$$;

-- ─── 3. Helper: preenche um jogo de mata-mata e abre o mercado ───────────────
create or replace function public._ko_fill(p_match text, p_home text, p_away text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.matches
    set home_code=p_home, away_code=p_away,
        market_status='open', status='scheduled', lock_reason=null, locked_at=null, updated_at=now()
  where match_code=p_match;
  update public.markets
    set status='open', lock_reason=null, updated_at=now()
  where scope_type='match' and scope_id=p_match;
end $$;
revoke execute on function public._ko_fill(text,text,text) from public, anon, authenticated;

-- ─── 4. Mapa de slots da Fase de 32 (espelha wc2026.ts R32_PLACEHOLDERS) ──────
create table if not exists public.knockout_slot_map (
  match_code text primary key, home_source text not null, away_source text not null
);
insert into public.knockout_slot_map (match_code, home_source, away_source) values
  ('ko-r32-1','W:A','T:1'), ('ko-r32-2','W:B','T:2'), ('ko-r32-3','W:C','T:3'),
  ('ko-r32-4','W:D','T:4'), ('ko-r32-5','W:E','T:5'), ('ko-r32-6','W:F','T:6'),
  ('ko-r32-7','W:G','T:7'), ('ko-r32-8','W:H','T:8'),
  ('ko-r32-9','W:I','R:A'), ('ko-r32-10','W:J','R:B'), ('ko-r32-11','W:K','R:C'),
  ('ko-r32-12','W:L','R:D'), ('ko-r32-13','R:E','R:F'), ('ko-r32-14','R:G','R:H'),
  ('ko-r32-15','R:I','R:J'), ('ko-r32-16','R:K','R:L')
on conflict (match_code) do update set home_source=excluded.home_source, away_source=excluded.away_source;

create or replace function public.resolve_ko_source(p_source text, p_thirds text[])
returns text language plpgsql stable security definer set search_path = public as $$
declare kind text := split_part(p_source,':',1); arg text := split_part(p_source,':',2); grp_done boolean;
begin
  if kind='T' then
    if array_length(p_thirds,1) is distinct from 8 then return null; end if;
    return p_thirds[arg::int];
  end if;
  select bool_and(status='finished') into grp_done from public.matches where stage='group' and group_code=arg;
  if not coalesce(grp_done,false) then return null; end if;
  if kind='W' then return public.group_rank(arg,1); end if;
  if kind='R' then return public.group_rank(arg,2); end if;
  return null;
end $$;
revoke execute on function public.resolve_ko_source(text,text[]) from public, anon, authenticated;

-- ─── 5. Materializa a Fase de 32 ──────────────────────────────────────────────
create or replace function public.materialize_knockout()
returns integer language plpgsql security definer set search_path = public as $$
declare v_thirds text[]; r record; v_home text; v_away text; v_count int := 0;
begin
  if (select bool_and(status='finished') from public.matches where stage='group') then
    v_thirds := public.best_third_codes();
  end if;
  for r in select * from public.knockout_slot_map loop
    if exists (select 1 from public.matches m where m.match_code=r.match_code
               and (coalesce(m.home_code,'TBD')='TBD' or coalesce(m.away_code,'TBD')='TBD')
               and coalesce(m.lock_reason,'') <> 'admin_lock') then
      v_home := public.resolve_ko_source(r.home_source, v_thirds);
      v_away := public.resolve_ko_source(r.away_source, v_thirds);
      if v_home is not null and v_away is not null and v_home <> v_away then
        perform public._ko_fill(r.match_code, v_home, v_away);
        v_count := v_count + 1;
      end if;
    end if;
  end loop;
  if v_count>0 then perform public.log_audit('knockout_materialized','match','r32',null,jsonb_build_object('slots_filled',v_count)); end if;
  return v_count;
end $$;
revoke execute on function public.materialize_knockout() from public, anon, authenticated;

-- ─── 6. Progressao R32 -> Oitavas -> Quartas -> Semis -> Final / 3o lugar ─────
create table if not exists public.knockout_progression (
  target_match text primary key,
  home_src text not null, home_take text not null check (home_take in ('winner','loser')),
  away_src text not null, away_take text not null check (away_take in ('winner','loser'))
);
insert into public.knockout_progression (target_match, home_src, home_take, away_src, away_take) values
  ('ko-r16-1','ko-r32-1','winner','ko-r32-2','winner'),
  ('ko-r16-2','ko-r32-3','winner','ko-r32-4','winner'),
  ('ko-r16-3','ko-r32-5','winner','ko-r32-6','winner'),
  ('ko-r16-4','ko-r32-7','winner','ko-r32-8','winner'),
  ('ko-r16-5','ko-r32-9','winner','ko-r32-10','winner'),
  ('ko-r16-6','ko-r32-11','winner','ko-r32-12','winner'),
  ('ko-r16-7','ko-r32-13','winner','ko-r32-14','winner'),
  ('ko-r16-8','ko-r32-15','winner','ko-r32-16','winner'),
  ('ko-qf-1','ko-r16-1','winner','ko-r16-2','winner'),
  ('ko-qf-2','ko-r16-3','winner','ko-r16-4','winner'),
  ('ko-qf-3','ko-r16-5','winner','ko-r16-6','winner'),
  ('ko-qf-4','ko-r16-7','winner','ko-r16-8','winner'),
  ('ko-sf-1','ko-qf-1','winner','ko-qf-2','winner'),
  ('ko-sf-2','ko-qf-3','winner','ko-qf-4','winner'),
  ('ko-final-1','ko-sf-1','winner','ko-sf-2','winner'),
  ('ko-third-1','ko-sf-1','loser','ko-sf-2','loser')
on conflict (target_match) do update set
  home_src=excluded.home_src, home_take=excluded.home_take,
  away_src=excluded.away_src, away_take=excluded.away_take;

create or replace function public.ko_advancer(p_match_code text, p_take text)
returns text language sql stable security definer set search_path = public as $$
  select case
    when m.status <> 'finished' then null
    when m.winner is null or m.winner='draw' then null
    when p_take='winner' then m.winner
    when p_take='loser' then (case when m.winner=m.home_code then m.away_code
                                   when m.winner=m.away_code then m.home_code end)
  end
  from public.matches m where m.match_code=p_match_code
$$;
revoke execute on function public.ko_advancer(text,text) from public, anon, authenticated;

create or replace function public.advance_knockout()
returns integer language plpgsql security definer set search_path = public as $$
declare r record; v_home text; v_away text; v_count int := 0;
begin
  for r in select * from public.knockout_progression loop
    if exists (select 1 from public.matches m where m.match_code=r.target_match
               and (coalesce(m.home_code,'TBD')='TBD' or coalesce(m.away_code,'TBD')='TBD')
               and coalesce(m.lock_reason,'') <> 'admin_lock') then
      v_home := public.ko_advancer(r.home_src, r.home_take);
      v_away := public.ko_advancer(r.away_src, r.away_take);
      if v_home is not null and v_away is not null and v_home <> v_away then
        perform public._ko_fill(r.target_match, v_home, v_away);
        v_count := v_count + 1;
      end if;
    end if;
  end loop;
  if v_count>0 then perform public.log_audit('knockout_advanced','match','ko',null,jsonb_build_object('slots_filled',v_count)); end if;
  return v_count;
end $$;
revoke execute on function public.advance_knockout() from public, anon, authenticated;

-- ─── 7. Trigger: ao terminar um jogo, materializa (grupo) ou avanca (KO) ──────
create or replace function public.process_match_finish()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status='finished' and old.status is distinct from 'finished' then
    if new.stage='group' then perform public.materialize_knockout();
    else perform public.advance_knockout();
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_materialize_knockout on public.matches;
drop trigger if exists trg_knockout_progress on public.matches;
create trigger trg_knockout_progress
  after update on public.matches
  for each row execute function public.process_match_finish();

-- compat: remove a funcao antiga do scaffold, se existir
drop function if exists public.trg_after_group_finish() cascade;

-- ─── 8. Fallback admin: define manualmente os times de um confronto ──────────
create or replace function public.admin_set_knockout_teams(
  p_match_code text, p_home_code text, p_away_code text
)
returns public.matches language plpgsql security definer set search_path = public as $$
declare after_row public.matches%rowtype;
begin
  if not public.is_admin(auth.uid()) then raise exception 'Apenas admin pode definir times de mata-mata.'; end if;
  if p_home_code = p_away_code then raise exception 'Times nao podem ser iguais.'; end if;
  if not exists (select 1 from public.matches where match_code=p_match_code and stage<>'group') then
    raise exception 'Jogo de mata-mata nao encontrado: %', p_match_code;
  end if;
  perform public._ko_fill(p_match_code, p_home_code, p_away_code);
  select * into after_row from public.matches where match_code=p_match_code;
  perform public.log_audit('knockout_teams_set','match',p_match_code,null,to_jsonb(after_row));
  return after_row;
end $$;
revoke execute on function public.admin_set_knockout_teams(text,text,text) from public, anon;
grant execute on function public.admin_set_knockout_teams(text,text,text) to authenticated;

-- ─── 9. RLS dos mapas (select p/ autenticados; escrita so admin) ─────────────
alter table public.knockout_slot_map enable row level security;
drop policy if exists ko_slot_map_select on public.knockout_slot_map;
create policy ko_slot_map_select on public.knockout_slot_map for select to authenticated using (true);
drop policy if exists ko_slot_map_admin on public.knockout_slot_map;
create policy ko_slot_map_admin on public.knockout_slot_map for all to authenticated
  using (public.is_admin((select auth.uid()))) with check (public.is_admin((select auth.uid())));

alter table public.knockout_progression enable row level security;
drop policy if exists ko_progression_select on public.knockout_progression;
create policy ko_progression_select on public.knockout_progression for select to authenticated using (true);
drop policy if exists ko_progression_admin on public.knockout_progression;
create policy ko_progression_admin on public.knockout_progression for all to authenticated
  using (public.is_admin((select auth.uid()))) with check (public.is_admin((select auth.uid())));
