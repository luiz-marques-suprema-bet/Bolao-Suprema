import type { Match, Team } from '@/types'

const PLACEHOLDER_CODES = new Set(['', 'TBD', '???'])

export function isPlaceholderTeam(team: Pick<Team, 'code' | 'flag'> | null | undefined): boolean {
  if (!team) return true
  return PLACEHOLDER_CODES.has(team.code) || !team.flag
}

export function hasDefinedTeams(match: Pick<Match, 'home' | 'away'>): boolean {
  return !isPlaceholderTeam(match.home) && !isPlaceholderTeam(match.away)
}

export function isPlaceholderMatch(match: Partial<Pick<Match, 'home' | 'away' | 'lockReason'>>): boolean {
  if (match.lockReason === 'knockout_placeholder') return true
  if (match.home === undefined && match.away === undefined) return false
  if (!match.home || !match.away) return true
  return !hasDefinedTeams(match as Pick<Match, 'home' | 'away'>)
}
