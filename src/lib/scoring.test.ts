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
    // (No mata-mata o +8 é diferente: basta resultado + placar de UM time — ver abaixo.)
  })

  it('knockout (regras 5.2): escada; +2 é bônus SÓ no placar exato do empate (não é soma)', () => {
    // JOGO DECIDIDO NO TEMPO NORMAL → placar puro, SEM bônus (máx 12), mesmo acertando o classificado
    expect(calculateKoPoints({ homeScore: 2, awayScore: 1 }, { homeScore: 2, awayScore: 1 }, 'home', 'home')).toBe(12) // exato
    expect(calculateKoPoints({ homeScore: 3, awayScore: 0 }, { homeScore: 3, awayScore: 1 }, 'home', 'home')).toBe(8)  // resultado + placar de um time
    expect(calculateKoPoints({ homeScore: 2, awayScore: 1 }, { homeScore: 1, awayScore: 0 }, 'home', 'home')).toBe(5)  // resultado
    expect(calculateKoPoints({ homeScore: 2, awayScore: 1 }, { homeScore: 4, awayScore: 1 }, 'home', 'away')).toBe(8)  // res + placar de um, sem classificado
    // JOGO QUE EMPATOU NO TEMPO NORMAL (foi p/ pênaltis) → +2 se acertar quem passa
    expect(calculateKoPoints({ homeScore: 1, awayScore: 1 }, { homeScore: 1, awayScore: 1 }, 'away', 'away')).toBe(14) // empate cravado + classificado
    expect(calculateKoPoints({ homeScore: 1, awayScore: 1 }, { homeScore: 1, awayScore: 1 }, 'home', 'away')).toBe(12) // empate cravado, errou quem passa
    expect(calculateKoPoints({ homeScore: 1, awayScore: 1 }, { homeScore: 1, awayScore: 1 }, null, 'away')).toBe(12)   // empate cravado, sem indicar
    expect(calculateKoPoints({ homeScore: 2, awayScore: 2 }, { homeScore: 1, awayScore: 1 }, 'home', 'home')).toBe(5)  // resultado (empate) — NÃO soma o classificado
    expect(calculateKoPoints({ homeScore: 2, awayScore: 2 }, { homeScore: 1, awayScore: 1 }, 'away', 'home')).toBe(5)  // idem, classificado errado — mesmos 5
    expect(calculateKoPoints({ homeScore: 1, awayScore: 2 }, { homeScore: 1, awayScore: 1 }, 'home', 'home')).toBe(2)  // errou placar/resultado, mas acertou o classificado
    // empate, mas errou o classificado (e o placar) = 0
    expect(calculateKoPoints({ homeScore: 1, awayScore: 2 }, { homeScore: 1, awayScore: 1 }, 'away', 'home')).toBe(0)
  })
})
