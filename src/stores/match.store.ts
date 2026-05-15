import { create } from 'zustand'
import type { MatchStatusOverride } from '@/types'
import { supabase, isMockMode } from '@/lib/supabase'

// ─── DB row ───────────────────────────────────────────────────────────────────

interface MatchRow {
  match_code: string
  status: string
  market_status: string | null
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

function mapMatchRow(row: MatchRow): MatchStatusOverride {
  return {
    matchCode:    row.match_code,
    status:       row.status as MatchStatusOverride['status'],
    marketStatus: row.market_status as MatchStatusOverride['marketStatus'],
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

  init: () => Promise<void>
  destroy: () => void
  getOverride: (matchCode: string) => MatchStatusOverride | undefined

  // Used by admin to optimistically apply a change before DB confirms
  applyOverride: (override: MatchStatusOverride) => void
}

export const useMatchStore = create<MatchStoreState>()((set, get) => ({
  overrides: {},
  isLoaded: false,
  _channel: null,

  init: async () => {
    if (get().isLoaded) return
    if (isMockMode) { set({ isLoaded: true }); return }

    const { data } = await supabase
      .from('matches')
      .select('match_code, status, market_status, home_score, away_score, live_minute, winner, locked_at, locked_by, lock_reason, unlocked_at, settled_at, kickoff_utc, match_date, match_time')
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
  },

  destroy: () => {
    const { _channel } = get()
    if (_channel) supabase.removeChannel(_channel)
    set({ _channel: null, overrides: {}, isLoaded: false })
  },

  getOverride: (matchCode) => get().overrides[matchCode],

  applyOverride: (override) =>
    set(s => ({ overrides: { ...s.overrides, [override.matchCode]: override } })),
}))
