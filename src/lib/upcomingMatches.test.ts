import { describe, expect, it } from 'vitest'
import { WC2026_MATCHES } from '@/data/wc2026'
import { selectUpcomingMatches } from './upcomingMatches'

describe('selectUpcomingMatches', () => {
  it('keeps future knockout placeholders visible through the final', () => {
    const upcoming = selectUpcomingMatches(
      WC2026_MATCHES,
      new Date('2026-06-27T23:59:59Z'),
      WC2026_MATCHES.length,
    )

    expect(upcoming.some(match => match.stage === 'round_of_32')).toBe(true)
    expect(upcoming.some(match => match.stage === 'final')).toBe(true)
  })

  it('orders future matches by kickoff and excludes live or finished matches', () => {
    const [first, second, third] = WC2026_MATCHES.slice(0, 3)
    const matches = [
      { ...third, status: 'finished' as const },
      { ...second, status: 'live' as const },
      first,
    ]

    expect(selectUpcomingMatches(matches, new Date('2026-06-01T00:00:00Z'))).toEqual([first])
  })
})
