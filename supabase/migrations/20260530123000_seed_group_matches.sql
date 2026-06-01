-- ============================================================================
-- Bolao Suprema · M7 remediation · seed idempotente dos 72 jogos de grupo
-- ----------------------------------------------------------------------------
-- Nenhuma migration criava as 72 linhas de grupo em public.matches: a migration
-- 20260515130000 apenas dava UPDATE (assumindo linhas pre-existentes de um seed
-- fora do repo). Logo, um `supabase db reset` limpo produzia 0 jogos de grupo
-- (e so 32 de mata-mata). Este seed cria/atualiza os 72 jogos com dados
-- alinhados a src/data/wc2026.ts (home/away/venue/grupo/matchday) e ao kickoff
-- canonico (ET->UTC) ja usado pelo projeto. Ver teste de paridade em
-- src/lib/seedGroupMatches.test.ts.
--
-- Idempotente: on conflict atualiza apenas a ESTRUTURA/agenda; status,
-- market_status, placares e locks de partidas existentes sao preservados (nao
-- reabre nem reapura nada).
-- ============================================================================

insert into public.matches (
  match_code, stage, stage_label, group_code, matchday,
  home_code, away_code, match_date, match_time, kickoff_utc, venue,
  status, market_status
)
values
  ('g-a-1','group','GRUPO A · MD1','A',1,'MEX','RSA','QUI 11 JUN','16:00','2026-06-11T19:00:00.000Z'::timestamptz,'Estadio Azteca · Cidade do México','scheduled','open'),
  ('g-a-2','group','GRUPO A · MD1','A',1,'KOR','CZE','QUI 11 JUN','23:00','2026-06-12T02:00:00.000Z'::timestamptz,'Estadio Akron · Guadalajara','scheduled','open'),
  ('g-b-1','group','GRUPO B · MD1','B',1,'CAN','BIH','SEX 12 JUN','16:00','2026-06-12T19:00:00.000Z'::timestamptz,'BMO Field · Toronto','scheduled','open'),
  ('g-d-1','group','GRUPO D · MD1','D',1,'USA','PAR','SEX 12 JUN','22:00','2026-06-13T01:00:00.000Z'::timestamptz,'SoFi Stadium · Los Angeles','scheduled','open'),
  ('g-b-2','group','GRUPO B · MD1','B',1,'QAT','SUI','SAB 13 JUN','16:00','2026-06-13T19:00:00.000Z'::timestamptz,'Levi''s Stadium · San Francisco','scheduled','open'),
  ('g-c-1','group','GRUPO C · MD1','C',1,'BRA','MAR','SAB 13 JUN','19:00','2026-06-13T22:00:00.000Z'::timestamptz,'MetLife Stadium · Nova York','scheduled','open'),
  ('g-c-2','group','GRUPO C · MD1','C',1,'HTI','SCO','SAB 13 JUN','22:00','2026-06-14T01:00:00.000Z'::timestamptz,'Gillette Stadium · Boston','scheduled','open'),
  ('g-d-2','group','GRUPO D · MD1','D',1,'AUS','TUR','DOM 14 JUN','13:00','2026-06-14T16:00:00.000Z'::timestamptz,'BC Place · Vancouver','scheduled','open'),
  ('g-e-1','group','GRUPO E · MD1','E',1,'GER','CUW','DOM 14 JUN','14:00','2026-06-14T17:00:00.000Z'::timestamptz,'NRG Stadium · Houston','scheduled','open'),
  ('g-f-1','group','GRUPO F · MD1','F',1,'NED','JPN','DOM 14 JUN','17:00','2026-06-14T20:00:00.000Z'::timestamptz,'AT&T Stadium · Dallas','scheduled','open'),
  ('g-e-2','group','GRUPO E · MD1','E',1,'CIV','ECU','DOM 14 JUN','20:00','2026-06-14T23:00:00.000Z'::timestamptz,'Lincoln Financial Field · Filadélfia','scheduled','open'),
  ('g-f-2','group','GRUPO F · MD1','F',1,'SWE','TUN','DOM 14 JUN','23:00','2026-06-15T02:00:00.000Z'::timestamptz,'Estadio BBVA · Monterrey','scheduled','open'),
  ('g-h-1','group','GRUPO H · MD1','H',1,'ESP','CPV','SEG 15 JUN','13:00','2026-06-15T16:00:00.000Z'::timestamptz,'Mercedes-Benz Stadium · Atlanta','scheduled','open'),
  ('g-g-1','group','GRUPO G · MD1','G',1,'BEL','EGY','SEG 15 JUN','16:00','2026-06-15T19:00:00.000Z'::timestamptz,'Lumen Field · Seattle','scheduled','open'),
  ('g-h-2','group','GRUPO H · MD1','H',1,'KSA','URU','SEG 15 JUN','19:00','2026-06-15T22:00:00.000Z'::timestamptz,'Hard Rock Stadium · Miami','scheduled','open'),
  ('g-g-2','group','GRUPO G · MD1','G',1,'IRN','NZL','SEG 15 JUN','22:00','2026-06-16T01:00:00.000Z'::timestamptz,'SoFi Stadium · Los Angeles','scheduled','open'),
  ('g-i-1','group','GRUPO I · MD1','I',1,'FRA','SEN','TER 16 JUN','16:00','2026-06-16T19:00:00.000Z'::timestamptz,'MetLife Stadium · Nova York','scheduled','open'),
  ('g-i-2','group','GRUPO I · MD1','I',1,'IRQ','NOR','TER 16 JUN','19:00','2026-06-16T22:00:00.000Z'::timestamptz,'Gillette Stadium · Boston','scheduled','open'),
  ('g-j-1','group','GRUPO J · MD1','J',1,'ARG','ALG','TER 16 JUN','22:00','2026-06-17T01:00:00.000Z'::timestamptz,'Arrowhead Stadium · Kansas City','scheduled','open'),
  ('g-j-2','group','GRUPO J · MD1','J',1,'AUT','JOR','QUA 17 JUN','11:00','2026-06-17T14:00:00.000Z'::timestamptz,'Levi''s Stadium · San Francisco','scheduled','open'),
  ('g-k-1','group','GRUPO K · MD1','K',1,'POR','COD','QUA 17 JUN','14:00','2026-06-17T17:00:00.000Z'::timestamptz,'NRG Stadium · Houston','scheduled','open'),
  ('g-l-1','group','GRUPO L · MD1','L',1,'ENG','CRO','QUA 17 JUN','17:00','2026-06-17T20:00:00.000Z'::timestamptz,'AT&T Stadium · Dallas','scheduled','open'),
  ('g-l-2','group','GRUPO L · MD1','L',1,'GHA','PAN','QUA 17 JUN','20:00','2026-06-17T23:00:00.000Z'::timestamptz,'BMO Field · Toronto','scheduled','open'),
  ('g-k-2','group','GRUPO K · MD1','K',1,'UZB','COL','QUA 17 JUN','23:00','2026-06-18T02:00:00.000Z'::timestamptz,'Estadio Azteca · Cidade do México','scheduled','open'),
  ('g-a-3','group','GRUPO A · MD2','A',2,'CZE','RSA','QUI 18 JUN','13:00','2026-06-18T16:00:00.000Z'::timestamptz,'Mercedes-Benz Stadium · Atlanta','scheduled','open'),
  ('g-b-3','group','GRUPO B · MD2','B',2,'SUI','BIH','QUI 18 JUN','16:00','2026-06-18T19:00:00.000Z'::timestamptz,'SoFi Stadium · Los Angeles','scheduled','open'),
  ('g-b-4','group','GRUPO B · MD2','B',2,'CAN','QAT','QUI 18 JUN','19:00','2026-06-18T22:00:00.000Z'::timestamptz,'BC Place · Vancouver','scheduled','open'),
  ('g-a-4','group','GRUPO A · MD2','A',2,'MEX','KOR','QUI 18 JUN','22:00','2026-06-19T01:00:00.000Z'::timestamptz,'Estadio Akron · Guadalajara','scheduled','open'),
  ('g-d-3','group','GRUPO D · MD2','D',2,'USA','AUS','SEX 19 JUN','16:00','2026-06-19T19:00:00.000Z'::timestamptz,'Lumen Field · Seattle','scheduled','open'),
  ('g-c-3','group','GRUPO C · MD2','C',2,'SCO','MAR','SEX 19 JUN','19:00','2026-06-19T22:00:00.000Z'::timestamptz,'Gillette Stadium · Boston','scheduled','open'),
  ('g-c-4','group','GRUPO C · MD2','C',2,'BRA','HTI','SEX 19 JUN','21:30','2026-06-20T00:30:00.000Z'::timestamptz,'Lincoln Financial Field · Filadélfia','scheduled','open'),
  ('g-d-4','group','GRUPO D · MD2','D',2,'TUR','PAR','SAB 20 JUN','00:00','2026-06-20T03:00:00.000Z'::timestamptz,'Levi''s Stadium · San Francisco','scheduled','open'),
  ('g-f-3','group','GRUPO F · MD2','F',2,'NED','SWE','SAB 20 JUN','14:00','2026-06-20T17:00:00.000Z'::timestamptz,'NRG Stadium · Houston','scheduled','open'),
  ('g-e-3','group','GRUPO E · MD2','E',2,'GER','CIV','SAB 20 JUN','17:00','2026-06-20T20:00:00.000Z'::timestamptz,'BMO Field · Toronto','scheduled','open'),
  ('g-e-4','group','GRUPO E · MD2','E',2,'ECU','CUW','SAB 20 JUN','21:00','2026-06-21T00:00:00.000Z'::timestamptz,'Arrowhead Stadium · Kansas City','scheduled','open'),
  ('g-f-4','group','GRUPO F · MD2','F',2,'TUN','JPN','DOM 21 JUN','00:00','2026-06-21T03:00:00.000Z'::timestamptz,'Estadio BBVA · Monterrey','scheduled','open'),
  ('g-h-3','group','GRUPO H · MD2','H',2,'ESP','KSA','DOM 21 JUN','13:00','2026-06-21T16:00:00.000Z'::timestamptz,'Mercedes-Benz Stadium · Atlanta','scheduled','open'),
  ('g-g-3','group','GRUPO G · MD2','G',2,'BEL','IRN','DOM 21 JUN','16:00','2026-06-21T19:00:00.000Z'::timestamptz,'SoFi Stadium · Los Angeles','scheduled','open'),
  ('g-h-4','group','GRUPO H · MD2','H',2,'URU','CPV','DOM 21 JUN','19:00','2026-06-21T22:00:00.000Z'::timestamptz,'Hard Rock Stadium · Miami','scheduled','open'),
  ('g-g-4','group','GRUPO G · MD2','G',2,'NZL','EGY','DOM 21 JUN','22:00','2026-06-22T01:00:00.000Z'::timestamptz,'BC Place · Vancouver','scheduled','open'),
  ('g-j-3','group','GRUPO J · MD2','J',2,'ARG','AUT','SEG 22 JUN','14:00','2026-06-22T17:00:00.000Z'::timestamptz,'AT&T Stadium · Dallas','scheduled','open'),
  ('g-i-3','group','GRUPO I · MD2','I',2,'FRA','IRQ','SEG 22 JUN','18:00','2026-06-22T21:00:00.000Z'::timestamptz,'Lincoln Financial Field · Filadélfia','scheduled','open'),
  ('g-i-4','group','GRUPO I · MD2','I',2,'NOR','SEN','SEG 22 JUN','21:00','2026-06-23T00:00:00.000Z'::timestamptz,'MetLife Stadium · Nova York','scheduled','open'),
  ('g-j-4','group','GRUPO J · MD2','J',2,'JOR','ALG','TER 23 JUN','00:00','2026-06-23T03:00:00.000Z'::timestamptz,'Levi''s Stadium · San Francisco','scheduled','open'),
  ('g-k-3','group','GRUPO K · MD2','K',2,'POR','UZB','TER 23 JUN','14:00','2026-06-23T17:00:00.000Z'::timestamptz,'NRG Stadium · Houston','scheduled','open'),
  ('g-l-3','group','GRUPO L · MD2','L',2,'ENG','GHA','TER 23 JUN','17:00','2026-06-23T20:00:00.000Z'::timestamptz,'Gillette Stadium · Boston','scheduled','open'),
  ('g-l-4','group','GRUPO L · MD2','L',2,'PAN','CRO','TER 23 JUN','20:00','2026-06-23T23:00:00.000Z'::timestamptz,'BMO Field · Toronto','scheduled','open'),
  ('g-k-4','group','GRUPO K · MD2','K',2,'COL','COD','TER 23 JUN','23:00','2026-06-24T02:00:00.000Z'::timestamptz,'Estadio Akron · Guadalajara','scheduled','open'),
  ('g-b-5','group','GRUPO B · MD3','B',3,'SUI','CAN','QUA 24 JUN','16:00','2026-06-24T19:00:00.000Z'::timestamptz,'BC Place · Vancouver','scheduled','open'),
  ('g-b-6','group','GRUPO B · MD3','B',3,'BIH','QAT','QUA 24 JUN','16:00','2026-06-24T19:00:00.000Z'::timestamptz,'Lumen Field · Seattle','scheduled','open'),
  ('g-c-5','group','GRUPO C · MD3','C',3,'SCO','BRA','QUA 24 JUN','19:00','2026-06-24T22:00:00.000Z'::timestamptz,'Hard Rock Stadium · Miami','scheduled','open'),
  ('g-c-6','group','GRUPO C · MD3','C',3,'MAR','HTI','QUA 24 JUN','19:00','2026-06-24T22:00:00.000Z'::timestamptz,'Mercedes-Benz Stadium · Atlanta','scheduled','open'),
  ('g-a-5','group','GRUPO A · MD3','A',3,'CZE','MEX','QUA 24 JUN','22:00','2026-06-25T01:00:00.000Z'::timestamptz,'Estadio Azteca · Cidade do México','scheduled','open'),
  ('g-a-6','group','GRUPO A · MD3','A',3,'RSA','KOR','QUA 24 JUN','22:00','2026-06-25T01:00:00.000Z'::timestamptz,'Estadio BBVA · Monterrey','scheduled','open'),
  ('g-e-5','group','GRUPO E · MD3','E',3,'CUW','CIV','QUI 25 JUN','17:00','2026-06-25T20:00:00.000Z'::timestamptz,'Lincoln Financial Field · Filadélfia','scheduled','open'),
  ('g-e-6','group','GRUPO E · MD3','E',3,'ECU','GER','QUI 25 JUN','17:00','2026-06-25T20:00:00.000Z'::timestamptz,'MetLife Stadium · Nova York','scheduled','open'),
  ('g-f-5','group','GRUPO F · MD3','F',3,'JPN','SWE','QUI 25 JUN','20:00','2026-06-25T23:00:00.000Z'::timestamptz,'AT&T Stadium · Dallas','scheduled','open'),
  ('g-f-6','group','GRUPO F · MD3','F',3,'TUN','NED','QUI 25 JUN','20:00','2026-06-25T23:00:00.000Z'::timestamptz,'Arrowhead Stadium · Kansas City','scheduled','open'),
  ('g-d-5','group','GRUPO D · MD3','D',3,'TUR','USA','QUI 25 JUN','23:00','2026-06-26T02:00:00.000Z'::timestamptz,'SoFi Stadium · Los Angeles','scheduled','open'),
  ('g-d-6','group','GRUPO D · MD3','D',3,'PAR','AUS','QUI 25 JUN','23:00','2026-06-26T02:00:00.000Z'::timestamptz,'Levi''s Stadium · San Francisco','scheduled','open'),
  ('g-i-5','group','GRUPO I · MD3','I',3,'NOR','FRA','SEX 26 JUN','16:00','2026-06-26T19:00:00.000Z'::timestamptz,'Gillette Stadium · Boston','scheduled','open'),
  ('g-i-6','group','GRUPO I · MD3','I',3,'SEN','IRQ','SEX 26 JUN','16:00','2026-06-26T19:00:00.000Z'::timestamptz,'BMO Field · Toronto','scheduled','open'),
  ('g-h-5','group','GRUPO H · MD3','H',3,'CPV','KSA','SEX 26 JUN','21:00','2026-06-27T00:00:00.000Z'::timestamptz,'NRG Stadium · Houston','scheduled','open'),
  ('g-h-6','group','GRUPO H · MD3','H',3,'URU','ESP','SEX 26 JUN','21:00','2026-06-27T00:00:00.000Z'::timestamptz,'Estadio Akron · Guadalajara','scheduled','open'),
  ('g-g-5','group','GRUPO G · MD3','G',3,'EGY','IRN','SAB 27 JUN','00:00','2026-06-27T03:00:00.000Z'::timestamptz,'Lumen Field · Seattle','scheduled','open'),
  ('g-g-6','group','GRUPO G · MD3','G',3,'NZL','BEL','SAB 27 JUN','00:00','2026-06-27T03:00:00.000Z'::timestamptz,'BC Place · Vancouver','scheduled','open'),
  ('g-l-5','group','GRUPO L · MD3','L',3,'PAN','ENG','SAB 27 JUN','18:00','2026-06-27T21:00:00.000Z'::timestamptz,'MetLife Stadium · Nova York','scheduled','open'),
  ('g-l-6','group','GRUPO L · MD3','L',3,'CRO','GHA','SAB 27 JUN','18:00','2026-06-27T21:00:00.000Z'::timestamptz,'Lincoln Financial Field · Filadélfia','scheduled','open'),
  ('g-k-5','group','GRUPO K · MD3','K',3,'COL','POR','SAB 27 JUN','20:30','2026-06-27T23:30:00.000Z'::timestamptz,'Hard Rock Stadium · Miami','scheduled','open'),
  ('g-k-6','group','GRUPO K · MD3','K',3,'COD','UZB','SAB 27 JUN','20:30','2026-06-27T23:30:00.000Z'::timestamptz,'Mercedes-Benz Stadium · Atlanta','scheduled','open'),
  ('g-j-5','group','GRUPO J · MD3','J',3,'ALG','AUT','SAB 27 JUN','23:00','2026-06-28T02:00:00.000Z'::timestamptz,'Arrowhead Stadium · Kansas City','scheduled','open'),
  ('g-j-6','group','GRUPO J · MD3','J',3,'JOR','ARG','SAB 27 JUN','23:00','2026-06-28T02:00:00.000Z'::timestamptz,'AT&T Stadium · Dallas','scheduled','open')
on conflict (match_code) do update set
  stage       = excluded.stage,
  stage_label = excluded.stage_label,
  group_code  = excluded.group_code,
  matchday    = excluded.matchday,
  home_code   = excluded.home_code,
  away_code   = excluded.away_code,
  match_date  = excluded.match_date,
  match_time  = excluded.match_time,
  kickoff_utc = excluded.kickoff_utc,
  venue       = excluded.venue,
  updated_at  = now();
