import { describe, expect, it } from 'vitest'
import { WC2026_GROUPS, WC2026_MATCHES } from '@/data/wc2026'
import { computeGroupStandings, rankBestThirds, type StandingRow } from './groupStandings'

describe('group standings and best thirds', () => {
  it('computes group order from predicted scores', () => {
    const groupA = WC2026_GROUPS.find(group => group.id === 'A')
    expect(groupA).toBeTruthy()

    const standings = computeGroupStandings(groupA!, WC2026_MATCHES, {
      'g-a-1': { homeScore: 2, awayScore: 0 },
      'g-a-2': { homeScore: 1, awayScore: 1 },
      'g-a-3': { homeScore: 0, awayScore: 1 },
      'g-a-4': { homeScore: 1, awayScore: 0 },
      'g-a-5': { homeScore: 0, awayScore: 3 },
      'g-a-6': { homeScore: 2, awayScore: 1 },
    })

    expect(standings.map(row => row.code)).toEqual(['MEX', 'RSA', 'KOR', 'CZE'])
    expect(standings[0]).toMatchObject({ pts: 9, gf: 6, ga: 0, gd: 6 })
    expect(standings[2]).toMatchObject({ pts: 1 })
  })

  it('ranks the eight best third-place teams by points, goal difference and goals for', () => {
    const standingsByGroup: Record<string, StandingRow[]> = {}

    for (const [index, group] of WC2026_GROUPS.entries()) {
      standingsByGroup[group.id] = [
        row(group.id, `${group.id}1`, 9, 5, 1),
        row(group.id, `${group.id}2`, 6, 4, 2),
        row(group.id, `${group.id}3`, index, index + 1, 1),
        row(group.id, `${group.id}4`, 0, 1, 5),
      ]
    }

    const bestThirds = rankBestThirds(standingsByGroup).slice(0, 8)

    expect(bestThirds).toHaveLength(8)
    expect(bestThirds.map(team => team.group)).toEqual(['L', 'K', 'J', 'I', 'H', 'G', 'F', 'E'])
  })
})

function row(group: string, code: string, pts: number, gf: number, ga: number): StandingRow {
  return {
    group,
    code,
    pts,
    gf,
    ga,
    gd: gf - ga,
    w: 0,
    d: 0,
    l: 0,
    mp: 3,
  }
}
