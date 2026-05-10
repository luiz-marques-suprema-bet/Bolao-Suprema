import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { BracketRound, TeamCode } from '@/types'

interface BracketState {
  picks: Record<string, TeamCode> // slotId → pickedWinner
  lockedRounds: BracketRound[]

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
  persist(
    (set, get) => ({
      picks: {},
      lockedRounds: [],

      setPick: (slotId, winner) =>
        set((s) => ({ picks: { ...s.picks, [slotId]: winner } })),

      clearPick: (slotId) =>
        set((s) => {
          const picks = { ...s.picks }
          delete picks[slotId]
          return { picks }
        }),

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

        // For a QF slot, find the two R16 picks that feed it
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
          // losers side: sf_2 (left-bottom) vs sf_4 (right-bottom)
          const sf2 = getSlot('sf_2')
          const sf4 = getSlot('sf_4')
          const home = (sf2?.winner || picks['sf_2']) ?? null
          const away = (sf4?.winner || picks['sf_4']) ?? null
          return { home: home as TeamCode | null, away: away as TeamCode | null }
        }

        if (slotId === 'final_1') {
          // sf_1 (left-top) vs sf_3 (right-top) — one from each half of the bracket
          const sf1 = getSlot('sf_1')
          const sf3 = getSlot('sf_3')
          const home = (sf1?.winner || picks['sf_1']) ?? null
          const away = (sf3?.winner || picks['sf_3']) ?? null
          return { home: home as TeamCode | null, away: away as TeamCode | null }
        }

        return { home: null, away: null }
      },
    }),
    { name: 'bolao-bracket' }
  )
)
