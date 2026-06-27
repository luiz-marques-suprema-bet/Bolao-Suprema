-- Bolao Suprema · Mata-mata: calendário oficial FIFA 2026 (kickoff dos jogos).
--
-- Contexto: as datas/horários dos jogos de mata-mata ainda NÃO materializados
-- estavam fabricados (amontoados em 28 jun–01 jul) quando o calendário oficial
-- vai de 28 jun a 03 jul (R32) e até 19 jul (final). Só os 5 jogos já sorteados
-- (vindos da TheSportsDB) tinham horário certo.
--
-- Fonte: calendário oficial (ESPN/Wikipédia), com os horários UTC validados
-- contra os 5 jogos que a TheSportsDB já trazia sorteados (batem exatamente).
-- kickoff_utc é a fonte da verdade da exibição; match_date/match_time são
-- derivados em horário de Brasília só por consistência.
--
-- Obs.: o chaveamento (knockout_progression) em produção JÁ está correto
-- (Oitava 1 = V2×V5, etc.); o que estava errado eram só os rótulos no frontend
-- (corrigido em wc2026.ts). Por isso esta migração mexe SÓ nas datas.

-- ─── 1. Calendário oficial (kickoff UTC) + textos derivados em BRT ────────────
update public.matches m set
  kickoff_utc = v.utc,
  match_date  = upper(to_char(v.utc at time zone 'America/Sao_Paulo', 'Dy DD Mon')),
  match_time  = to_char(v.utc at time zone 'America/Sao_Paulo', 'HH24:MI')
from (values
  ('ko-r32-1',  timestamptz '2026-06-28T19:00:00Z'),
  ('ko-r32-2',  timestamptz '2026-06-29T20:30:00Z'),
  ('ko-r32-3',  timestamptz '2026-06-30T01:00:00Z'),
  ('ko-r32-4',  timestamptz '2026-06-29T17:00:00Z'),
  ('ko-r32-5',  timestamptz '2026-06-30T21:00:00Z'),
  ('ko-r32-6',  timestamptz '2026-06-30T17:00:00Z'),
  ('ko-r32-7',  timestamptz '2026-07-01T01:00:00Z'),
  ('ko-r32-8',  timestamptz '2026-07-01T16:00:00Z'),
  ('ko-r32-9',  timestamptz '2026-07-02T00:00:00Z'),
  ('ko-r32-10', timestamptz '2026-07-01T20:00:00Z'),
  ('ko-r32-11', timestamptz '2026-07-02T23:00:00Z'),
  ('ko-r32-12', timestamptz '2026-07-02T19:00:00Z'),
  ('ko-r32-13', timestamptz '2026-07-03T03:00:00Z'),
  ('ko-r32-14', timestamptz '2026-07-03T22:00:00Z'),
  ('ko-r32-15', timestamptz '2026-07-04T01:30:00Z'),
  ('ko-r32-16', timestamptz '2026-07-03T18:00:00Z'),
  ('ko-r16-1',  timestamptz '2026-07-04T21:00:00Z'),
  ('ko-r16-2',  timestamptz '2026-07-04T17:00:00Z'),
  ('ko-r16-3',  timestamptz '2026-07-05T20:00:00Z'),
  ('ko-r16-4',  timestamptz '2026-07-06T00:00:00Z'),
  ('ko-r16-5',  timestamptz '2026-07-06T19:00:00Z'),
  ('ko-r16-6',  timestamptz '2026-07-07T00:00:00Z'),
  ('ko-r16-7',  timestamptz '2026-07-07T16:00:00Z'),
  ('ko-r16-8',  timestamptz '2026-07-07T20:00:00Z'),
  ('ko-qf-1',   timestamptz '2026-07-09T20:00:00Z'),
  ('ko-qf-2',   timestamptz '2026-07-10T19:00:00Z'),
  ('ko-qf-3',   timestamptz '2026-07-11T21:00:00Z'),
  ('ko-qf-4',   timestamptz '2026-07-12T01:00:00Z'),
  ('ko-sf-1',   timestamptz '2026-07-14T19:00:00Z'),
  ('ko-sf-2',   timestamptz '2026-07-15T19:00:00Z'),
  ('ko-third-1', timestamptz '2026-07-18T21:00:00Z'),
  ('ko-final-1', timestamptz '2026-07-19T19:00:00Z')
) as v(code, utc)
where m.match_code = v.code;
