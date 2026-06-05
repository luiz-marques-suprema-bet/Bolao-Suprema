-- Keep current_ranking fresh when new participants become visible or submit their first picks.
-- This only refreshes ranking snapshots; it does not change predictions, match results, or scoring.

create or replace function public.refresh_ranking_on_rank_eligibility_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_eligible boolean := false;
  v_new_eligible boolean := false;
begin
  v_new_eligible :=
    coalesce(new.participant_status, 'active') = 'active'
    and nullif(trim(coalesce(new.first_name, '')), '') is not null;

  if tg_op = 'INSERT' then
    if v_new_eligible then
      perform public.refresh_ranking_snapshots();
    end if;
    return new;
  end if;

  v_old_eligible :=
    coalesce(old.participant_status, 'active') = 'active'
    and nullif(trim(coalesce(old.first_name, '')), '') is not null;

  if (v_old_eligible or v_new_eligible) and (
    coalesce(old.participant_status, 'active') is distinct from coalesce(new.participant_status, 'active')
    or nullif(trim(coalesce(old.first_name, '')), '') is distinct from nullif(trim(coalesce(new.first_name, '')), '')
    or coalesce(old.last_name, '') is distinct from coalesce(new.last_name, '')
    or coalesce(old.dept, '') is distinct from coalesce(new.dept, '')
    or coalesce(old.initials, '') is distinct from coalesce(new.initials, '')
    or coalesce(old.color, '') is distinct from coalesce(new.color, '')
    or coalesce(old.avatar_url, '') is distinct from coalesce(new.avatar_url, '')
    or coalesce(old.privacy_hide_profile, false) is distinct from coalesce(new.privacy_hide_profile, false)
  ) then
    perform public.refresh_ranking_snapshots();
  end if;

  return new;
end;
$$;

drop trigger if exists trg_refresh_ranking_on_user_profile on public.users;
create trigger trg_refresh_ranking_on_user_profile
after insert or update of participant_status, first_name, last_name, dept, initials, color, avatar_url, privacy_hide_profile
on public.users
for each row
execute function public.refresh_ranking_on_rank_eligibility_change();

create or replace function public.refresh_ranking_on_first_pick_submission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_had_prior_submission boolean := false;
begin
  if new.user_id is null then
    return new;
  end if;

  select exists (
    select 1
    from public.predictions p
    where p.user_id = new.user_id
      and (tg_table_name <> 'predictions' or p.id <> new.id)
    union all
    select 1
    from public.special_picks sp
    where sp.user_id = new.user_id
      and (tg_table_name <> 'special_picks' or sp.id <> new.id)
    union all
    select 1
    from public.bracket_picks bp
    where bp.user_id = new.user_id
      and (tg_table_name <> 'bracket_picks' or bp.id <> new.id)
  )
  into v_had_prior_submission;

  if not v_had_prior_submission then
    perform public.refresh_ranking_snapshots();
  end if;

  return new;
end;
$$;

drop trigger if exists trg_refresh_ranking_on_first_prediction on public.predictions;
create trigger trg_refresh_ranking_on_first_prediction
after insert on public.predictions
for each row
execute function public.refresh_ranking_on_first_pick_submission();

drop trigger if exists trg_refresh_ranking_on_first_special_pick on public.special_picks;
create trigger trg_refresh_ranking_on_first_special_pick
after insert on public.special_picks
for each row
execute function public.refresh_ranking_on_first_pick_submission();

drop trigger if exists trg_refresh_ranking_on_first_bracket_pick on public.bracket_picks;
create trigger trg_refresh_ranking_on_first_bracket_pick
after insert on public.bracket_picks
for each row
execute function public.refresh_ranking_on_first_pick_submission();
