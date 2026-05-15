import { create } from 'zustand'
import type { Prediction } from '@/types'
import { supabase, isMockMode } from '@/lib/supabase'
import { WC2026_MATCHES } from '@/data/wc2026'
import { isBetOpen } from '@/lib/markets'
import { validateChampionVice } from '@/lib/tournamentValidation'
import { useMatchStore } from '@/stores/match.store'
import { saveGeneralPicks, savePrediction } from '@/services/product'

interface PredictionResult {
  ok: boolean
  error?: string
}

interface PredictionState {
  predictions: Record<string, Prediction> // matchId → Prediction
  drafts: Record<string, { home: number; away: number }> // matchId → draft

  // apostas gerais (antes do início do torneio)
  championPick: string | null  // campeão — 25 pts
  vicePick: string | null      // vice-campeão — 15 pts
  scorerPick: string | null    // artilheiro (nome do jogador) — 10 pts + desempate

  lastError: string | null
  _userId: string | undefined

  setUserId: (id: string | undefined) => void
  syncFromSupabase: (userId: string) => Promise<void>

  setDraft: (matchId: string, home: number, away: number) => void
  clearDraft: (matchId: string) => void
  confirmPrediction: (prediction: Prediction) => PredictionResult
  removePrediction: (matchId: string) => void
  clearAllPredictions: () => void
  clearError: () => void
  getPrediction: (matchId: string) => Prediction | undefined
  getDraft: (matchId: string) => { home: number; away: number } | undefined
  setChampionPick: (teamCode: string) => void
  setVicePick: (teamCode: string) => void
  setScorerPick: (playerName: string) => void
}

export const usePredictionStore = create<PredictionState>()(
    (set, get) => ({
      predictions: {},
      drafts: {},
      championPick: null,
      vicePick: null,
      scorerPick: null,
      lastError: null,
      _userId: undefined,

      setUserId: (id) => set({ _userId: id }),

      // ── Sync from Supabase on login ─────────────────────────────────────────

      syncFromSupabase: async (userId) => {
        if (isMockMode) return
        const { data } = await supabase
          .from('predictions')
          .select('*')
          .eq('user_id', userId)
          .not('match_code', 'is', null)

        const predictions: Record<string, Prediction> = {}
        for (const row of data ?? []) {
          if (!row.match_code) continue
          predictions[row.match_code] = {
            id:           row.id,
            userId:       row.user_id,
            matchId:      row.match_code,
            homeScore:    row.home_score,
            awayScore:    row.away_score,
            submittedAt:  row.submitted_at,
            pointsEarned: row.points_earned ?? undefined,
          }
        }
        set({ predictions })

        // Sync general picks from users table
        const { data: user } = await supabase
          .from('users')
          .select('champion_pick, vice_pick, scorer_pick')
          .eq('id', userId)
          .single()

        if (user) {
          set({
            championPick: user.champion_pick ?? null,
            vicePick:     user.vice_pick     ?? null,
            scorerPick:   user.scorer_pick   ?? null,
          })
        }
      },

      // ── Drafts (local only) ─────────────────────────────────────────────────

      setDraft: (matchId, home, away) =>
        set((s) => ({ drafts: { ...s.drafts, [matchId]: { home, away } } })),

      clearDraft: (matchId) =>
        set((s) => {
          const drafts = { ...s.drafts }
          delete drafts[matchId]
          return { drafts }
        }),

      // ── confirmPrediction: local + Supabase upsert ──────────────────────────

      confirmPrediction: (prediction) => {
        const baseMatch = WC2026_MATCHES.find(m => m.id === prediction.matchId)
        const override = useMatchStore.getState().getOverride(prediction.matchId)
        const match = baseMatch ? { ...baseMatch, ...override } : null
        if (match && !isBetOpen(match)) {
          const error = 'Mercado fechado ou bloqueado. Este palpite nao foi salvo.'
          set({ lastError: error })
          return { ok: false, error }
        }

        set((s) => {
          const predictions = { ...s.predictions, [prediction.matchId]: prediction }
          const drafts = { ...s.drafts }
          delete drafts[prediction.matchId]
          return { predictions, drafts, lastError: null }
        })

        const userId = get()._userId
        if (!isMockMode && userId) {
          savePrediction(prediction.matchId, prediction.homeScore, prediction.awayScore)
            .then((res) => {
              if (res.error) {
                console.error('[Predictions] Save error:', res.error)
                set((s) => {
                  const predictions = { ...s.predictions }
                  delete predictions[prediction.matchId]
                  return { predictions, lastError: res.error }
                })
                return
              }
              if (res.data) {
                set((s) => ({ predictions: { ...s.predictions, [prediction.matchId]: res.data } }))
              }
            })
            .catch((error) => {
              set((s) => {
                const predictions = { ...s.predictions }
                delete predictions[prediction.matchId]
                return { predictions, lastError: error.message }
              })
            })
        }
        return { ok: true }
      },

      removePrediction: (matchId) =>
        set((s) => {
          const predictions = { ...s.predictions }
          delete predictions[matchId]
          return { predictions }
        }),

      clearAllPredictions: () =>
        set({ predictions: {}, drafts: {}, championPick: null, vicePick: null, scorerPick: null, lastError: null }),

      clearError: () => set({ lastError: null }),

      getPrediction: (matchId) => get().predictions[matchId],
      getDraft: (matchId) => get().drafts[matchId],

      // ── General picks: local + sync to users table ──────────────────────────

      setChampionPick: (teamCode) => {
        const value = teamCode || null
        const before = { championPick: get().championPick, vicePick: get().vicePick, scorerPick: get().scorerPick }
        const validation = validateChampionVice(value, get().vicePick)
        if (!validation.valid) {
          set({ lastError: validation.error })
          return
        }
        set({ championPick: value, lastError: null })
        const uid = get()._userId
        if (!isMockMode && uid) {
          saveGeneralPicks(value, get().vicePick, get().scorerPick)
            .then(res => { if (res.error) set({ ...before, lastError: res.error }) })
        }
      },

      setVicePick: (teamCode) => {
        const value = teamCode || null
        const before = { championPick: get().championPick, vicePick: get().vicePick, scorerPick: get().scorerPick }
        const validation = validateChampionVice(get().championPick, value)
        if (!validation.valid) {
          set({ lastError: validation.error })
          return
        }
        set({ vicePick: value, lastError: null })
        const uid = get()._userId
        if (!isMockMode && uid) {
          saveGeneralPicks(get().championPick, value, get().scorerPick)
            .then(res => { if (res.error) set({ ...before, lastError: res.error }) })
        }
      },

      setScorerPick: (playerName) => {
        const before = { championPick: get().championPick, vicePick: get().vicePick, scorerPick: get().scorerPick }
        set({ scorerPick: playerName, lastError: null })
        const uid = get()._userId
        if (!isMockMode && uid) {
          saveGeneralPicks(get().championPick, get().vicePick, playerName)
            .then(res => { if (res.error) set({ ...before, lastError: res.error }) })
        }
      },
    })
)
