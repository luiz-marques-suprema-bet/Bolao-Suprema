import { beforeEach, describe, expect, it, vi } from 'vitest'
import { WC2026_MATCHES } from '@/data/wc2026'
import { useMatchStore } from '@/stores/match.store'
import { usePredictionStore } from './prediction.store'

vi.mock('@/lib/supabase', () => ({
  isMockMode: true,
  supabase: {
    channel: vi.fn(),
    removeChannel: vi.fn(),
  },
}))

describe('prediction store flow safeguards', () => {
  beforeEach(() => {
    usePredictionStore.getState().resetLocalPredictionState()
    usePredictionStore.getState().setUserId(undefined)
    useMatchStore.getState().destroy()
  })

  it('saves only submitted batch items and never creates implicit 0x0 predictions', async () => {
    const [first, second] = WC2026_MATCHES.filter(match => match.stage === 'group')

    usePredictionStore.getState().setDraft(first.id, 2, 1)
    usePredictionStore.getState().setDraft(second.id, 0, 0)

    const result = await usePredictionStore.getState().confirmPredictionBatch([
      { match: first, homeScore: 2, awayScore: 1 },
    ])

    const state = usePredictionStore.getState()
    expect(result).toMatchObject({ ok: true, saved: 1, skipped: 0 })
    expect(state.predictions[first.id]).toMatchObject({ homeScore: 2, awayScore: 1 })
    expect(state.predictions[second.id]).toBeUndefined()
    expect(state.drafts[first.id]).toBeUndefined()
    expect(state.drafts[second.id]).toEqual({ home: 0, away: 0 })
  })

  it('does not clear a draft when a closed market rejects the save', async () => {
    const match = WC2026_MATCHES.find(item => item.stage === 'group')!
    useMatchStore.getState().applyOverride({
      matchCode: match.id,
      status: 'live',
      marketStatus: 'closed',
      homeScore: null,
      awayScore: null,
      liveMinute: '1',
      winner: null,
      lockedAt: null,
      lockedBy: null,
      lockReason: 'live',
      unlockedAt: null,
      settledAt: null,
      kickoffUtc: match.kickoffUtc,
      date: match.date,
      time: match.time,
    })

    usePredictionStore.getState().setDraft(match.id, 1, 1)

    const result = await usePredictionStore.getState().confirmPrediction({
      id: `pred-${match.id}`,
      userId: 'me',
      matchId: match.id,
      homeScore: 1,
      awayScore: 1,
      submittedAt: new Date().toISOString(),
    })

    const state = usePredictionStore.getState()
    expect(result.ok).toBe(false)
    expect(result.error).toContain('Mercado fechado')
    expect(state.predictions[match.id]).toBeUndefined()
    expect(state.drafts[match.id]).toEqual({ home: 1, away: 1 })
  })

  it('rejects placeholder knockout matches and keeps the draft', async () => {
    const match = WC2026_MATCHES.find(item => item.id === 'ko-r32-1')!
    usePredictionStore.getState().setDraft(match.id, 1, 0)

    const result = await usePredictionStore.getState().confirmPrediction({
      id: `pred-${match.id}`,
      userId: 'me',
      matchId: match.id,
      homeScore: 1,
      awayScore: 0,
      submittedAt: new Date().toISOString(),
    })

    const state = usePredictionStore.getState()
    expect(result.ok).toBe(false)
    expect(result.error).toContain('aguardando classificados')
    expect(state.predictions[match.id]).toBeUndefined()
    expect(state.drafts[match.id]).toEqual({ home: 1, away: 0 })
  })
})
