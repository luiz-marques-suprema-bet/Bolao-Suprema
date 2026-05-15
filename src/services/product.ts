import { supabase, isMockMode } from '@/lib/supabase'
import type {
  AppUser,
  AuditAction,
  Invite,
  MarketStatus,
  Notification,
  ParticipantStatus,
  RankingBreakdown,
  RankingComputationResult,
  ScoringRule,
  SystemHealthStatus,
  UserRole,
  Prediction,
  BracketPick,
} from '@/types'

export interface ServiceResult<T> {
  data: T | null
  error: string | null
}

function ok<T>(data: T): ServiceResult<T> {
  return { data, error: null }
}

function fail<T>(error: unknown): ServiceResult<T> {
  return { data: null, error: error instanceof Error ? error.message : String(error) }
}

export function requireSupabase(): string | null {
  return isMockMode ? 'Supabase nao esta configurado. Esta acao exige persistencia real.' : null
}

export function sanitizeText(value: string, max = 1000): string {
  return value
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/[<>]/g, '')
    .trim()
    .slice(0, max)
}

export async function logAudit(action: AuditAction, entityType: string, entityId?: string, before?: unknown, after?: unknown) {
  console.warn('[Audit] Direct client audit is disabled; use audited RPCs for sensitive actions.', {
    action,
    entityType,
    entityId,
    before,
    after,
  })
}

export async function savePrediction(matchCode: string, homeScore: number, awayScore: number): Promise<ServiceResult<Prediction>> {
  const blocked = requireSupabase()
  if (blocked) return fail(blocked)
  const { data, error } = await supabase.rpc('save_prediction', {
    p_match_code: matchCode,
    p_home_score: homeScore,
    p_away_score: awayScore,
  })
  if (error) return fail(error.message)
  return ok({
    id: data.id,
    userId: data.user_id,
    matchId: data.match_code,
    homeScore: data.home_score,
    awayScore: data.away_score,
    submittedAt: data.submitted_at,
    pointsEarned: data.points_earned ?? undefined,
  })
}

export async function saveGeneralPicks(champion: string | null, vice: string | null, scorer: string | null) {
  const blocked = requireSupabase()
  if (blocked) return fail<AppUser>(blocked)
  const { data, error } = await supabase.rpc('save_general_picks', {
    p_champion: champion ?? '',
    p_vice: vice ?? '',
    p_scorer: scorer ?? '',
  })
  if (error) return fail(error.message)
  return ok(data as AppUser)
}

export async function saveBracketPick(slotId: string, round: string, winner: string): Promise<ServiceResult<BracketPick>> {
  const blocked = requireSupabase()
  if (blocked) return fail(blocked)
  const { data, error } = await supabase.rpc('save_bracket_pick', {
    p_slot_id: slotId,
    p_round: round,
    p_winner: winner,
  })
  if (error) return fail(error.message)
  return ok({
    id: data.id,
    userId: data.user_id,
    slotId: data.slot_id,
    round: data.round,
    pickedWinner: data.picked_winner,
    lockedAt: data.locked_at,
    isCorrect: data.is_correct ?? undefined,
  })
}

export async function deleteBracketPick(slotId: string) {
  const blocked = requireSupabase()
  if (blocked) return fail(blocked)
  const { error } = await supabase.rpc('delete_bracket_pick', { p_slot_id: slotId })
  if (error) return fail(error.message)
  return ok(true)
}

export async function setMarketStatus(matchCode: string, status: MarketStatus, reason?: string) {
  const blocked = requireSupabase()
  if (blocked) return fail(blocked)
  const { data, error } = await supabase.rpc('set_match_market_status', {
    p_match_code: matchCode,
    p_market_status: status,
    p_reason: reason ?? null,
  })
  if (error) return fail(error.message)
  return ok(data)
}

export async function settleMatchResult(matchCode: string, homeScore: number, awayScore: number) {
  const blocked = requireSupabase()
  if (blocked) return fail(blocked)
  const { data, error } = await supabase.rpc('settle_match_result', {
    p_match_code: matchCode,
    p_home_score: homeScore,
    p_away_score: awayScore,
  })
  if (error) return fail(error.message)
  return ok(data)
}

export async function updateParticipantStatus(userId: string, status: ParticipantStatus) {
  const blocked = requireSupabase()
  if (blocked) return fail<AppUser>(blocked)
  const { data, error } = await supabase.rpc('update_participant_status', {
    p_user_id: userId,
    p_status: status,
  })
  if (error) return fail(error.message)
  return ok(data as AppUser)
}

export async function fetchParticipants() {
  if (isMockMode) return ok([])
  const { data, error } = await supabase
    .from('users')
    .select('id,email,first_name,last_name,dept,initials,color,avatar_url,is_admin,is_marketing,is_owner,user_role,participant_status,created_at,approved_at,blocked_at,removed_at')
    .order('created_at', { ascending: false })
  if (error) return fail(error.message)
  return ok(data ?? [])
}

export async function fetchScoringRules(): Promise<ServiceResult<ScoringRule[]>> {
  if (isMockMode) return ok([])
  const { data, error } = await supabase
    .from('scoring_rules')
    .select('id,label,category,stage,points,sort_order,is_active,updated_at')
    .order('sort_order')
  if (error) return fail(error.message)
  return ok((data ?? []).map(row => ({
    id: row.id,
    label: row.label,
    category: row.category,
    stage: row.stage,
    points: row.points,
    sortOrder: row.sort_order,
    isActive: row.is_active,
    updatedAt: row.updated_at,
  })))
}

