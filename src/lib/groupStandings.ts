import type { Match } from '@/types'

export interface GroupDefinition {
  id: string
  teams: string[]
}

export interface StandingRow {
  group: string
  code: string
  pts: number
  gf: number
  ga: number
  gd: number
  w: number
  d: number
  l: number
  mp: number
}

type ScoreMap = Record<string, { homeScore: number; awayScore: number }>

export function computeGroupStandings(
  group: GroupDefinition,
  matches: Match[],
  predictions: ScoreMap
): StandingRow[] {
  const rows: Record<string, StandingRow> = {}
  for (const code of group.teams) {
    rows[code] = { group: group.id, code, pts: 0, gf: 0, ga: 0, gd: 0, w: 0, d: 0, l: 0, mp: 0 }
  }

  for (const match of matches.filter(m => m.group === group.id)) {
    const prediction = predictions[match.id]
    const homeScore = match.status === 'finished' || match.status === 'live'
      ? match.homeScore
      : prediction?.homeScore
    const awayScore = match.status === 'finished' || match.status === 'live'
      ? match.awayScore
      : prediction?.awayScore

    if (homeScore === null || homeScore === undefined || awayScore === null || awayScore === undefined) continue

    const home = rows[match.home.code]
    const away = rows[match.away.code]
    if (!home || !away) continue

    home.mp += 1
    away.mp += 1
    home.gf += homeScore
    home.ga += awayScore
    away.gf += awayScore
    away.ga += homeScore
    home.gd = home.gf - home.ga
    away.gd = away.gf - away.ga

    if (homeScore > awayScore) {
      home.pts += 3
      home.w += 1
      away.l += 1
    } else if (homeScore === awayScore) {
      home.pts += 1
      away.pts += 1
      home.d += 1
      away.d += 1
    } else {
      away.pts += 3
      away.w += 1
      home.l += 1
    }
  }

  return Object.values(rows).sort(compareStandings)
}

export function compareStandings(a: StandingRow, b: StandingRow): number {
  if (b.pts !== a.pts) return b.pts - a.pts
  if (b.gd !== a.gd) return b.gd - a.gd
  if (b.gf !== a.gf) return b.gf - a.gf
  return a.code.localeCompare(b.code)
}

export function rankBestThirds(standingsByGroup: Record<string, StandingRow[]>): StandingRow[] {
  return Object.values(standingsByGroup)
    .map(rows => rows[2])
    .filter((row): row is StandingRow => Boolean(row))
    .sort(compareStandings)
}
