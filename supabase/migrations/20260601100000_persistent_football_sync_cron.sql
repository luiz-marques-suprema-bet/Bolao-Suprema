-- ============================================================================
-- Bolao Suprema · Cron persistente e versionado do football-data-sync
-- ----------------------------------------------------------------------------
-- A versao anterior (20260521130000) agendava o cron lendo
-- current_setting('app.football_sync_url'/'app.supabase_anon_key'), que exigia
-- um `ALTER DATABASE ... SET` manual (superuser) e ficava INERTE se nao fosse
-- configurado. Esta migration torna o cron auto-suficiente, idempotente e
-- persistente: a URL e fixa (nao e segredo) e a anon key (publishable) e lida
-- do Supabase Vault em tempo de execucao — NUNCA fica no repositorio.
--
-- Pre-requisito (uma vez por projeto; sobrevive a `db push`):
--   select vault.create_secret('<ANON_KEY_PUBLISHABLE>', 'football_sync_anon_key', 'anon p/ cron');
-- (Ja criado neste projeto. So precisa recriar em um projeto NOVO / apos db reset local.)
--
-- Seguranca: verify_jwt=true e mantido (supabase/config.toml). O anon e um JWT
-- valido do projeto e apenas autoriza a chamada HTTP; a Edge Function usa o
-- service_role internamente. RLS protege os dados.
-- ============================================================================

create extension if not exists pg_net;
create extension if not exists pg_cron;

-- cron.schedule faz upsert pelo nome do job (idempotente).
select cron.schedule(
  'football-data-sync',
  '*/5 * * * *',
  $cmd$
  select net.http_post(
    url := 'https://mklmnxquvslflgljhgqn.supabase.co/functions/v1/football-data-sync?season=2026',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets where name = 'football_sync_anon_key'
      )
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $cmd$
);
