import { describe, expect, it } from 'vitest'
import { canParticipate, normalizeParticipantStatus } from './participantStatus'

describe('participant status gates', () => {
  it('preserves known statuses exactly', () => {
    expect(normalizeParticipantStatus('pending')).toBe('pending')
    expect(normalizeParticipantStatus('active')).toBe('active')
    expect(normalizeParticipantStatus('blocked')).toBe('blocked')
    expect(normalizeParticipantStatus('removed')).toBe('removed')
  })

  it('falls back to active for self-service launch access', () => {
    expect(normalizeParticipantStatus(undefined)).toBe('active')
    expect(normalizeParticipantStatus('owner')).toBe('active')
  })

  it('blocks only exceptional removed or blocked participants', () => {
    expect(canParticipate('active')).toBe(true)
    expect(canParticipate('pending')).toBe(true)
    expect(canParticipate('blocked')).toBe(false)
    expect(canParticipate('removed')).toBe(false)
  })
})
