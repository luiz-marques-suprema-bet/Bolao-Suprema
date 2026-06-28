import { WC2026_KNOCKOUT_MATCHES } from '@/data/wc2026'
import type { BracketRound, BracketSlot, Match, MatchStage } from '@/types'

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

export function matchCodeToSlotId(code: string): string | null {
  if (/^ko-r32-\d+$/.test(code)) return code.replace('ko-r32-', 'r32_')
  if (/^ko-r16-\d+$/.test(code)) return code.replace('ko-r16-', 'r16_')
  if (/^ko-qf-\d+$/.test(code)) return code.replace('ko-qf-', 'qf_')
  if (/^ko-sf-\d+$/.test(code)) return code.replace('ko-sf-', 'sf_')
  if (code === 'ko-third-1') return 'third_1'
  if (code === 'ko-final-1') return 'final_1'
  return null
}

export function getKnockoutScoreWinner(
  match: Pick<Match, 'stage' | 'home' | 'away'>,
  homeScore: number,
  awayScore: number,
): Match['home'] | null {
  if (match.stage === 'group' || homeScore === awayScore) return null
  return homeScore > awayScore ? match.home : match.away
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
