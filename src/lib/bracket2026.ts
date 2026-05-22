import { WC2026_KNOCKOUT_MATCHES } from '@/data/wc2026'
import type { BracketRound, BracketSlot, MatchStage } from '@/types'

const STAGE_TO_ROUND: Record<Exclude<MatchStage, 'group'>, BracketRound> = {
  round_of_32: 'r32',
  round_of_16: 'r16',
  quarter_final: 'qf',
  semi_final: 'sf',
  third_place: 'third',
  final: 'final',
}

function slotId(round: BracketRound, position: number): string {
  return `${round}_${position}`
}

export const WC2026_BRACKET_SLOTS: BracketSlot[] = WC2026_KNOCKOUT_MATCHES.map((match) => {
  const round = STAGE_TO_ROUND[match.stage as Exclude<MatchStage, 'group'>]
  const roundMatches = WC2026_KNOCKOUT_MATCHES.filter(m => m.stage === match.stage)
  const position = roundMatches.findIndex(m => m.id === match.id) + 1

  return {
    slotId: slotId(round, position),
    round,
    position,
    matchId: match.id,
    homeTeam: match.home,
    awayTeam: match.away,
    homeScore: match.homeScore,
    awayScore: match.awayScore,
    status: match.status === 'finished' ? 'done' : match.status === 'live' ? 'live' : 'wait',
    winner: match.winner && match.winner !== 'draw' ? match.winner : null,
    liveMinute: match.liveMinute,
  }
})
