import { describe, expect, it } from 'vitest'
import { TEAMS } from '@/data/teams'
import { getKnockoutScoreWinner, matchCodeToSlotId } from './bracket2026'

describe('matchCodeToSlotId', () => {
  it.each([
    ['ko-r32-1', 'r32_1'],
    ['ko-r16-8', 'r16_8'],
    ['ko-qf-4', 'qf_4'],
    ['ko-sf-2', 'sf_2'],
    ['ko-third-1', 'third_1'],
    ['ko-final-1', 'final_1'],
  ])('maps %s to %s', (matchCode, slotId) => {
    expect(matchCodeToSlotId(matchCode)).toBe(slotId)
  })

  it('rejects group and unknown match codes', () => {
    expect(matchCodeToSlotId('g-a-1')).toBeNull()
    expect(matchCodeToSlotId('ko-unknown-1')).toBeNull()
  })
})

describe('getKnockoutScoreWinner', () => {
  const match = { stage: 'round_of_32' as const, home: TEAMS.NED, away: TEAMS.MAR }

  it('returns the team ahead in the predicted regulation score', () => {
    expect(getKnockoutScoreWinner(match, 2, 1)).toBe(TEAMS.NED)
    expect(getKnockoutScoreWinner(match, 0, 1)).toBe(TEAMS.MAR)
  })

  it('requires a separate advancer pick when regulation is tied', () => {
    expect(getKnockoutScoreWinner(match, 0, 0)).toBeNull()
  })

  it('does not derive bracket advancement for group matches', () => {
    expect(getKnockoutScoreWinner({ ...match, stage: 'group' }, 2, 1)).toBeNull()
  })
})
