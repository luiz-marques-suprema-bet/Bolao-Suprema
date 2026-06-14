-- ============================================================================
-- Bolao Suprema · Corrige 3 horarios de jogo errados + sync de kickoff
-- ----------------------------------------------------------------------------
-- 3 jogos de grupo tinham kickoff_utc errado (erro de digitacao na escala
-- original): 10-12h diferente do horario real (TheSportsDB). O display e a trava
-- de aposta leem kickoff_utc, entao o jogo aparecia/fechava num horario que nao
-- batia com quando ele realmente acontece (ex.: AUS x TUR mostrava 13:00 mas
-- rolou 01:00). Os outros 66 jogos de grupo ja estavam corretos.
--
-- Aqui corrigimos os 3 para o horario real (todos 04:00 UTC = 01:00 BRT). Em
-- paralelo, a edge function football-data-sync passou a sincronizar kickoff_utc
-- com a fonte (jogos nao encerrados), pra qualquer escala errada se autocorrigir
-- antes do jogo. Aplicado em producao via Management API; registrado aqui.
-- ============================================================================

update public.matches set kickoff_utc = timestamptz '2026-06-14 04:00:00+00', match_time = '01:00' where match_code = 'g-d-2'; -- AUS x TUR
update public.matches set kickoff_utc = timestamptz '2026-06-17 04:00:00+00', match_time = '01:00' where match_code = 'g-j-2'; -- AUT x JOR
update public.matches set kickoff_utc = timestamptz '2026-06-21 04:00:00+00', match_time = '01:00' where match_code = 'g-f-4'; -- TUN x JPN
