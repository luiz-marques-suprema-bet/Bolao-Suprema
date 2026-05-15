-- Centralize critical product writes behind audited RPCs.

create or replace function public.save_prediction(
  p_match_code text,
  p_home_score integer,
  p_away_score integer
)
returns public.predictions
language plpgsql
security definer
set search_path = public
as $$
declare
  match_row public.matches%rowtype;
  saved_row public.predictions%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Sessao expirada. Entre novamente.';
  end if;

  if not exists (
    select 1 from public.users
    where id = auth.uid() and participant_status = 'active'
  ) then
    raise exception 'Participante pendente, bloqueado ou removido.';
  end if;

  if p_home_score < 0 or p_away_score < 0 or p_home_score > 20 or p_away_score > 20 then
    raise exception 'Placar invalido.';
  end if;

  select * into match_row
  from public.matches
  where match_code = p_match_code;

  if not found then
    raise exception 'Partida nao encontrada.';
  end if;

  if match_row.market_status <> 'open' then
    raise exception 'Mercado fechado ou bloqueado.';
  end if;

  if match_row.kickoff_utc is not null and match_row.kickoff_utc <= now() then
    raise exception 'Prazo de palpite encerrado.';
  end if;

  insert into public.predictions(user_id, match_id, match_code, home_score, away_score, submitted_at)
  values (auth.uid(), match_row.id, p_match_code, p_home_score, p_away_score, now())
  on conflict (user_id, match_id) do update set
    match_code = excluded.match_code,
    home_score = excluded.home_score,
    away_score = excluded.away_score,
    submitted_at = excluded.submitted_at
  returning * into saved_row;

  return saved_row;
end;
$$;

create or replace function public.save_general_picks(
  p_champion text,
  p_vice text,
  p_scorer text
)
returns public.users
language plpgsql
security definer
set search_path = public
as $$
declare
  first_kickoff timestamptz;
  champion_group text;
  vice_group text;
  before_row public.users%rowtype;
  after_row public.users%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Sessao expirada. Entre novamente.';
  end if;

  select * into before_row from public.users where id = auth.uid();
  if not found or before_row.participant_status <> 'active' then
    raise exception 'Participante pendente, bloqueado ou removido.';
  end if;

  select min(kickoff_utc) into first_kickoff from public.matches where kickoff_utc is not null;
  if first_kickoff is not null and first_kickoff <= now() then
    raise exception 'Apostas gerais encerradas.';
  end if;

  if nullif(p_champion, '') is not null and nullif(p_champion, '') = nullif(p_vice, '') then
    raise exception 'Campeao e vice nao podem ser a mesma selecao.';
  end if;

  if nullif(p_champion, '') is not null and nullif(p_vice, '') is not null then
    champion_group := public.team_group(nullif(p_champion, ''));
    vice_group := public.team_group(nullif(p_vice, ''));
    if champion_group is not null and champion_group = vice_group then
      raise exception 'Essa combinacao nao e possivel pelo chaveamento da Copa. Escolha selecoes que possam se encontrar na final.';
    end if;
  end if;

  update public.users
  set champion_pick = nullif(p_champion, ''),
      vice_pick = nullif(p_vice, ''),
      scorer_pick = nullif(p_scorer, '')
  where id = auth.uid()
  returning * into after_row;

  perform public.log_audit('general_picks_updated', 'user', auth.uid()::text, to_jsonb(before_row), to_jsonb(after_row));
  return after_row;
end;
$$;

create or replace function public.save_bracket_pick(
  p_slot_id text,
  p_round text,
  p_winner text
)
returns public.bracket_picks
language plpgsql
security definer
set search_path = public
as $$
declare
  saved_row public.bracket_picks%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Sessao expirada. Entre novamente.';
  end if;

  if not exists (select 1 from public.users where id = auth.uid() and participant_status = 'active') then
    raise exception 'Participante pendente, bloqueado ou removido.';
  end if;

  if p_round not in ('r32','r16','qf','sf','third','final') then
    raise exception 'Rodada invalida.';
  end if;

  if exists (select 1 from public.bracket_round_locks where round = p_round) then
    raise exception 'Chaveamento bloqueado para esta fase.';
  end if;

  insert into public.bracket_picks(user_id, slot_id, round, picked_winner)
  values (auth.uid(), p_slot_id, p_round, p_winner)
  on conflict (user_id, slot_id) do update set
    round = excluded.round,
    picked_winner = excluded.picked_winner
  returning * into saved_row;

  perform public.log_audit('bracket_pick_saved', 'bracket_pick', saved_row.id::text, null, to_jsonb(saved_row));
  return saved_row;
