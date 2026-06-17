-- Expõe as apostas especiais (campeão, vice, artilheiro) na view public_profiles,
-- para transparência no perfil de cada palpiteiro. São picks JÁ TRAVADAS (o torneio
-- começou em 11/06), então revelá-las não dá vantagem competitiva.
-- Mantém security_invoker=true (o RLS de public.users continua valendo).

create or replace view public.public_profiles
with (security_invoker = true) as
select
  id,
  first_name,
  last_name,
  initials,
  color,
  dept,
  avatar_url,
  banner_url,
  bio,
  favorite_team,
  favorite_player,
  favorite_player_img,
  since,
  is_admin,
  is_marketing,
  is_owner,
  user_role,
  participant_status,
  privacy_hide_email,
  privacy_hide_profile,
  created_at,
  champion_pick,
  vice_pick,
  scorer_pick
from public.users;
