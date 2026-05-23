import { describe, expect, it } from 'vitest'
import { TEAMS } from '@/data/teams'
import { WC2026_MATCHES } from '@/data/wc2026'
import { getEffectiveMarketStatus, isBetOpen } from '@/lib/markets'
import { hasDefinedTeams, isPlaceholderMatch, isPlaceholderTeam } from './matchGuards'

describe('match guards and placeholder markets', () => {
  it('identifies placeholder teams and valid teams', () => {
    expect(isPlaceholderTeam(null)).toBe(true)
    expect(isPlaceholderTeam(TEAMS.TBD)).toBe(true)
    expect(isPlaceholderTeam({ ...TEAMS.BRA, flag: '' })).toBe(true)
    expect(isPlaceholderTeam(TEAMS.BRA)).toBe(false)
  })

  it('keeps knockout placeholders non-pickable even before kickoff', () => {
    const placeholder = WC2026_MATCHES.find(match => match.id === 'ko-r32-1')!

    expect(isPlaceholderMatch(placeholder)).toBe(true)
    expect(hasDefinedTeams(placeholder)).toBe(false)
    expect(getEffectiveMarketStatus({ ...placeholder, marketStatus: 'open', lockReason: null })).toBe('locked')
    expect(isBetOpen({ ...placeholder, marketStatus: 'open', lockReason: null })).toBe(false)
  })

  it('allows defined group matches to use normal market status', () => {
    const groupMatch = WC2026_MATCHES.find(match => match.id === 'g-a-1')!

    expect(isPlaceholderMatch(groupMatch)).toBe(false)
    expect(hasDefinedTeams(groupMatch)).toBe(true)
    expect(getEffectiveMarketStatus(groupMatch, new Date('2026-05-22T12:00:00Z'))).toBe('open')
  })
})
