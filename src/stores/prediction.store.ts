import { create } from 'zustand'
import type { Match, Prediction } from '@/types'
import { supabase, isMockMode } from '@/lib/supabase'
import { WC2026_MATCHES } from '@/data/wc2026'
import { isBetOpen } from '@/lib/markets'
import { isPlaceholderMatch } from '@/lib/matchGuards'
import { validateChampionVice } from '@/lib/tournamentValidation'
import { useMatchStore } from '@/stores/match.store'
import { useBracketStore } from '@/stores/bracket.store'

interface PredictionResult {
  ok: boolean
  error?: string
}

interface PredictionBatchResult extends PredictionResult {
  saved: number
  skipped: number
}

interface PredictionBatchItem {
  match: Match
  homeScore: number
  awayScore: number
}

interface PredictionState {
  predictions: Record<string, Prediction>
  drafts: Record<string, { home: number; away: number }>

  championPick: string | null
  vicePick: string | null
  scorerPick: string | null

  lastError: string | null
  /** true enquanto save_general_picks está em voo (UI mostra "salvando"). */
  savingGeneral: boolean
  _userId: string | undefined

  setUserId: (id: string | undefined) => void
  syncFromSupabase: (userId: string) => Promise<void>

  setDraft: (matchId: string, home: number, away: number) => void
  clearDraft: (matchId: string) => void
  confirmPrediction: (prediction: Prediction) => Promise<PredictionResult>
  confirmPredictionBatch: (items: PredictionBatchItem[]) => Promise<PredictionBatchResult>
  removePrediction: (matchId: string) => void
  resetLocalPredictionState: () => void
  deleteUserPredictionsExplicitly: () => Promise<void>
  clearAllPredictions: () => Promise<void>
  clearError: () => void
  getPrediction: (matchId: string) => Prediction | undefined
  getDraft: (matchId: string) => { home: number; away: number } | undefined
  setChampionPick: (teamCode: string) => Promise<void>
  setVicePick: (teamCode: string) => Promise<void>
  setScorerPick: (playerName: string) => Promise<void>
}

type PredictionRow = {
  id: string
  user_id: string
  match_code: string
  home_score: number
  away_score: number
  submitted_at: string
  points_earned?: number | null
}

function toPrediction(row: PredictionRow): Prediction {
  return {
    id:           row.id,
    userId:       row.user_id,
    matchId:      row.match_code,
    homeScore:    row.home_score,
    awayScore:    row.away_score,
    submittedAt:  row.submitted_at,
    pointsEarned: row.points_earned ?? undefined,
  }
}

function mergeMatchWithOverride(matchId: string): Match | null {
  const baseMatch = WC2026_MATCHES.find(m => m.id === matchId)
  const override = useMatchStore.getState().getOverride(matchId)
  if (!baseMatch) return null
  if (!override) return baseMatch
  return {
    ...baseMatch,
    status:       override.status,
    marketStatus: override.marketStatus ?? undefined,
    lockedAt:     override.lockedAt ?? null,
    settledAt:    override.settledAt ?? null,
    kickoffUtc:   override.kickoffUtc ?? baseMatch.kickoffUtc,
  }
}

async function saveGeneralPicks(
  championPick: string | null,
  vicePick: string | null,
  scorerPick: string | null,
): Promise<void> {
  const { error } = await supabase.rpc('save_general_picks', {
    p_champion: championPick,
    p_vice: vicePick,
    p_scorer: scorerPick,
  })
  if (error) throw new Error(error.message)
}

async function savePredictionFallback(userId: string, prediction: Prediction): Promise<Prediction> {
  const payload = {
    user_id:      userId,
    match_code:   prediction.matchId,
    home_score:   prediction.homeScore,
    away_score:   prediction.awayScore,
    submitted_at: prediction.submittedAt,
  }

  const { data: existing, error: lookupError } = await supabase
    .from('predictions')
    .select('id')
    .eq('user_id', userId)
    .eq('match_code', prediction.matchId)
    .maybeSingle()

  if (lookupError) throw new Error(lookupError.message)

  if (existing?.id) {
    const { data, error } = await supabase
      .from('predictions')
      .update(payload)
      .eq('id', existing.id)
      .select('id,user_id,match_code,home_score,away_score,submitted_at,points_earned')
      .single()
    if (error) throw new Error(error.message)
    return toPrediction(data as PredictionRow)
  }

  const { data, error } = await supabase
    .from('predictions')
    .insert(payload)
    .select('id,user_id,match_code,home_score,away_score,submitted_at,points_earned')
    .single()
  if (error) throw new Error(error.message)
  return toPrediction(data as PredictionRow)
}

