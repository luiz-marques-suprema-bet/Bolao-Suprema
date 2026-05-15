# Supabase audit snapshot before internal product migration

Project: `mklmnxquvslflgljhgqn`
Date: 2026-05-15
Branch: `codex/produto-real-bolao-suprema`

## Repository baseline

- Starting branch: `main`
- New branch: `codex/produto-real-bolao-suprema`
- Working tree before changes: clean
- Latest commits before this work:
  - `7824ef4 fix: surface updated kickoff time on landing`
  - `18be7c4 Merge pull request #1 from ojozinho/codex/productizacao-bolao-suprema`
  - `e3e7b0b feat: productize betting persistence`
- Deploy workflow: GitHub Pages on `main`, Node 20, `npm ci`, `npm run build`, env vars `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- Router: hash router, so GitHub Pages direct refresh remains compatible with `/#/route`.
- Critical local persistence found:
  - `bolao-predictions` in `prediction.store.ts`
  - `bolao-bracket` in `bracket.store.ts`
  - local chat fallback keys in `chat.store.ts`
  - auth/session preference in `auth.store.ts`
  - onboarding flag `bolao-visited`

## Existing Supabase objects before migration

Tables in `public`:

- `users`
- `matches`
- `predictions`
- `bracket_picks`
- `bulletins`
- `chat_messages`
- `poll_votes`
- `channel_pins`
- `ranking_snapshots`

Storage buckets before migration:

- `avatars`: public, no explicit file size or mime limit
- `user-media`: public, 5 MB, `image/jpeg`, `image/png`, `image/webp`, `image/gif`

Important existing columns:

- `matches.kickoff_utc`, `market_status`, `locked_at`, `locked_by`, `lock_reason`, `unlocked_at`, `settled_at`
- `bulletins.image_fit_mode`
- `users.champion_pick`, `vice_pick`, `scorer_pick`, `is_admin`, `is_marketing`, `avatar_url`, `banner_url`, `bio`

Existing functions/triggers:

- `ensure_prediction_market_open`
- `validate_general_picks`
- `team_group`
- `auto_grant_admin`
- `handle_new_user`
- `set_updated_at`
- `handle_updated_at`
- prediction market trigger and general picks validation trigger

Advisors before migration showed:

- mutable `search_path` warnings for existing helper functions
- public bucket listing warnings for `avatars` and `user-media`
- security definer functions executable by anon/authenticated
- unindexed foreign keys for `bulletins`, `channel_pins`, `poll_votes`
- RLS initplan and multiple permissive policy warnings on several existing policies

## SQL change strategy

The applied migrations are additive and are also committed as:

- `supabase/migrations/20260515143000_internal_product_governance.sql`
- `supabase/migrations/20260515144500_harden_storage_listing.sql`
- `supabase/migrations/20260515150000_harden_rpc_permissions.sql`
- `supabase/migrations/20260515151000_index_new_foreign_keys.sql`
- `supabase/migrations/20260515162000_harden_user_profile_privacy.sql`

They do not drop tables, buckets, columns or legacy storage objects. They keep `user-media` renderable for old URLs, add new buckets for future uploads, remove broad storage listing policies, restrict RPC execution grants, add indexes for the new foreign keys, and replace the broad `users_select_all` policy with profile privacy enforcement.

## Final advisor notes after migration

Security advisors still warn about authenticated access to selected `SECURITY DEFINER` RPCs. These RPCs are intentionally callable by signed-in clients because they perform their own role checks internally, but they remain a hardening priority for a future pass where admin-only operations can move behind a narrower API boundary. Supabase Auth leaked password protection is still disabled and must be enabled in the Supabase dashboard.

Performance advisors no longer report the newly introduced foreign keys as missing indexes. Remaining warnings are mostly pre-existing RLS `auth.uid()` initplan warnings, multiple permissive policies, and unused-index notices on low-traffic/new tables.

## Rollback plan

Rollback should be deliberate because the migration adds product data. Do not blindly drop tables with user activity.

Safe rollback for application behavior:

1. Revert the application commit.
2. Keep new additive tables in place unless they are confirmed unused.
3. If needed, disable new RPC usage by reverting frontend calls to direct existing tables.
4. Keep storage buckets `avatars`, `banners`, `bulletins`, and `user-media` because public URLs may already exist.

Destructive rollback only after explicit confirmation:

```sql
drop view if exists public.system_health;
drop table if exists public.system_events;
drop table if exists public.regulation_versions;
drop table if exists public.ranking_breakdowns;
drop table if exists public.bracket_round_locks;
drop table if exists public.notifications;
drop table if exists public.scoring_rules;
drop table if exists public.participant_invites;
drop table if exists public.audit_logs;
```

Columns added to existing tables should be left in place unless there is a confirmed backup and no deployed code references them.
