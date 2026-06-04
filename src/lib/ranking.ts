import { supabase, isMockMode } from '@/lib/supabase'
import type { RankingEntry, Mov } from '@/types'
import { POINT_RULES } from '@/types'
import { WC2026_MATCHES } from '@/data/wc2026'

// M8: o ranking é calculado no cliente a partir de predictions.points_earned —
// esta é a fonte de verdade da UI (ranking_snapshots no banco serve para
// auditoria/histórico e não é lido aqui). Os limiares de "acerto" e "cravada"
// derivam de POINT_RULES (mesma tabela de regras do app) e são SENSÍVEIS À FASE:
// cravada de grupo = 10 pts, cravada de mata-mata = 12 pts.
const pointsFor = (id: string) => POINT_RULES.find(r => r.id === id)?.points ?? 0
const GROUP_EXACT = pointsFor('group_exact')   // 10
const KO_EXACT = pointsFor('ko_exact')         // 12
const GROUP_RESULT = pointsFor('group_result') // 5 — acertou ao menos o resultado
const KO_RESULT = pointsFor('ko_result')       // 5

const STAGE_BY_CODE: Record<string, string> = Object.fromEntries(
  WC2026_MATCHES.map(m => [m.id, m.stage]),
)

type CurrentRankingRow = {
  rank: number
  user_id: string
  first_name: string
  last_name: string
  dept: string | null
  initials: string | null
  color: string | null
  avatar_url: string | null
  participant_status: string | null
  privacy_hide_profile: boolean | null
  pts: number | null
  mov: string | null
  correct: number | null
  exact_score: number | null
  streak: number | null
  match_points: number | null
  special_points: number | null
  knockout_points: number | null
  final_exact: boolean | null
  scorer_tiebreak_goals: number | null
  scorer_pick_hit: boolean | null
  first_prediction_at: string | null
  snapshot_at: string | null
}

function toRankingEntry(row: CurrentRankingRow, myUserId?: string): RankingEntry {
  return {
    rank: row.rank,
    userId: row.user_id,
    name: `${row.first_name} ${row.last_name}`.trim(),
    dept: row.dept ?? '',
    initials: row.initials ?? '?',
    color: row.color ?? '#777',
    avatarUrl: row.avatar_url ?? undefined,
    pts: row.pts ?? 0,
    correct: row.correct ?? 0,
    exact: row.exact_score ?? 0,
    streak: row.streak ?? 0,
    mov: (row.mov as Mov | null) ?? '—',
    matchPoints: row.match_points ?? 0,
    specialPoints: row.special_points ?? 0,
    knockoutPoints: row.knockout_points ?? 0,
    finalExact: row.final_exact ?? false,
    scorerTiebreakGoals: row.scorer_tiebreak_goals ?? 0,
    scorerPickHit: row.scorer_pick_hit ?? false,
    firstPredictionAt: row.first_prediction_at,
    snapshotAt: row.snapshot_at ?? undefined,
    isYou: row.user_id === myUserId,
  }
}

async function fetchRankingFromSnapshots(myUserId?: string): Promise<RankingEntry[]> {
  const { data, error } = await supabase
    .from('current_ranking')
    .select('rank,user_id,first_name,last_name,dept,initials,color,avatar_url,participant_status,privacy_hide_profile,pts,mov,correct,exact_score,streak,match_points,special_points,knockout_points,final_exact,scorer_tiebreak_goals,scorer_pick_hit,first_prediction_at,snapshot_at')
    .order('rank', { ascending: true })

  if (error) throw new Error(error.message)

  return ((data ?? []) as CurrentRankingRow[])
    .filter(row => row.participant_status === 'active')
    .filter(row => !row.privacy_hide_profile || row.user_id === myUserId)
    .map(row => toRankingEntry(row, myUserId))
}

async function fetchRankingFromPredictions(myUserId?: string): Promise<RankingEntry[]> {
  if (isMockMode) return []

  const { data: users } = await supabase
    .from('users')
    .select('id, first_name, last_name, dept, initials, color, avatar_url, participant_status, privacy_hide_profile')
    .order('created_at', { ascending: true })

  if (!users?.length) return []

  const { data: pts } = await supabase
    .from('predictions')
    .select('user_id, match_code, points_earned')

  const pointsMap: Record<string, number> = {}
  const correctMap: Record<string, number> = {}
  const exactMap:   Record<string, number> = {}

  for (const row of pts ?? []) {
    if (!row.user_id) continue
    const p = row.points_earned ?? 0
    pointsMap[row.user_id] = (pointsMap[row.user_id] ?? 0) + p
    const isGroup = STAGE_BY_CODE[row.match_code] === 'group'
    const exactPts = isGroup ? GROUP_EXACT : KO_EXACT
    const resultPts = isGroup ? GROUP_RESULT : KO_RESULT
    if (p >= resultPts) correctMap[row.user_id] = (correctMap[row.user_id] ?? 0) + 1
    if (p === exactPts)  exactMap[row.user_id]   = (exactMap[row.user_id]   ?? 0) + 1
  }

  const uniqueUsers = Array.from(new Map(users.map(u => [u.id, u])).values())
    .filter(u => u.participant_status === 'active')
    .filter(u => u.first_name?.trim())   // hide users who never completed profile
    .filter(u => !u.privacy_hide_profile || u.id === myUserId)

  return uniqueUsers
    .map(u => ({
      userId:    u.id,
      name:      `${u.first_name} ${u.last_name}`.trim(),
      dept:      u.dept ?? '',
      initials:  u.initials ?? '?',
      color:     u.color ?? '#777',
      avatarUrl: u.avatar_url ?? undefined,
      pts:       pointsMap[u.id] ?? 0,
      correct:   correctMap[u.id] ?? 0,
      exact:     exactMap[u.id]   ?? 0,
      streak:    0,
      mov:       '—' as Mov,
      isYou:     u.id === myUserId,
    }))
    .sort((a, b) => b.pts - a.pts || b.exact - a.exact || b.correct - a.correct)
    .map((u, i) => ({ ...u, rank: i + 1 }))
}

export async function fetchRanking(myUserId?: string): Promise<RankingEntry[]> {
  if (isMockMode) return []

  try {
    return await fetchRankingFromSnapshots(myUserId)
  } catch (error) {
    console.warn('[Ranking] current_ranking indisponivel; usando fallback local.', error)
    return fetchRankingFromPredictions(myUserId)
  }
}

export function subscribeRankingUpdates(onChange: () => void): () => void {
  if (isMockMode) return () => {}

  const channel = supabase
    .channel(`ranking-live-${Date.now()}-${Math.random().toString(16).slice(2)}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'ranking_snapshots' },
      onChange,
    )
    .subscribe()

  return () => {
    void supabase.removeChannel(channel)
  }
}
