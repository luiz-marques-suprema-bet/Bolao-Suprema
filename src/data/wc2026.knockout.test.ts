import { describe, expect, it } from 'vitest'
import { WC2026_KNOCKOUT_MATCHES } from './wc2026'

const byId = (id: string) => {
  const m = WC2026_KNOCKOUT_MATCHES.find(x => x.id === id)
  if (!m) throw new Error(`match ${id} not found`)
  return m
}

// Calendário oficial FIFA 2026 (validado contra TheSportsDB + chave ESPN/Wikipédia).
// kickoff_utc é fonte da verdade da exibição (convertida pra BRT pelo app).
describe('wc2026 — calendário oficial do mata-mata (kickoff UTC)', () => {
  const CASES: [string, string][] = [
    ['ko-r32-1', '2026-06-28T19:00:00.000Z'], // RSA x CAN — 16:00 BRT
    ['ko-r32-2', '2026-06-29T20:30:00.000Z'], // 17:30 BRT
    ['ko-r32-3', '2026-06-30T01:00:00.000Z'], // NED x MAR — 22:00 BRT (29)
    ['ko-r32-4', '2026-06-29T17:00:00.000Z'], // BRA x JPN — 14:00 BRT
    ['ko-r32-5', '2026-06-30T21:00:00.000Z'], // 18:00 BRT (antes vinha errado)
    ['ko-r32-6', '2026-06-30T17:00:00.000Z'], // CIV x NOR — 14:00 BRT
    ['ko-r32-9', '2026-07-02T00:00:00.000Z'], // USA x BIH — 21:00 BRT (01)
    ['ko-r32-13', '2026-07-03T03:00:00.000Z'], // 00:00 BRT (03)
    ['ko-r32-16', '2026-07-03T18:00:00.000Z'], // 15:00 BRT
    ['ko-r16-1', '2026-07-04T21:00:00.000Z'],
    ['ko-qf-4', '2026-07-12T01:00:00.000Z'], // 22:00 BRT (11)
    ['ko-sf-1', '2026-07-14T19:00:00.000Z'], // 16:00 BRT
    ['ko-final-1', '2026-07-19T19:00:00.000Z'], // 16:00 BRT
  ]
  it.each(CASES)('%s → %s', (id, utc) => {
    expect(byId(id).kickoffUtc).toBe(utc)
  })
})

// Chave oficial FIFA é assimétrica (não sequencial). Oitava 1 = V2 × V5, etc.
describe('wc2026 — chaveamento oficial (feeders R16/QF)', () => {
  const R16: [string, string, string][] = [
    ['ko-r16-1', 'Vencedor Fase de 32 2', 'Vencedor Fase de 32 5'],
    ['ko-r16-2', 'Vencedor Fase de 32 1', 'Vencedor Fase de 32 3'],
    ['ko-r16-3', 'Vencedor Fase de 32 4', 'Vencedor Fase de 32 6'],
    ['ko-r16-4', 'Vencedor Fase de 32 7', 'Vencedor Fase de 32 8'],
    ['ko-r16-5', 'Vencedor Fase de 32 11', 'Vencedor Fase de 32 12'],
    ['ko-r16-6', 'Vencedor Fase de 32 9', 'Vencedor Fase de 32 10'],
    ['ko-r16-7', 'Vencedor Fase de 32 14', 'Vencedor Fase de 32 16'],
    ['ko-r16-8', 'Vencedor Fase de 32 13', 'Vencedor Fase de 32 15'],
  ]
  it.each(R16)('%s = %s × %s', (id, home, away) => {
    expect(byId(id).home.name).toBe(home)
    expect(byId(id).away.name).toBe(away)
  })

  const QF: [string, string, string][] = [
    ['ko-qf-1', 'Vencedor Oitavas 1', 'Vencedor Oitavas 2'],
    ['ko-qf-2', 'Vencedor Oitavas 5', 'Vencedor Oitavas 6'],
    ['ko-qf-3', 'Vencedor Oitavas 3', 'Vencedor Oitavas 4'],
    ['ko-qf-4', 'Vencedor Oitavas 7', 'Vencedor Oitavas 8'],
  ]
  it.each(QF)('%s = %s × %s', (id, home, away) => {
    expect(byId(id).home.name).toBe(home)
    expect(byId(id).away.name).toBe(away)
  })
})
