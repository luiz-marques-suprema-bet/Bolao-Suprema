import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { WC2026_GROUP_MATCHES } from '@/data/wc2026'

// M7: garante que o seed SQL dos 72 jogos de grupo permanece em paridade com a
// fonte canônica src/data/wc2026.ts (códigos, mandante/visitante e kickoff UTC).
// Se alguém alterar a agenda em um lugar e esquecer o outro, este teste quebra.

const SQL = readFileSync(
  new URL('../../supabase/migrations/20260530123000_seed_group_matches.sql', import.meta.url),
  'utf8',
)

interface SeedRow { home: string; away: string; kickoff: string }

function parseSeed(): Record<string, SeedRow> {
  const re = /\('(g-[a-z]-\d+)','group','[^']*','[A-L]',\d+,'([A-Z]{3})','([A-Z]{3})','[^']*','[^']*','([0-9T:.Z-]+)'::timestamptz/g
  const out: Record<string, SeedRow> = {}
  for (const m of SQL.matchAll(re)) {
    out[m[1]] = { home: m[2], away: m[3], kickoff: m[4] }
  }
  return out
}

describe('group matches seed parity (wc2026.ts ↔ migration)', () => {
  const seed = parseSeed()

  it('seeds exactly the 72 group matches present in wc2026.ts', () => {
    expect(Object.keys(seed)).toHaveLength(72)
    expect(WC2026_GROUP_MATCHES).toHaveLength(72)
    const seedCodes = new Set(Object.keys(seed))
    const dataCodes = new Set(WC2026_GROUP_MATCHES.map(m => m.id))
    expect(seedCodes).toEqual(dataCodes)
  })

  it('matches home, away and kickoff_utc for every group match', () => {
    for (const m of WC2026_GROUP_MATCHES) {
      const row = seed[m.id]
      expect(row, `seed faltando ${m.id}`).toBeTruthy()
      expect(row.home, `home ${m.id}`).toBe(m.home.code)
      expect(row.away, `away ${m.id}`).toBe(m.away.code)
      expect(row.kickoff, `kickoff ${m.id}`).toBe(m.kickoffUtc)
    }
  })
})
