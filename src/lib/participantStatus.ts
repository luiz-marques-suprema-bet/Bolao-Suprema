import type { ParticipantStatus } from '@/types'

const VALID_PARTICIPANT_STATUSES: ParticipantStatus[] = ['pending', 'active', 'blocked', 'removed']

export function normalizeParticipantStatus(status: unknown): ParticipantStatus {
  return VALID_PARTICIPANT_STATUSES.includes(status as ParticipantStatus)
    ? status as ParticipantStatus
    : 'active'
}

export function canParticipate(status: ParticipantStatus | undefined): boolean {
  return status !== 'blocked' && status !== 'removed'
}
