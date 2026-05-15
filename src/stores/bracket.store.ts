import { create } from 'zustand'
import type { BracketRound, TeamCode } from '@/types'
import { supabase, isMockMode } from '@/lib/supabase'
import { deleteBracketPick, saveBracketPick } from '@/services/product'

function roundFromSlotId(slotId: string): BracketRound {
  if (slotId.startsWith('r32_')) return 'r32'
  if (slotId.startsWith('r16_')) return 'r16'
  if (slotId.startsWith('qf_')) return 'qf'
  if (slotId.startsWith('sf_')) return 'sf'
  if (slotId.startsWith('third_')) return 'third'
  return 'final'
}

interface BracketState {
  picks: Record<string, TeamCode> // slotId → pickedWinner
  lockedRounds: BracketRound[]
  _userId: string | undefined

  setUserId: (id: string | undefined) => void
  syncFromSupabase: (userId: string) => Promise<void>

  setPick: (slotId: string, winner: TeamCode) => void
  clearPick: (slotId: string) => void
  lockRound: (round: BracketRound) => void
  isRoundLocked: (round: BracketRound) => boolean
  getPick: (slotId: string) => TeamCode | undefined

  /** Returns the predicted home/away for a QF/SF/Final slot based on R16 picks */
  resolveSlotTeams: (
    slotId: string,
    allSlots: Array<{ slotId: string; round: BracketRound; position: number; homeTeam: { code: string } | null; awayTeam: { code: string } | null; winner: string | null }>
  ) => { home: TeamCode | null; away: TeamCode | null }
}

// WC2026: 16 R16 → 8 QF → 4 SF → Third place (sf_3 vs sf_4) + Final (sf_1 vs sf_2)
// Each QF picks winner from 2 R16 slots
const R16_TO_QF: Record<number, { qfPosition: number; side: 'home' | 'away' }> = {
  1:  { qfPosition: 1, side: 'home' },
  2:  { qfPosition: 1, side: 'away' },
  3:  { qfPosition: 2, side: 'home' },
  4:  { qfPosition: 2, side: 'away' },
  5:  { qfPosition: 3, side: 'home' },
  6:  { qfPosition: 3, side: 'away' },
  7:  { qfPosition: 4, side: 'home' },
  8:  { qfPosition: 4, side: 'away' },
  9:  { qfPosition: 5, side: 'home' },
  10: { qfPosition: 5, side: 'away' },
  11: { qfPosition: 6, side: 'home' },
  12: { qfPosition: 6, side: 'away' },
  13: { qfPosition: 7, side: 'home' },
  14: { qfPosition: 7, side: 'away' },
  15: { qfPosition: 8, side: 'home' },
  16: { qfPosition: 8, side: 'away' },
}

// Each SF picks winner from 2 QF slots
const QF_TO_SF: Record<number, { sfPosition: number; side: 'home' | 'away' }> = {
  1: { sfPosition: 1, side: 'home' },
  2: { sfPosition: 1, side: 'away' },
  3: { sfPosition: 2, side: 'home' },
  4: { sfPosition: 2, side: 'away' },
  5: { sfPosition: 3, side: 'home' },
  6: { sfPosition: 3, side: 'away' },
  7: { sfPosition: 4, side: 'home' },
  8: { sfPosition: 4, side: 'away' },
}


