import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// Valida o mapa de slots R32 da migration de materializacao do mata-mata:
// deve cobrir exatamente 12 vencedores (W:A..L), 12 segundos (R:A..L) e
// 8 melhores terceiros (T:1..8) = 32 fontes em 16 confrontos. Espelha a
// estrutura de src/data/wc2026.ts R32_PLACEHOLDERS.

const SQL = readFileSync(
  new URL('../../supabase/migrations/20260531120000_knockout_materialization.sql', import.meta.url),
  'utf8',
)

function parse() {
  const re = /\('(ko-r32-\d+)','([WRT]:[A-L0-9]+)','([WRT]:[A-L0-9]+)'\)/g
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

  it('covers 12 group winners A..L', () => {
    expect(byKind('W')).toEqual(['A','B','C','D','E','F','G','H','I','J','K','L'])
  })

  it('covers 12 runners-up A..L', () => {
    expect(byKind('R')).toEqual(['A','B','C','D','E','F','G','H','I','J','K','L'])
  })

  it('covers the 8 best third-placed slots (T:1..8)', () => {
    expect(byKind('T')).toEqual(['1','2','3','4','5','6','7','8'])
  })
})
