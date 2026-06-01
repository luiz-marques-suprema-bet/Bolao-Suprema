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

export async function fetchRanking(myUserId?: string): Promise<RankingEntry[]> {
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
