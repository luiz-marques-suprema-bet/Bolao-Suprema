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

The deployed function should keep JWT verification enabled. The function uses
the service role key internally, so the endpoint itself must not be anonymous.

## Claude prompt for Supabase

```text
Apply the SQL migration in supabase/migrations/20260521103000_prediction_batch_and_football_data.sql to the project. Then deploy the Edge Function in supabase/functions/football-data-sync. Configure FOOTBALL_DATA_TOKEN as a Supabase secret. Do not expose this token in the frontend. After deployment, invoke the function once with season=2026 and report the JSON result, especially updated and unmatched counts.
```

## Operational notes

- User predictions are still locked by kickoff in Postgres.
- Admin locks are respected by the sync function: it will not reopen a manually locked match just because the API says it is scheduled.
- The sync function updates rows by `football_data_id` first. If a row does not have that ID yet, it tries to match by home TLA, away TLA, and `kickoff_utc`.
