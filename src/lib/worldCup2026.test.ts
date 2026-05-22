import { describe, expect, it } from 'vitest'
import { WC2026_BRACKET_SLOTS } from './bracket2026'
import { WC2026_GROUPS, WC2026_GROUP_MATCHES, WC2026_KNOCKOUT_MATCHES, WC2026_MATCHES } from '@/data/wc2026'

describe('World Cup 2026 model', () => {
  it('models the 48-team, 12-group, 104-match format', () => {
    const uniqueTeams = new Set(WC2026_GROUPS.flatMap(group => group.teams))

    expect(WC2026_GROUPS).toHaveLength(12)
    expect(uniqueTeams.size).toBe(48)
    expect(WC2026_GROUP_MATCHES).toHaveLength(72)
    expect(WC2026_KNOCKOUT_MATCHES).toHaveLength(32)
    expect(WC2026_MATCHES).toHaveLength(104)
  })

  it('has the expected knockout round shape', () => {
    expect(WC2026_KNOCKOUT_MATCHES.filter(match => match.stage === 'round_of_32')).toHaveLength(16)
    expect(WC2026_KNOCKOUT_MATCHES.filter(match => match.stage === 'round_of_16')).toHaveLength(8)
    expect(WC2026_KNOCKOUT_MATCHES.filter(match => match.stage === 'quarter_final')).toHaveLength(4)
    expect(WC2026_KNOCKOUT_MATCHES.filter(match => match.stage === 'semi_final')).toHaveLength(2)
    expect(WC2026_KNOCKOUT_MATCHES.filter(match => match.stage === 'third_place')).toHaveLength(1)
    expect(WC2026_KNOCKOUT_MATCHES.filter(match => match.stage === 'final')).toHaveLength(1)
  })

  it('derives bracket slots from knockout matches instead of mock-only slots', () => {
    expect(WC2026_BRACKET_SLOTS).toHaveLength(32)
    expect(WC2026_BRACKET_SLOTS.filter(slot => slot.round === 'r32')).toHaveLength(16)
    expect(WC2026_BRACKET_SLOTS.every(slot => slot.matchId?.startsWith('ko-'))).toBe(true)
  })
})
