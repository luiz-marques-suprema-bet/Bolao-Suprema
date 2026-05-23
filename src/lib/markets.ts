import type { MarketStatus, Match, MatchStatus } from '@/types'
import { getBettingDeadline } from '@/lib/matchTime'
import { isPlaceholderMatch } from '@/lib/matchGuards'

export type MarketStatusOverride = MarketStatus | null | undefined

export interface MarketLike {
  kickoffUtc: string
  status?: MatchStatus
  marketStatus?: MarketStatusOverride
  home?: Match['home']
  away?: Match['away']
  lockedAt?: string | null
  lockReason?: string | null
  settledAt?: string | null
}

export function isMatchStarted(match: MarketLike, now = new Date()): boolean {
  return now >= getBettingDeadline(match)
}

export function isMatchClosed(match: MarketLike, now = new Date()): boolean {
  return isMatchStarted(match, now) || match.status === 'live' || match.status === 'finished'
}

export function getEffectiveMarketStatus(match: MarketLike, now = new Date()): MarketStatus {
  if (match.marketStatus === 'settled' || match.status === 'finished' || match.settledAt) return 'settled'
  if (isPlaceholderMatch(match)) return 'locked'
  if (match.marketStatus === 'locked' || match.lockedAt) return 'locked'
  if (match.marketStatus === 'closed' || match.status === 'live' || isMatchStarted(match, now)) return 'closed'
  return 'open'
}

export function isBetOpen(
  match: Pick<Match, 'kickoffUtc' | 'status'> & Partial<Pick<Match, 'marketStatus' | 'lockedAt' | 'lockReason' | 'settledAt' | 'home' | 'away'>>,
  now = new Date(),
): boolean {
  return getEffectiveMarketStatus(match, now) === 'open'
}

export function getMarketStatusLabel(status: MarketStatus): string {
  const labels: Record<MarketStatus, string> = {
    open: 'ABERTO',
    locked: 'BLOQUEADO',
    closed: 'ENCERRADO',
    settled: 'APURADO',
  }
  return labels[status]
}
