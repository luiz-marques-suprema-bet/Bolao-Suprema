import { describe, expect, it } from 'vitest'
import { clinchedPositions } from './clinched'
import type { Match } from '@/types'

const GROUP = { id: 'A', teams: ['T1', 'T2', 'T3', 'T4'] }

function mk(home: string, away: string, hs: number | null, as: number | null, finished = true): Match {
  return {
    id: `${home}-${away}`,
    stage: 'group',
    stageLabel: '',
    group: 'A',
    home: { code: home, name: home, flag: '', color: '#000' },
    away: { code: away, name: away, flag: '', color: '#000' },
    homeScore: hs,
    awayScore: as,
    date: '',
    time: '',
    kickoffUtc: '',
    venue: '',
    status: finished ? 'finished' : 'scheduled',
  } as unknown as Match
}

describe('clinchedPositions — só crava por pontos (nunca usa desempate)', () => {
  it('grupo encerrado com ordem clara: 1º e 2º cravados', () => {
    const matches = [
      mk('T1', 'T2', 1, 0), mk('T1', 'T3', 1, 0), mk('T1', 'T4', 1, 0), // T1 = 9
      mk('T2', 'T3', 1, 0), mk('T2', 'T4', 1, 0),                       // T2 = 6
      mk('T3', 'T4', 1, 0),                                             // T3 = 3, T4 = 0
    ]
    expect(clinchedPositions(GROUP, matches)).toEqual({ first: 'T1', second: 'T2' })
  })

  it('1º cravado ANTES do grupo acabar (gap de pontos inalcançável); 2º ainda não', () => {
    const matches = [
      mk('T1', 'T2', 1, 0), mk('T1', 'T3', 1, 0), mk('T1', 'T4', 1, 0), // T1 = 9 (todos os jogos do T1)
      mk('T2', 'T3', 1, 0),                                             // T2 = 3
      mk('T2', 'T4', 0, 0, false), mk('T3', 'T4', 0, 0, false),          // ainda não jogados
    ]
    // T1=9 e ninguém alcança 9 → 1º cravado. T2 (3) ainda pode empatar com T3/T4 → 2º NÃO cravado.
    expect(clinchedPositions(GROUP, matches)).toEqual({ first: 'T1', second: null })
  })

  it('empate em pontos no 2º: NÃO crava (precisa de desempate)', () => {
    const matches = [
      mk('T1', 'T2', 1, 0), mk('T1', 'T3', 1, 0), mk('T1', 'T4', 1, 0), // T1 = 9
      mk('T2', 'T3', 1, 1),                                             // T2,T3 = 1
      mk('T2', 'T4', 1, 0), mk('T3', 'T4', 1, 0),                       // T2 = 4, T3 = 4, T4 = 0
    ]
    // T2 e T3 empatados em 4 → 2º depende de saldo/confronto → não cravamos.
    expect(clinchedPositions(GROUP, matches)).toEqual({ first: 'T1', second: null })
  })

  it('2º cravado quando há folga de pontos sobre os demais', () => {
    const matches = [
      mk('T1', 'T2', 1, 0), mk('T1', 'T3', 1, 0), mk('T1', 'T4', 1, 0), // T1 = 9
      mk('T2', 'T3', 1, 0), mk('T2', 'T4', 1, 0),                       // T2 = 6
      mk('T3', 'T4', 1, 1),                                             // T3 = 1, T4 = 1
    ]
    expect(clinchedPositions(GROUP, matches)).toEqual({ first: 'T1', second: 'T2' })
  })
})
