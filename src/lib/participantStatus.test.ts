import { describe, expect, it } from 'vitest'
import { canParticipate, normalizeParticipantStatus } from './participantStatus'

describe('participant status gates', () => {
  it('preserves known statuses exactly', () => {
    expect(normalizeParticipantStatus('pending')).toBe('pending')
    expect(normalizeParticipantStatus('active')).toBe('active')
    expect(normalizeParticipantStatus('blocked')).toBe('blocked')
    expect(normalizeParticipantStatus('removed')).toBe('removed')
  })

  it('falls back to pending instead of active', () => {
    expect(normalizeParticipantStatus(undefined)).toBe('pending')
    expect(normalizeParticipantStatus('owner')).toBe('pending')
  })

  it('allows only active participants to use protected features', () => {
    expect(canParticipate('active')).toBe(true)
    expect(canParticipate('pending')).toBe(false)
    expect(canParticipate('blocked')).toBe(false)
    expect(canParticipate('removed')).toBe(false)
  })
})
