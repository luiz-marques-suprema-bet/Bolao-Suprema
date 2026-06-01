import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// Valida o mapa de progressao do mata-mata (knockout_progression):
// 16 alvos = 8 Oitavas + 4 Quartas + 2 Semis + 1 Final + 1 3o lugar.
// Final = vencedores das semis; 3o lugar = perdedores das semis.
// As oitavas seguem a numeracao oficial FIFA: 89=(74,77), 90=(73,75), etc.

const SQL = readFileSync(
  new URL('../../supabase/migrations/20260601040928_official_third_place_h2h.sql', import.meta.url),
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

  it('R16 follows official match progression', () => {
    expect(byPrefix('ko-r16-')).toEqual([
      { target: 'ko-r16-1', homeSrc: 'ko-r32-2', homeTake: 'winner', awaySrc: 'ko-r32-5', awayTake: 'winner' },
      { target: 'ko-r16-2', homeSrc: 'ko-r32-1', homeTake: 'winner', awaySrc: 'ko-r32-3', awayTake: 'winner' },
      { target: 'ko-r16-3', homeSrc: 'ko-r32-4', homeTake: 'winner', awaySrc: 'ko-r32-6', awayTake: 'winner' },
      { target: 'ko-r16-4', homeSrc: 'ko-r32-7', homeTake: 'winner', awaySrc: 'ko-r32-8', awayTake: 'winner' },
      { target: 'ko-r16-5', homeSrc: 'ko-r32-11', homeTake: 'winner', awaySrc: 'ko-r32-12', awayTake: 'winner' },
      { target: 'ko-r16-6', homeSrc: 'ko-r32-9', homeTake: 'winner', awaySrc: 'ko-r32-10', awayTake: 'winner' },
      { target: 'ko-r16-7', homeSrc: 'ko-r32-14', homeTake: 'winner', awaySrc: 'ko-r32-16', awayTake: 'winner' },
      { target: 'ko-r16-8', homeSrc: 'ko-r32-13', homeTake: 'winner', awaySrc: 'ko-r32-15', awayTake: 'winner' },
    ])
  })

  it('QF follows official match progression', () => {
    expect(byPrefix('ko-qf-')).toEqual([
      { target: 'ko-qf-1', homeSrc: 'ko-r16-1', homeTake: 'winner', awaySrc: 'ko-r16-2', awayTake: 'winner' },
      { target: 'ko-qf-2', homeSrc: 'ko-r16-5', homeTake: 'winner', awaySrc: 'ko-r16-6', awayTake: 'winner' },
      { target: 'ko-qf-3', homeSrc: 'ko-r16-3', homeTake: 'winner', awaySrc: 'ko-r16-4', awayTake: 'winner' },
      { target: 'ko-qf-4', homeSrc: 'ko-r16-7', homeTake: 'winner', awaySrc: 'ko-r16-8', awayTake: 'winner' },
    ])
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