export async function saveScoringRule(rule: ScoringRule) {
  const blocked = requireSupabase()
  if (blocked) return fail(blocked)
  const { data, error } = await supabase.rpc('save_scoring_rule', {
    p_id: rule.id,
    p_label: rule.label,
    p_category: rule.category,
    p_stage: rule.stage,
    p_points: rule.points,
    p_sort_order: rule.sortOrder,
    p_is_active: rule.isActive,
  })
  if (error) return fail(error.message)
  return ok({
    id: data.id,
    label: data.label,
    category: data.category,
    stage: data.stage,
    points: data.points,
    sortOrder: data.sort_order,
    isActive: data.is_active,
    updatedAt: data.updated_at,
  })
}

export async function refreshRanking(): Promise<ServiceResult<RankingComputationResult>> {
  const blocked = requireSupabase()
  if (blocked) return fail(blocked)
  const { error } = await supabase.rpc('refresh_ranking_snapshots')
  if (error) return fail(error.message)
  return ok({ ok: true, refreshedAt: new Date().toISOString() })
}

export async function fetchRankingBreakdown(userId: string): Promise<ServiceResult<RankingBreakdown[]>> {
  if (isMockMode) return ok([])
  const { data, error } = await supabase
    .from('ranking_breakdowns')
    .select('id,user_id,source_type,source_id,label,points,details,calculated_at')
    .eq('user_id', userId)
    .order('calculated_at', { ascending: false })
  if (error) return fail(error.message)
  return ok((data ?? []).map(row => ({
    id: row.id,
    userId: row.user_id,
    sourceType: row.source_type,
    sourceId: row.source_id,
    label: row.label,
    points: row.points,
    details: row.details ?? {},
    calculatedAt: row.calculated_at,
  })))
}

export async function fetchSystemHealth(): Promise<ServiceResult<SystemHealthStatus>> {
  if (isMockMode) return fail('Supabase nao configurado.')
  const { data, error } = await supabase.from('system_health').select('*').single()
  if (error) return fail(error.message)
  return ok({
    usersTotal: data.users_total ?? 0,
    usersPending: data.users_pending ?? 0,
    predictionsTotal: data.predictions_total ?? 0,
    chatMessagesTotal: data.chat_messages_total ?? 0,
    bulletinsTotal: data.bulletins_total ?? 0,
    marketsOpen: data.markets_open ?? 0,
    marketsLocked: data.markets_locked ?? 0,
    matchesWithoutKickoff: data.matches_without_kickoff ?? 0,
    lastRankingRefresh: data.last_ranking_refresh,
  })
}

export async function fetchAuditLogs(limit = 100) {
  if (isMockMode) return ok([])
  const { data, error } = await supabase
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) return fail(error.message)
  return ok(data ?? [])
}

export async function fetchInvites(): Promise<ServiceResult<Invite[]>> {
  if (isMockMode) return ok([])
  const { data, error } = await supabase.from('participant_invites').select('*').order('created_at', { ascending: false })
  if (error) return fail(error.message)
  return ok((data ?? []).map(row => ({
    id: row.id,
    code: row.code,
    label: row.label,
    createdBy: row.created_by,
    maxUses: row.max_uses,
    usedCount: row.used_count,
    expiresAt: row.expires_at,
    isActive: row.is_active,
    createdAt: row.created_at,
  })))
}

export async function createInvite(label = 'Convite Bolao Suprema') {
  const blocked = requireSupabase()
  if (blocked) return fail<Invite>(blocked)
  const { data, error } = await supabase.rpc('create_participant_invite', {
    p_label: label,
    p_max_uses: null,
    p_expires_at: null,
  })
  if (error) return fail(error.message)
  return ok({
    id: data.id,
    code: data.code,
    label: data.label,
    createdBy: data.created_by,
    maxUses: data.max_uses,
    usedCount: data.used_count,
    expiresAt: data.expires_at,
    isActive: data.is_active,
    createdAt: data.created_at,
  })
}

export async function fetchNotifications(userId: string): Promise<ServiceResult<Notification[]>> {
  if (isMockMode) return ok([])
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .or(`user_id.eq.${userId},user_id.is.null`)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) return fail(error.message)
  return ok((data ?? []).map(row => ({
    id: row.id,
    userId: row.user_id,
    channel: row.channel,
    type: row.type,
    title: row.title,
    body: row.body,
    entityType: row.entity_type,
    entityId: row.entity_id,
    readAt: row.read_at,
    createdAt: row.created_at,
  })))
}

export async function markNotificationRead(notificationId: string) {
  const blocked = requireSupabase()
  if (blocked) return fail(blocked)
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId)
  if (error) return fail(error.message)
  return ok(true)
}

export function downloadCsv(filename: string, rows: Array<Record<string, unknown>>) {
  const headers = Array.from(rows.reduce((set, row) => {
    Object.keys(row).forEach(key => set.add(key))
    return set
  }, new Set<string>()))
  const csv = [
    headers.join(','),
    ...rows.map(row => headers.map(h => JSON.stringify(row[h] ?? '')).join(',')),
  ].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export type RolePatch = Partial<{
  user_role: UserRole
  is_admin: boolean
  is_marketing: boolean
  is_owner: boolean
}>