async function savePredictionBatchFallback(userId: string, predictions: Prediction[]): Promise<Prediction[]> {
  const saved: Prediction[] = []
  for (const prediction of predictions) {
    saved.push(await savePredictionFallback(userId, prediction))
  }
  return saved
}

export const usePredictionStore = create<PredictionState>()(
  (set, get) => ({
    predictions: {},
    drafts: {},
    championPick: null,
    vicePick: null,
    scorerPick: null,
    lastError: null,
    savingGeneral: false,
    _userId: undefined,

    setUserId: (id) => set({ _userId: id }),

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
        predictions[row.match_code] = toPrediction(row as PredictionRow)
      }
      set({ predictions })

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

    setDraft: (matchId, home, away) =>
      set((s) => ({ drafts: { ...s.drafts, [matchId]: { home, away } } })),

    clearDraft: (matchId) =>
      set((s) => {
        const drafts = { ...s.drafts }
        delete drafts[matchId]
        return { drafts }
      }),

    confirmPrediction: async (prediction) => {
      const match = mergeMatchWithOverride(prediction.matchId)
      if (match && isPlaceholderMatch(match)) {
        const error = 'Jogo aguardando classificados. Este palpite ainda nao pode ser salvo.'
        set({ lastError: error })
        return { ok: false, error }
      }
      if (match && !isBetOpen(match)) {
        const error = 'Mercado fechado ou bloqueado. Este palpite nao foi salvo.'
        set({ lastError: error })
        return { ok: false, error }
      }

      const userId = get()._userId
      let savedPrediction = prediction

      if (!isMockMode) {
        if (!userId) {
          const error = 'Sessao indisponivel. Entre novamente para salvar o palpite.'
          set({ lastError: error })
          return { ok: false, error }
        }

        try {
          savedPrediction = await savePredictionFallback(userId, prediction)
        } catch (err) {
          const error = err instanceof Error ? err.message : String(err)
          console.error('[Predictions] Save error:', error)
          set({ lastError: error })
          return { ok: false, error }
        }
      }

      set((s) => {
        const predictions = { ...s.predictions, [savedPrediction.matchId]: savedPrediction }
        const drafts = { ...s.drafts }
        delete drafts[savedPrediction.matchId]
        return { predictions, drafts, lastError: null }
      })

      return { ok: true }
    },

    confirmPredictionBatch: async (items) => {
      const userId = get()._userId
      const submittedAt = new Date().toISOString()
      const pickable = items.filter(item => !isPlaceholderMatch(item.match) && isBetOpen(item.match))
      const skipped = items.length - pickable.length

      if (!pickable.length) {
        const error = 'Nenhuma partida aberta para salvar nesta fase.'
        set({ lastError: error })
        return { ok: false, error, saved: 0, skipped }
      }

      if (!isMockMode && !userId) {
        const error = 'Sessao indisponivel. Entre novamente para salvar os palpites.'
        set({ lastError: error })
        return { ok: false, error, saved: 0, skipped }
      }

      const predictionsToSave = pickable.map(({ match, homeScore, awayScore }) => ({
        id:          `pred-${match.id}`,
        userId:      userId ?? 'me',
        matchId:     match.id,
        homeScore,
        awayScore,
        submittedAt,
      }))

      let saved = predictionsToSave

      if (!isMockMode && userId) {
        try {
          const payload = predictionsToSave.map(p => ({
            match_code: p.matchId,
            home_score: p.homeScore,
            away_score: p.awayScore,
            submitted_at: p.submittedAt,
          }))

          const { data, error } = await supabase.rpc('save_match_predictions', {
            p_predictions: payload,
          })

          if (error) {
            const isMissingRpc =
              error.code === 'PGRST202' ||
              error.message.toLowerCase().includes('save_match_predictions')
            if (!isMissingRpc) throw new Error(error.message)
            saved = await savePredictionBatchFallback(userId, predictionsToSave)
          } else {
            saved = ((data ?? []) as PredictionRow[]).map(toPrediction)
          }
        } catch (err) {
          const error = err instanceof Error ? err.message : String(err)
          console.error('[Predictions] Batch save error:', error)
          set({ lastError: error })
          return { ok: false, error, saved: 0, skipped }
        }
      }

      set((s) => {
        const predictions = { ...s.predictions }
        const drafts = { ...s.drafts }
        for (const prediction of saved) {
          predictions[prediction.matchId] = prediction
          delete drafts[prediction.matchId]
        }
        return { predictions, drafts, lastError: null }
      })

      return { ok: true, saved: saved.length, skipped }
    },

    removePrediction: (matchId) =>
      set((s) => {
        const predictions = { ...s.predictions }
        delete predictions[matchId]
        return { predictions }
      }),

    resetLocalPredictionState: () => {
      set({ predictions: {}, drafts: {}, championPick: null, vicePick: null, scorerPick: null, lastError: null })
      useBracketStore.getState().clearAllPicks()
    },

    deleteUserPredictionsExplicitly: async () => {
      get().resetLocalPredictionState()
      const userId = get()._userId
      if (!isMockMode && userId) {
        const [{ error: predErr }, { error: bracketErr }, { error: userErr }] = await Promise.all([
          supabase.from('predictions').delete().eq('user_id', userId),
          supabase.from('bracket_picks').delete().eq('user_id', userId),
          supabase.from('users').update({ champion_pick: null, vice_pick: null, scorer_pick: null }).eq('id', userId),
        ])
        if (predErr)    console.error('[clearPredictions] predictions:', predErr.message)
        if (bracketErr) console.error('[clearPredictions] bracket_picks:', bracketErr.message)
        if (userErr)    console.error('[clearPredictions] users:', userErr.message)
      }
    },

    clearAllPredictions: async () => {
      await get().deleteUserPredictionsExplicitly()
    },

    clearError: () => set({ lastError: null }),

    getPrediction: (matchId) => get().predictions[matchId],
    getDraft: (matchId) => get().drafts[matchId],

    // M2: apostas especiais agora confirmam na UI SOMENTE após a RPC responder
    // ok (espelha confirmPrediction). Em falha, a escolha NÃO é aplicada e o erro
    // aparece em lastError — nada de "salvo" falso.
    setChampionPick: async (teamCode) => {
      const value = teamCode || null
      const validation = validateChampionVice(value, get().vicePick)
      if (!validation.valid) {
        set({ lastError: validation.error })
        return
      }
      const uid = get()._userId
      if (isMockMode || !uid) {
        set({ championPick: value, lastError: null })
        return
      }
      set({ savingGeneral: true, lastError: null })
      try {
        await saveGeneralPicks(value, get().vicePick, get().scorerPick)
        set({ championPick: value, savingGeneral: false, lastError: null })
      } catch (error) {
        set({ savingGeneral: false, lastError: (error as Error).message })
      }
    },

    setVicePick: async (teamCode) => {
      const value = teamCode || null
      const validation = validateChampionVice(get().championPick, value)
      if (!validation.valid) {
        set({ lastError: validation.error })
        return
      }
      const uid = get()._userId
      if (isMockMode || !uid) {
        set({ vicePick: value, lastError: null })
        return
      }
      set({ savingGeneral: true, lastError: null })
      try {
        await saveGeneralPicks(get().championPick, value, get().scorerPick)
        set({ vicePick: value, savingGeneral: false, lastError: null })
      } catch (error) {
        set({ savingGeneral: false, lastError: (error as Error).message })
      }
    },

    setScorerPick: async (playerName) => {
      const value = playerName || null
      const uid = get()._userId
      if (isMockMode || !uid) {
        set({ scorerPick: value, lastError: null })
        return
      }
      set({ savingGeneral: true, lastError: null })
      try {
        await saveGeneralPicks(get().championPick, get().vicePick, value)
        set({ scorerPick: value, savingGeneral: false, lastError: null })
      } catch (error) {
        set({ savingGeneral: false, lastError: (error as Error).message })
      }
    },
  })
)
