# Operational Checklist

Status recorded on 2026-05-22 for the Bolao Suprema hardening pass.

## Validation Status

The following local checks passed before commit:

- `npm.cmd run type-check`
- `npm.cmd run lint`
- `npm.cmd run test`
- `npm.cmd run build`

Browser validation:

- Local app opened at `http://127.0.0.1:5173`.
- Console error count: `0`.
- The app redirected to login, so authenticated screens still require a real session for visual validation.

Supabase validation:

- `public.matches`: 104 rows.
- `public.markets`: 104 `match_prediction` markets and 3 `special` markets.
- `public.players`: created.
- `public.special_picks.player_id`: created.
- `public.special_picks.scorer_unverified`: created.
- `chat_messages` and `channel_pins` are in the `supabase_realtime` publication.
- Public role helper wrappers are `SECURITY INVOKER`.
- Private role checks live in `app_private` as `SECURITY DEFINER`.

## Supabase Advisors

Security Advisor remaining items:

- `extension_in_public`: `pg_net` is installed in `public`.
- `auth_leaked_password_protection`: leaked password protection is disabled.

Performance Advisor remaining items:

- Only `unused_index` INFO entries remain.
- The RLS WARN items for `auth_rls_initplan` and `multiple_permissive_policies` were remediated.

## External Pending Items

These items are operational and should not block the code commit.

### Leaked Password Protection

Manual action required in Supabase Dashboard:

1. Open the Supabase project.
2. Go to Authentication settings.
3. Enable leaked password protection.
4. Save the setting.
5. Re-run the Security Advisor.

Reason:

- This blocks known compromised passwords through Supabase Auth password security checks.

Current status:

- Pending Dashboard action.

### `pg_net` Extension In Public

Observed behavior:

- `alter extension pg_net set schema extensions` failed because this extension does not support `SET SCHEMA` in this project.

Mitigation applied:

```sql
revoke all on schema net from public, anon, authenticated;
revoke all on all tables in schema net from public, anon, authenticated;
revoke all on all functions in schema net from public, anon, authenticated;
```

Residual risk:

- Supabase Security Advisor still reports the extension location.
- Direct grants to `anon` and `authenticated` were removed as a compensating control.

Current status:

- Mitigated by grant revocation, still visible as Security Advisor WARN.

### Realtime Two-User Validation

Database configuration confirmed:

- `public.chat_messages` is in `supabase_realtime`.
- `public.channel_pins` is in `supabase_realtime`.

Manual validation still required because it needs two real active users and OTP/session access:

1. Create or use two users with `participant_status = 'active'`.
2. Open browser A and sign in as user A.
3. Open browser B or an incognito window and sign in as user B.
4. Send a chat message from A.
5. Confirm the message appears in B without refresh.
6. Send a chat message from B.
7. Confirm the message appears in A without refresh.
8. Close B.
9. Confirm presence/offline state in A, if presence UI is enabled.
10. Reopen B.
11. Confirm presence/online state in A, if presence UI is enabled.
12. Test logout.
13. Test reconnect after temporarily disabling and restoring network.

Current status:

- Pending manual validation with real credentials.

## Migrations In This Pass

- `supabase/migrations/20260522023000_require_active_participants.sql`
- `supabase/migrations/20260522024500_markets_specials_ko_hardening.sql`
- `supabase/migrations/20260522033000_players_and_rpc_hardening.sql`
- `supabase/migrations/20260522034500_rls_performance_cleanup.sql`

## Commit Note

This commit is allowed with external operational pending items because the code, migrations, RLS hardening, World Cup 2026 model, tests, lint, type-check, build, and Supabase database changes were completed and validated.
