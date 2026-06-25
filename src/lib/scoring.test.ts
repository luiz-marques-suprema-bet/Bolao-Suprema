import { describe, expect, it } from 'vitest'
import { calculateKoPoints, calculatePoints } from './scoring'

describe('scoring rules', () => {
  it('scores group stage exact, result plus one score, result and one-team goals', () => {
    expect(calculatePoints({ homeScore: 2, awayScore: 1 }, { homeScore: 2, awayScore: 1 }, 'group')).toBe(10)
    expect(calculatePoints({ homeScore: 3, awayScore: 0 }, { homeScore: 3, awayScore: 1 }, 'group')).toBe(7)
    expect(calculatePoints({ homeScore: 2, awayScore: 1 }, { homeScore: 1, awayScore: 0 }, 'group')).toBe(5)
    expect(calculatePoints({ homeScore: 1, awayScore: 1 }, { homeScore: 2, awayScore: 1 }, 'group')).toBe(1)
  })

  it('requires the WINNER goals for +7/+8 — loser goals only is just the result (5)', () => {
    // USA 4×1, palpite 2×1: resultado certo, gols do perdedor certos (1=1),
    // gols do vencedor errados (2≠4) → 5, NÃO 7.
    expect(calculatePoints({ homeScore: 2, awayScore: 1 }, { homeScore: 4, awayScore: 1 }, 'group')).toBe(5)
    expect(calculatePoints({ homeScore: 3, awayScore: 1 }, { homeScore: 4, awayScore: 1 }, 'group')).toBe(5)
    // Visitante vence: gols do vencedor (visitante) certos → 7.
    expect(calculatePoints({ homeScore: 1, awayScore: 3 }, { homeScore: 0, awayScore: 3 }, 'group')).toBe(7)
    // Mata-mata: mesma regra para o +8.
    expect(calculateKoPoints({ homeScore: 2, awayScore: 1 }, { homeScore: 4, awayScore: 1 }, 'home', 'home')).toBe(5)
  })

  it('knockout: "quem passa manda" — acertando o classificado, o placar é bônus', () => {
    // placar exato + quem passa = CRAVADA (12)
    expect(calculateKoPoints({ homeScore: 2, awayScore: 1 }, { homeScore: 2, awayScore: 1 }, 'home', 'home')).toBe(12)
    // resultado + gols do vencedor + quem passa = 8
    expect(calculateKoPoints({ homeScore: 3, awayScore: 0 }, { homeScore: 3, awayScore: 1 }, 'home', 'home')).toBe(8)
    // resultado certo (90') + quem passa = 5
    expect(calculateKoPoints({ homeScore: 2, awayScore: 1 }, { homeScore: 1, awayScore: 0 }, 'home', 'home')).toBe(5)
    // errou o placar mas acertou quem passa = 3
    expect(calculateKoPoints({ homeScore: 1, awayScore: 2 }, { homeScore: 1, awayScore: 1 }, 'home', 'home')).toBe(3)
  })

  it('knockout: errou quem passa — só consolação se cravou o placar do tempo normal', () => {
    // cravou 1×1 mas o outro passou nos pênaltis → consolação (2)
    expect(calculateKoPoints({ homeScore: 1, awayScore: 1 }, { homeScore: 1, awayScore: 1 }, 'home', 'away')).toBe(2)
    // resultado de 90' "certo" mas errou quem passa → 0 (não basta o resultado)
    expect(calculateKoPoints({ homeScore: 2, awayScore: 1 }, { homeScore: 3, awayScore: 1 }, 'away', 'home')).toBe(0)
    // errou placar e quem passa → 0
    expect(calculateKoPoints({ homeScore: 1, awayScore: 2 }, { homeScore: 1, awayScore: 1 }, 'away', 'home')).toBe(0)
  })
})
