-- Advisor fixes after ranking/scoring finalization.

revoke execute on function public.admin_set_tournament_scorer(text, integer, uuid) from public, anon;
grant execute on function public.admin_set_tournament_scorer(text, integer, uuid) to authenticated;

create index if not exists idx_tournament_awards_player_id
  on public.tournament_awards(player_id)
  where player_id is not null;

create index if not exists idx_player_goal_totals_player_id
  on public.player_goal_totals(player_id)
  where player_id is not null;

drop index if exists public.idx_ranking_snapshots_current;
