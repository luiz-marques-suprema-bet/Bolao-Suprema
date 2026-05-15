import { supabase, isMockMode } from '@/lib/supabase'
import type { RankingEntry, Mov } from '@/types'

export async function fetchRanking(myUserId?: string): Promise<RankingEntry[]> {
  if (isMockMode) return []

  const { data: users } = await supabase
    .from('users')
    .select('id, first_name, last_name, dept, initials, color, avatar_url, participant_status, privacy_hide_profile')
    .eq('participant_status', 'active')
    .order('created_at', { ascending: true })

  if (!users?.length) return []

  const { data: pts } = await supabase
    .from('predictions')
    .select('user_id, points_earned')

  const pointsMap: Record<string, number> = {}
  const correctMap: Record<string, number> = {}
  const exactMap:   Record<string, number> = {}

  for (const row of pts ?? []) {
    if (!row.user_id) continue
    const p = row.points_earned ?? 0
    pointsMap[row.user_id] = (pointsMap[row.user_id] ?? 0) + p
    if (p >= 3) correctMap[row.user_id] = (correctMap[row.user_id] ?? 0) + 1
    if (p >= 10) exactMap[row.user_id]  = (exactMap[row.user_id]   ?? 0) + 1
  }

  const uniqueUsers = Array.from(new Map(users.map(u => [u.id, u])).values())
    .filter(u => !u.privacy_hide_profile || u.id === myUserId)

  return uniqueUsers
    .map(u => ({
      userId:   u.id,
      name:     `${u.first_name} ${u.last_name}`.trim(),
      dept:     u.dept ?? '',
      initials: u.initials ?? '?',
      color:    u.color ?? '#777',
      pts:      pointsMap[u.id] ?? 0,
      correct:  correctMap[u.id] ?? 0,
      exact:    exactMap[u.id]   ?? 0,
      streak:   0,
      mov:      '—' as Mov,
      isYou:    u.id === myUserId,
    }))
    .sort((a, b) => b.pts - a.pts)
    .map((u, i) => ({ ...u, rank: i + 1 }))
}
