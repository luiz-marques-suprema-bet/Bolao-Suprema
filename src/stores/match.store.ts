import { create } from 'zustand'
import type { MatchStatusOverride } from '@/types'
import { supabase, isMockMode } from '@/lib/supabase'

// ─── DB row ───────────────────────────────────────────────────────────────────

interface MatchRow {
  match_code: string
  status: string
  market_status: string | null
  home_code: string | null
  away_code: string | null
  home_score: number | null
  away_score: number | null
  live_minute: string | null
  winner: string | null
  locked_at: string | null
  locked_by: string | null
  lock_reason: string | null
  unlocked_at: string | null
  settled_at: string | null
  kickoff_utc: string | null
  match_date: string | null
  match_time: string | null
}

const MATCH_SELECT =
  'match_code, status, market_status, home_code, away_code, home_score, away_score, live_minute, winner, locked_at, locked_by, lock_reason, unlocked_at, settled_at, kickoff_utc, match_date, match_time'

function mapMatchRow(row: MatchRow): MatchStatusOverride {
  return {
    matchCode:    row.match_code,
    status:       row.status as MatchStatusOverride['status'],
    marketStatus: row.market_status as MatchStatusOverride['marketStatus'],
    homeCode:     row.home_code ?? null,
    awayCode:     row.away_code ?? null,
    homeScore:    row.home_score ?? null,
    awayScore:    row.away_score ?? null,
    liveMinute:   row.live_minute ?? null,
    winner:       row.winner ?? null,
    lockedAt:     row.locked_at ?? null,
    lockedBy:     row.locked_by ?? null,
    lockReason:   row.lock_reason ?? null,
    unlockedAt:   row.unlocked_at ?? null,
    settledAt:    row.settled_at ?? null,
    kickoffUtc:   row.kickoff_utc ?? null,
    date:         row.match_date ?? null,
    time:         row.match_time ?? null,
  }
}

// ─── Store ────────────────────────────────────────────────────────────────────

interface MatchStoreState {
  // map: matchCode → override
  overrides: Record<string, MatchStatusOverride>
  isLoaded: boolean
  _channel: ReturnType<typeof supabase.channel> | null
  _initPromise: Promise<void> | null

  init: () => Promise<void>
  resync: () => Promise<void>
  destroy: () => void
  getOverride: (matchCode: string) => MatchStatusOverride | undefined

  // Used by admin to optimistically apply a change before DB confirms
  applyOverride: (override: MatchStatusOverride) => void
}

export const useMatchStore = create<MatchStoreState>()((set, get) => ({
  overrides: {},
  isLoaded: false,
  _channel: null,
  _initPromise: null,

  init: () => {
    const state = get()
    if (state.isLoaded) return Promise.resolve()
    if (state._initPromise) return state._initPromise
    if (isMockMode) { set({ isLoaded: true }); return Promise.resolve() }

    const promise = (async () => {

      const { data } = await supabase
        .from('matches')
        .select(MATCH_SELECT)
        .not('match_code', 'is', null)

      if (data) {
        const overrides: Record<string, MatchStatusOverride> = {}
        for (const row of data as MatchRow[]) {
          if (!row.match_code) continue
          overrides[row.match_code] = mapMatchRow(row)
        }
        set({ overrides, isLoaded: true })
      } else {
        set({ isLoaded: true })
      }

      // Realtime: admin altera status → clientes recebem em tempo real
      const channel = supabase
        .channel('matches_status_v1')
        .on('postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'matches' },
          (payload) => {
            const row = payload.new as MatchRow
            if (!row.match_code) return
            const override = mapMatchRow(row)
            set(s => ({ overrides: { ...s.overrides, [row.match_code]: override } }))
          })
        .subscribe()

      set({ _channel: channel })
    })()

    set({ _initPromise: promise })
    return promise
  },

  // Refaz a carga dos status sem derrubar o canal realtime. Usado quando a aba
  // volta ao foco, pra recuperar UPDATEs perdidos enquanto estava em 2o plano.
  resync: async () => {
    if (isMockMode || !get().isLoaded) return
    const { data } = await supabase
      .from('matches')
      .select(MATCH_SELECT)
      .not('match_code', 'is', null)
    if (!data) return
    const overrides: Record<string, MatchStatusOverride> = {}
    for (const row of data as MatchRow[]) {
      if (!row.match_code) continue
      overrides[row.match_code] = mapMatchRow(row)
    }
    set({ overrides })
  },

  destroy: () => {
    const { _channel } = get()
    if (_channel) supabase.removeChannel(_channel)
    set({ _channel: null, overrides: {}, isLoaded: false, _initPromise: null })
  },

  getOverride: (matchCode) => get().overrides[matchCode],

  applyOverride: (override) =>
    set(s => ({ overrides: { ...s.overrides, [override.matchCode]: override } })),
}))
