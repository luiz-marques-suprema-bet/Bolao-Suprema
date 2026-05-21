import { create } from 'zustand'
import type { BracketRound, TeamCode } from '@/types'
import { supabase, isMockMode } from '@/lib/supabase'

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
  clearAllPicks: () => void
  lockRound: (round: BracketRound) => void
  isRoundLocked: (round: BracketRound) => boolean
  getPick: (slotId: string) => TeamCode | undefined

  /** Returns the predicted home/away for a knockout slot based on prior-round picks. */
  resolveSlotTeams: (
    slotId: string,
    allSlots: Array<{ slotId: string; round: BracketRound; position: number; homeTeam: { code: string } | null; awayTeam: { code: string } | null; winner: string | null }>
  ) => { home: TeamCode | null; away: TeamCode | null }
}

function sourceSlotIds(targetPrefix: 'r16' | 'qf' | 'sf', position: number): [string, string] | null {
  if (targetPrefix === 'r16') return [`r32_${position * 2 - 1}`, `r32_${position * 2}`]
  if (targetPrefix === 'qf') return [`r16_${position * 2 - 1}`, `r16_${position * 2}`]
  if (targetPrefix === 'sf') return [`qf_${position * 2 - 1}`, `qf_${position * 2}`]
  return null
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
          supabase.from('bracket_picks').upsert(
            {
              user_id:       userId,
              slot_id:       slotId,
              round:         roundFromSlotId(slotId),
              picked_winner: winner,
            },
            { onConflict: 'user_id,slot_id' }
          ).then(({ error }) => {
            if (error) console.error('[Bracket] setPick error:', error.message)
          })
        }
      },

      clearPick: (slotId) => {
        set((s) => {
          const picks = { ...s.picks }
          delete picks[slotId]
          return { picks }
        })

        const userId = get()._userId
        if (!isMockMode && userId) {
          supabase.from('bracket_picks')
            .delete()
            .eq('user_id', userId)
            .eq('slot_id', slotId)
            .then(({ error }) => {
              if (error) console.error('[Bracket] clearPick error:', error.message)
            })
        }
      },

      clearAllPicks: () => {
        set({ picks: {} })
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
        const getWinner = (id: string): TeamCode | null => {
          const slot = getSlot(id)
          return ((slot?.winner || picks[id]) ?? null) as TeamCode | null
        }
        const resolveSources = (targetPrefix: 'r16' | 'qf' | 'sf', position: number) => {
          const sources = sourceSlotIds(targetPrefix, position)
          if (!sources) return { home: null, away: null }
          const [homeSlotId, awaySlotId] = sources
          return { home: getWinner(homeSlotId), away: getWinner(awaySlotId) }
        }
        const resolveFromPair = (targetPrefix: 'r16' | 'qf' | 'sf', idPrefix: string) => {
          const position = parseInt(slotId.replace(`${idPrefix}_`, ''))
          return resolveSources(targetPrefix, position)
        }

        if (slotId.startsWith('r16_')) return resolveFromPair('r16', 'r16')
        if (slotId.startsWith('qf_')) return resolveFromPair('qf', 'qf')
        if (slotId.startsWith('sf_')) return resolveFromPair('sf', 'sf')

        if (slotId === 'third_1') {
          const sf1 = resolveSources('sf', 1)
          const sf2 = resolveSources('sf', 2)
          const sf1Winner = getWinner('sf_1')
          const sf2Winner = getWinner('sf_2')
          const home = sf1.home === sf1Winner ? sf1.away : sf1.home
          const away = sf2.home === sf2Winner ? sf2.away : sf2.home
          return { home, away }
        }

        if (slotId === 'final_1') {
          return { home: getWinner('sf_1'), away: getWinner('sf_2') }
        }

        return { home: null, away: null }
      },
    })
)
