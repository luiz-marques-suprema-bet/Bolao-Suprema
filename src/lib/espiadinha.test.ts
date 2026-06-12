import { describe, expect, it } from 'vitest'
import { buildEspiadinha, type EspiaPredRow, type EspiaProfile } from './espiadinha'
import { WC2026_MATCHES } from '@/data/wc2026'
import type { Match } from '@/types'

function finishedGroupMatch(): Match {
  const base = WC2026_MATCHES.find(m => m.stage === 'group')!
  return { ...base, status: 'finished', settledAt: base.kickoffUtc, homeScore: 2, awayScore: 0 }
}

function profile(id: string): EspiaProfile {
  return { id, name: id, firstName: id, initials: id.slice(0, 2), color: '#000', dept: '' }
}

const TIER_ORDER = ['goat', 'genio', 'medio', 'tentando', 'participar']

describe('espiadinha classes (tier por posição no ranking)', () => {
  it('topo da lista é G.O.A.T e a classe é congruente com a ordem por pontos', () => {
    const match = finishedGroupMatch()
    const pointsByUser = [20, 20, 16, 14, 12, 10, 8, 6, 5, 3, 1, 0]
    const profiles = pointsByUser.map((_, i) => profile(`u${i}`))
    const predictions: EspiaPredRow[] = profiles.map((p, i) => ({
      userId: p.id, matchId: match.id, homeScore: 2, awayScore: 0, points: pointsByUser[i],
    }))

    const { standings } = buildEspiadinha([match], predictions, profiles)

    expect(standings).toHaveLength(pointsByUser.length)
    expect(standings.map(s => s.points)).toEqual([...pointsByUser].sort((a, b) => b - a))
    expect(standings[0].tier.id).toBe('goat')
    expect(standings[standings.length - 1].tier.id).toBe('participar')

    // empate de pontos no topo → mesma classe
    expect(standings[1].points).toBe(standings[0].points)
    expect(standings[1].tier.id).toBe(standings[0].tier.id)

    // descendo a lista, a classe nunca melhora (congruência total)
    for (let i = 1; i < standings.length; i++) {
      expect(TIER_ORDER.indexOf(standings[i].tier.id))
        .toBeGreaterThanOrEqual(TIER_ORDER.indexOf(standings[i - 1].tier.id))
    }
  })

  it('cravar 1 jogo (acurácia alta, poucos pontos) NÃO vira G.O.A.T acima de quem pontuou mais', () => {
    const match = finishedGroupMatch()
    const profiles = [profile('grinder1'), profile('grinder2'), profile('cravada')]
    const predictions: EspiaPredRow[] = [
      { userId: 'grinder1', matchId: match.id, homeScore: 2, awayScore: 0, points: 17 },
      { userId: 'grinder2', matchId: match.id, homeScore: 2, awayScore: 0, points: 15 },
      { userId: 'cravada',  matchId: match.id, homeScore: 2, awayScore: 0, points: 10 },
    ]

    const { standings } = buildEspiadinha([match], predictions, profiles)
    const cravada = standings.find(s => s.user.id === 'cravada')!
    expect(cravada.tier.id).not.toBe('goat')
  })
})
