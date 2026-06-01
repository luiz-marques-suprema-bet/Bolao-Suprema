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

/** Resultado (previsto ou real) de um jogo já decidido, usado no confronto direto. */
interface PlayedResult {
  home: string
  away: string
  hs: number
  as: number
}

export function computeGroupStandings(
  group: GroupDefinition,
  matches: Match[],
  predictions: ScoreMap
): StandingRow[] {
  const rows: Record<string, StandingRow> = {}
  for (const code of group.teams) {
    rows[code] = { group: group.id, code, pts: 0, gf: 0, ga: 0, gd: 0, w: 0, d: 0, l: 0, mp: 0 }
  }

  const played: PlayedResult[] = []

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

    played.push({ home: match.home.code, away: match.away.code, hs: homeScore, as: awayScore })

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

  return sortGroupRows(Object.values(rows), played)
}

// ─── Desempate ───────────────────────────────────────────────────────────────
//
// Ordem oficial FIFA 2026 DENTRO de um grupo (empate em pontos):
//   1) confronto direto entre os empatados: pontos, saldo, gols;
//   2) saldo de gols geral;  3) gols pró geral;
//   4) fair-play;  5) ranking mundial FIFA.
// O app NÃO tem dados de fair-play nem de ranking FIFA, então os critérios 4-5
// caem num desempate alfabético DETERMINÍSTICO (documentado) — nunca aleatório.
// `sortGroupRows` aplica confronto direto; `compareStandings` é o comparador
// "geral" usado entre grupos (melhores terceiros, onde confronto direto não se
// aplica) e como desempate final.

export function compareStandings(a: StandingRow, b: StandingRow): number {
  if (b.pts !== a.pts) return b.pts - a.pts
  if (b.gd !== a.gd) return b.gd - a.gd
  if (b.gf !== a.gf) return b.gf - a.gf
  return a.code.localeCompare(b.code) // fallback determinístico (sem fair-play/ranking)
}

/** Mini-tabela de confronto direto entre os times empatados. */
function breakTieHeadToHead(tied: StandingRow[], played: PlayedResult[]): StandingRow[] {
  const codes = new Set(tied.map(r => r.code))
  const mini: Record<string, { pts: number; gd: number; gf: number }> = {}
  for (const r of tied) mini[r.code] = { pts: 0, gd: 0, gf: 0 }

  for (const m of played) {
    if (!codes.has(m.home) || !codes.has(m.away)) continue
    mini[m.home].gf += m.hs; mini[m.home].gd += m.hs - m.as
    mini[m.away].gf += m.as; mini[m.away].gd += m.as - m.hs
    if (m.hs > m.as) mini[m.home].pts += 3
    else if (m.hs < m.as) mini[m.away].pts += 3
    else { mini[m.home].pts += 1; mini[m.away].pts += 1 }
  }

  return [...tied].sort((a, b) => {
    const ma = mini[a.code], mb = mini[b.code]
    if (mb.pts !== ma.pts) return mb.pts - ma.pts   // 1a) pontos no confronto direto
    if (mb.gd !== ma.gd) return mb.gd - ma.gd        // 1b) saldo no confronto direto
    if (mb.gf !== ma.gf) return mb.gf - ma.gf        // 1c) gols no confronto direto
    if (b.gd !== a.gd) return b.gd - a.gd            // 2) saldo geral
    if (b.gf !== a.gf) return b.gf - a.gf            // 3) gols pró geral
    return a.code.localeCompare(b.code)              // 4-5) fallback determinístico
  })
}

/**
 * Ordena as linhas de UM grupo aplicando confronto direto entre empatados em
 * pontos, conforme o regulamento FIFA 2026. Para classificação de melhores
 * terceiros (entre grupos), use `compareStandings` (confronto direto não existe).
 */
export function sortGroupRows(rows: StandingRow[], played: PlayedResult[]): StandingRow[] {
  const byPoints = [...rows].sort((a, b) => b.pts - a.pts)
  const result: StandingRow[] = []
  let i = 0
  while (i < byPoints.length) {
    let j = i
    while (j + 1 < byPoints.length && byPoints[j + 1].pts === byPoints[i].pts) j++
    const tied = byPoints.slice(i, j + 1)
    result.push(...(tied.length === 1 ? tied : breakTieHeadToHead(tied, played)))
    i = j + 1
  }
  return result
}

export function rankBestThirds(standingsByGroup: Record<string, StandingRow[]>): StandingRow[] {
  return Object.values(standingsByGroup)
    .map(rows => rows[2])
    .filter((row): row is StandingRow => Boolean(row))
    .sort(compareStandings)
}
