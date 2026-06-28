import type { Match } from '@/types'

export function selectUpcomingMatches(
  matches: Match[],
  now = new Date(),
  limit = 8,
): Match[] {
  const nowMs = now.getTime()

  return matches
    .filter(match => {
      const kickoffMs = new Date(match.kickoffUtc).getTime()
      return Number.isFinite(kickoffMs)
        && kickoffMs > nowMs
        && match.status !== 'live'
        && match.status !== 'finished'
    })
    .sort((a, b) => new Date(a.kickoffUtc).getTime() - new Date(b.kickoffUtc).getTime())
    .slice(0, limit)
}