end;
$$;

create or replace function public.delete_bracket_pick(
  p_slot_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  before_row public.bracket_picks%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Sessao expirada. Entre novamente.';
  end if;

  select * into before_row
  from public.bracket_picks
  where user_id = auth.uid() and slot_id = p_slot_id;

  if not found then
    return;
  end if;

  if exists (select 1 from public.bracket_round_locks where round = before_row.round) then
    raise exception 'Chaveamento bloqueado para esta fase.';
  end if;

  delete from public.bracket_picks
  where user_id = auth.uid() and slot_id = p_slot_id;

  perform public.log_audit('bracket_pick_deleted', 'bracket_pick', before_row.id::text, to_jsonb(before_row), null);
end;
$$;

create or replace function public.create_participant_invite(
  p_label text default 'Convite Bolao Suprema',
  p_max_uses integer default null,
  p_expires_at timestamptz default null
)
returns public.participant_invites
language plpgsql
security definer
set search_path = public
as $$
declare
  new_row public.participant_invites%rowtype;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Apenas admin pode criar convite.';
  end if;

  insert into public.participant_invites(code, label, created_by, max_uses, expires_at)
  values (upper(substr(replace(uuid_generate_v4()::text, '-', ''), 1, 8)), coalesce(nullif(p_label, ''), 'Convite Bolao Suprema'), auth.uid(), p_max_uses, p_expires_at)
  returning * into new_row;

  perform public.log_audit('invite_created', 'invite', new_row.id::text, null, to_jsonb(new_row));
  return new_row;
end;
$$;

create or replace function public.save_scoring_rule(
  p_id text,
  p_label text,
  p_category text,
  p_stage text,
  p_points integer,
  p_sort_order integer,
  p_is_active boolean
)
returns public.scoring_rules
language plpgsql
security definer
set search_path = public
as $$
declare
  before_row public.scoring_rules%rowtype;
  after_row public.scoring_rules%rowtype;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Apenas admin pode alterar pontuacao.';
  end if;
  if p_points < 0 or p_points > 100 then
    raise exception 'Pontuacao invalida.';
  end if;

  select * into before_row from public.scoring_rules where id = p_id;

  insert into public.scoring_rules(id, label, category, stage, points, sort_order, is_active, updated_by, updated_at)
  values (p_id, p_label, p_category, p_stage, p_points, p_sort_order, p_is_active, auth.uid(), now())
  on conflict (id) do update set
    label = excluded.label,
    category = excluded.category,
    stage = excluded.stage,
    points = excluded.points,
    sort_order = excluded.sort_order,
    is_active = excluded.is_active,
    updated_by = excluded.updated_by,
    updated_at = excluded.updated_at
  returning * into after_row;

  perform public.log_audit('scoring_rule_updated', 'scoring_rule', p_id, case when before_row.id is null then null else to_jsonb(before_row) end, to_jsonb(after_row));
  return after_row;
end;
$$;

create or replace function public.audit_profile_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.log_audit('profile_updated', 'user', new.id::text, to_jsonb(old), to_jsonb(new));
  return new;
end;
$$;

drop trigger if exists trg_audit_profile_update on public.users;
create trigger trg_audit_profile_update
after update of first_name, last_name, dept, initials, color, avatar_url, banner_url, bio, favorite_team, favorite_player, favorite_player_img, privacy_hide_email, privacy_hide_profile
on public.users
for each row execute function public.audit_profile_update();

revoke execute on function public.save_prediction(text,integer,integer) from public, anon;
revoke execute on function public.save_general_picks(text,text,text) from public, anon;
revoke execute on function public.save_bracket_pick(text,text,text) from public, anon;
revoke execute on function public.delete_bracket_pick(text) from public, anon;
revoke execute on function public.create_participant_invite(text,integer,timestamptz) from public, anon;
revoke execute on function public.save_scoring_rule(text,text,text,text,integer,integer,boolean) from public, anon;
revoke execute on function public.audit_profile_update() from public, anon, authenticated;

grant execute on function public.save_prediction(text,integer,integer) to authenticated;
grant execute on function public.save_general_picks(text,text,text) to authenticated;
grant execute on function public.save_bracket_pick(text,text,text) to authenticated;
grant execute on function public.delete_bracket_pick(text) to authenticated;
grant execute on function public.create_participant_invite(text,integer,timestamptz) to authenticated;
grant execute on function public.save_scoring_rule(text,text,text,text,integer,integer,boolean) to authenticated;