export const useBracketStore = create<BracketState>()(
    (set, get) => ({
      picks: {},
      lockedRounds: [],
      _userId: undefined,

      setUserId: (id) => set({ _userId: id }),

      // ── Sync from Supabase on login ─────────────────────────────────────────

      syncFromSupabase: async (userId) => {
        if (isMockMode) return
        const { data } = await supabase
          .from('bracket_picks')
          .select('slot_id, picked_winner')
          .eq('user_id', userId)

        const picks: Record<string, TeamCode> = {}
        for (const row of data ?? []) {
          if (row.slot_id && row.picked_winner) {
            picks[row.slot_id] = row.picked_winner as TeamCode
          }
        }
        set({ picks })
      },

      // ── Picks: local + Supabase upsert ──────────────────────────────────────

      setPick: (slotId, winner) => {
        set((s) => ({ picks: { ...s.picks, [slotId]: winner } }))

        const userId = get()._userId
        if (!isMockMode && userId) {
          saveBracketPick(slotId, roundFromSlotId(slotId), winner).then((res) => {
            if (res.error) {
              console.error('[Bracket] setPick error:', res.error)
              set((s) => {
                const picks = { ...s.picks }
                delete picks[slotId]
                return { picks }
              })
            }
          })
        }
      },

      clearPick: (slotId) => {
        const previous = get().picks[slotId]
        set((s) => {
          const picks = { ...s.picks }
          delete picks[slotId]
          return { picks }
        })

        const userId = get()._userId
        if (!isMockMode && userId) {
          deleteBracketPick(slotId).then((res) => {
            if (res.error) {
              console.error('[Bracket] clearPick error:', res.error)
              if (previous) set((s) => ({ picks: { ...s.picks, [slotId]: previous } }))
            }
          })
        }
      },

      lockRound: (round) =>
        set((s) => ({
          lockedRounds: s.lockedRounds.includes(round)
            ? s.lockedRounds
            : [...s.lockedRounds, round],
        })),

      isRoundLocked: (round) => get().lockedRounds.includes(round),
      getPick: (slotId) => get().picks[slotId],

      resolveSlotTeams: (slotId, allSlots) => {
        const { picks } = get()

        const getSlot = (id: string) => allSlots.find((s) => s.slotId === id)

        if (slotId.startsWith('qf_')) {
          const position = parseInt(slotId.replace('qf_', ''))
          const r16Home = Object.entries(R16_TO_QF)
            .find(([, v]) => v.qfPosition === position && v.side === 'home')?.[0]
          const r16Away = Object.entries(R16_TO_QF)
            .find(([, v]) => v.qfPosition === position && v.side === 'away')?.[0]

          if (!r16Home || !r16Away) return { home: null, away: null }

          const homeSlotId = `r16_${r16Home}`
          const awaySlotId = `r16_${r16Away}`
          const homeSlot = getSlot(homeSlotId)
          const awaySlot = getSlot(awaySlotId)

          const home = (homeSlot?.winner || picks[homeSlotId]) ?? null
          const away = (awaySlot?.winner || picks[awaySlotId]) ?? null
          return { home: home as TeamCode | null, away: away as TeamCode | null }
        }

        if (slotId.startsWith('sf_')) {
          const position = parseInt(slotId.replace('sf_', ''))
          const qfHome = Object.entries(QF_TO_SF)
            .find(([, v]) => v.sfPosition === position && v.side === 'home')?.[0]
          const qfAway = Object.entries(QF_TO_SF)
            .find(([, v]) => v.sfPosition === position && v.side === 'away')?.[0]

          if (!qfHome || !qfAway) return { home: null, away: null }

          const homeQfId = `qf_${qfHome}`
          const awayQfId = `qf_${qfAway}`
          const homeQf = getSlot(homeQfId)
          const awayQf = getSlot(awayQfId)

          const home = (homeQf?.winner || picks[homeQfId]) ?? null
          const away = (awayQf?.winner || picks[awayQfId]) ?? null
          return { home: home as TeamCode | null, away: away as TeamCode | null }
        }

        if (slotId === 'third_1') {
          const sf2 = getSlot('sf_2')
          const sf4 = getSlot('sf_4')
          const home = (sf2?.winner || picks['sf_2']) ?? null
          const away = (sf4?.winner || picks['sf_4']) ?? null
          return { home: home as TeamCode | null, away: away as TeamCode | null }
        }

        if (slotId === 'final_1') {
          const sf1 = getSlot('sf_1')
          const sf3 = getSlot('sf_3')
          const home = (sf1?.winner || picks['sf_1']) ?? null
          const away = (sf3?.winner || picks['sf_3']) ?? null
          return { home: home as TeamCode | null, away: away as TeamCode | null }
        }

        return { home: null, away: null }
      },
    })
)
