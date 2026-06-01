# football-data.org sync

Source checked on 2026-05-21:

- Coverage page lists Worldcup/FIFA World Cup in the free tier.
- API v4 docs expose `/v4/competitions/{id}/matches`.
- FIFA World Cup competition code is `WC`.
- Match filters include `season`, `stage`, `status`, `matchday`, and `group`.
- Match statuses include `SCHEDULED`, `LIVE`, `IN_PLAY`, `PAUSED`, `FINISHED`, `POSTPONED`, `SUSPENDED`, and `CANCELLED`.

## Supabase setup

1. Apply `supabase/migrations/20260521103000_prediction_batch_and_football_data.sql`.
2. Set Edge Function secrets:

```bash
supabase secrets set FOOTBALL_DATA_TOKEN=your_token
```

The function also needs the standard Supabase Edge Function env vars:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

3. Deploy the function:

```bash
supabase functions deploy football-data-sync
```

4. Run manually:

```bash
curl -X POST "https://<project-ref>.functions.supabase.co/football-data-sync?season=2026" \
  -H "Authorization: Bearer <SUPABASE_ANON_OR_SERVICE_TOKEN>"
```

The deployed function should keep JWT verification enabled. This is now pinned in
`supabase/config.toml` (`[functions.football-data-sync] verify_jwt = true`). The
function uses the service role key internally, so the endpoint itself must not be
anonymous.

## Cron automation (REQUIRED for live scores)

The cron is versioned in `supabase/migrations/20260601100000_persistent_football_sync_cron.sql`.
It schedules `football-data-sync` every 5 minutes and reads the publishable anon
key from Supabase Vault, so it survives `db push`/`db reset` without hardcoding a
key in the repository.

Prerequisite for a new project or fresh reset:

```sql
select vault.create_secret(
  '<SUPABASE_ANON_KEY>',
  'football_sync_anon_key',
  'Publishable anon key used by pg_cron to call football-data-sync'
);
```

Verify the job and its runs:

```sql
select jobname, schedule, active from cron.job where jobname = 'football-data-sync';
select status, return_message, start_time
from cron.job_run_details
where jobid = (select jobid from cron.job where jobname = 'football-data-sync')
order by start_time desc limit 5;
```

The Edge Function also requires `FOOTBALL_DATA_TOKEN` as a Supabase secret. If
the Vault secret or API token is missing, no automatic score/status sync happens
and scores remain admin-driven/manual.

### What is automatic vs. what needs this config

- **Fechamento de palpite por kickoff = automático e confiável, independe do cron.**
  O banco bloqueia escrita de palpite via trigger `ensure_prediction_market_open`
  e RPC `save_match_predictions` quando `kickoff_utc <= now()`. Isso vale mesmo com
  o sync desligado.
- **Placar / status ao vivo / apuração automática = só com o cron + Edge Function
  configurados acima**, ou registrados manualmente pelo admin no painel.

## Operational notes

- User predictions are still locked by kickoff in Postgres.
- Admin locks are respected by the sync function: it will not reopen a manually locked match just because the API says it is scheduled.
- The sync function updates rows by `football_data_id` first. If a row does not have that ID yet, it tries to match by home TLA, away TLA, and `kickoff_utc`.
- Checked on 2026-06-01: the `football-data-sync` Edge Function is deployed with JWT verification enabled, the `pg_cron` job runs every 5 minutes, and the latest validation returned HTTP 200 with updated match rows.
- Frontend clients receive `matches` changes through Supabase Realtime once the database row changes.
