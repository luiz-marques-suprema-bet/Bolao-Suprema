import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// Valida o mapa oficial da Fase de 32. As fontes B:<slot> sao os oito slots
// variaveis dos melhores terceiros definidos pela matriz FIFA Annex C.

const SQL = readFileSync(
  new URL('../../supabase/migrations/20260601040928_official_third_place_h2h.sql', import.meta.url),
  'utf8',
)

function parse() {
  const re = /\('(ko-r32-\d+)','([WRB]:[A-L0-9]+)','([WRB]:[A-L0-9]+)'/g
  const rows: { code: string; home: string; away: string }[] = []
  for (const m of SQL.matchAll(re)) rows.push({ code: m[1], home: m[2], away: m[3] })
  return rows
}

describe('R32 knockout slot map', () => {
  const rows = parse()
  const sources = rows.flatMap(r => [r.home, r.away])
  const byKind = (k: string) => sources.filter(s => s.startsWith(k + ':')).map(s => s.split(':')[1]).sort()

  it('has exactly 16 R32 slots', () => {
    expect(rows).toHaveLength(16)
    expect(sources).toHaveLength(32)
  })

  it('uses the official fixed winner and runner-up slots', () => {
    expect(byKind('W')).toEqual(['A','B','C','D','E','F','G','H','I','J','K','L'])
    expect(byKind('R')).toEqual(['A','B','C','D','E','F','G','H','I','J','K','L'])
  })

  it('covers the 8 official best-third slots from Annex C', () => {
    expect(byKind('B')).toEqual(['1A','1B','1D','1E','1G','1I','1K','1L'])
  })

  it('matches the FIFA R32 fixed pairings by match order 73-88', () => {
    expect(rows).toEqual([
      { code: 'ko-r32-1', home: 'R:A', away: 'R:B' },
      { code: 'ko-r32-2', home: 'W:E', away: 'B:1E' },
      { code: 'ko-r32-3', home: 'W:F', away: 'R:C' },
      { code: 'ko-r32-4', home: 'W:C', away: 'R:F' },
      { code: 'ko-r32-5', home: 'W:I', away: 'B:1I' },
      { code: 'ko-r32-6', home: 'R:E', away: 'R:I' },
      { code: 'ko-r32-7', home: 'W:A', away: 'B:1A' },
      { code: 'ko-r32-8', home: 'W:L', away: 'B:1L' },
      { code: 'ko-r32-9', home: 'W:D', away: 'B:1D' },
      { code: 'ko-r32-10', home: 'W:G', away: 'B:1G' },
      { code: 'ko-r32-11', home: 'R:K', away: 'R:L' },
      { code: 'ko-r32-12', home: 'W:H', away: 'R:J' },
      { code: 'ko-r32-13', home: 'W:B', away: 'B:1B' },
      { code: 'ko-r32-14', home: 'W:J', away: 'R:H' },
      { code: 'ko-r32-15', home: 'W:K', away: 'B:1K' },
      { code: 'ko-r32-16', home: 'R:D', away: 'R:G' },
    ])
  })
})
