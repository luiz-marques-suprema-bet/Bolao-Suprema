import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// Valida o mapa de progressao do mata-mata (knockout_progression):
// 16 alvos = 8 Oitavas + 4 Quartas + 2 Semis + 1 Final + 1 3o lugar.
// Final = vencedores das semis; 3o lugar = perdedores das semis.
// Cada Oitava p vem dos vencedores de ko-r32-(2p-1) e ko-r32-(2p).

const SQL = readFileSync(
  new URL('../../supabase/migrations/20260531120000_knockout_materialization.sql', import.meta.url),
  'utf8',
)

interface Row { target: string; homeSrc: string; homeTake: string; awaySrc: string; awayTake: string }

function parse(): Row[] {
  const re = /\('(ko-(?:r16|qf|sf|final|third)-\d+)','(ko-[a-z0-9-]+)','(winner|loser)','(ko-[a-z0-9-]+)','(winner|loser)'\)/g
  const rows: Row[] = []
  for (const m of SQL.matchAll(re)) rows.push({ target: m[1], homeSrc: m[2], homeTake: m[3], awaySrc: m[4], awayTake: m[5] })
  return rows
}

describe('knockout progression map', () => {
  const rows = parse()
  const byPrefix = (p: string) => rows.filter(r => r.target.startsWith(p))

  it('covers all rounds: 8 R16 + 4 QF + 2 SF + 1 Final + 1 Third = 16', () => {
    expect(rows).toHaveLength(16)
    expect(byPrefix('ko-r16-')).toHaveLength(8)
    expect(byPrefix('ko-qf-')).toHaveLength(4)
    expect(byPrefix('ko-sf-')).toHaveLength(2)
    expect(byPrefix('ko-final-')).toHaveLength(1)
    expect(byPrefix('ko-third-')).toHaveLength(1)
  })

  it('R16 slot p feeds from winners of ko-r32-(2p-1) and ko-r32-(2p)', () => {
    for (const r of byPrefix('ko-r16-')) {
      const p = Number(r.target.split('-').pop())
      expect(r.homeSrc).toBe(`ko-r32-${2 * p - 1}`)
      expect(r.awaySrc).toBe(`ko-r32-${2 * p}`)
      expect(r.homeTake).toBe('winner')
      expect(r.awayTake).toBe('winner')
    }
  })

  it('Final takes the two semifinal winners; Third takes the two semifinal losers', () => {
    const final = byPrefix('ko-final-')[0]
    expect([final.homeSrc, final.awaySrc].sort()).toEqual(['ko-sf-1', 'ko-sf-2'])
    expect([final.homeTake, final.awayTake]).toEqual(['winner', 'winner'])
    const third = byPrefix('ko-third-')[0]
    expect([third.homeSrc, third.awaySrc].sort()).toEqual(['ko-sf-1', 'ko-sf-2'])
    expect([third.homeTake, third.awayTake]).toEqual(['loser', 'loser'])
  })
})
