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
  if (isMockMode) return
  await supabase.rpc('log_audit', {
    p_action: action,
    p_entity_type: entityType,
    p_entity_id: entityId ?? null,
    p_before: before ?? null,
    p_after: after ?? null,
  })
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

export async function adminUpdateMatchStatus(
  matchCode: string,
  status: string,
  opts?: { homeScore?: number; awayScore?: number; liveMinute?: string; winner?: string; lockReason?: string }
) {
  const blocked = requireSupabase()
  if (blocked) return fail(blocked)
  const { error } = await supabase.rpc('admin_update_match_status', {
    p_match_code:  matchCode,
    p_status:      status,
    p_home_score:  opts?.homeScore  ?? null,
    p_away_score:  opts?.awayScore  ?? null,
    p_live_minute: opts?.liveMinute ?? null,
    p_winner:      opts?.winner     ?? null,
    p_lock_reason: opts?.lockReason ?? null,
  })
  if (error) return fail(error.message)
  return ok(null)
}

export async function adminBulkMatchStatus(
  status: string,
  fromStatuses: string[],
  matchCodes?: string[],
  lockReason?: string
) {
  const blocked = requireSupabase()
  if (blocked) return fail(blocked)
  const { data, error } = await supabase.rpc('admin_bulk_match_status', {
    p_status:        status,
    p_from_statuses: fromStatuses,
    p_match_codes:   matchCodes ?? null,
    p_lock_reason:   lockReason ?? null,
  })
  if (error) return fail(error.message)
  return ok(data as number)
}

export async function adminDeletePrediction(predictionId: string) {
  const blocked = requireSupabase()
  if (blocked) return fail(blocked)
  const { error } = await supabase.rpc('admin_delete_prediction', {
    p_prediction_id: predictionId,
  })
  if (error) return fail(error.message)
  return ok(null)
}

export async function adminUpdatePrediction(predictionId: string, homeScore: number, awayScore: number) {
  const blocked = requireSupabase()
  if (blocked) return fail(blocked)
  const { error } = await supabase.rpc('admin_update_prediction', {
    p_prediction_id: predictionId,
    p_home_score: homeScore,
    p_away_score: awayScore,
  })
  if (error) return fail(error.message)
  return ok(null)
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
  const { error } = await supabase.from('scoring_rules').upsert({
    id: rule.id,
    label: rule.label,
    category: rule.category,
    stage: rule.stage,
    points: rule.points,
    sort_order: rule.sortOrder,
    is_active: rule.isActive,
    updated_at: new Date().toISOString(),
  })
  if (error) return fail(error.message)
  await logAudit('scoring_rule_updated', 'scoring_rule', rule.id, null, rule)
  return ok(rule)
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
  const code = crypto.randomUUID().slice(0, 8).toUpperCase()
  const { data: userData } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('participant_invites')
    .insert({ code, label, created_by: userData.user?.id ?? null })
    .select()
    .single()
  if (error) return fail(error.message)
  await logAudit('invite_created', 'invite', data.id, null, data)
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

// Escapa uma célula de CSV: aspas/vírgula/;/quebra de linha viram campo entre
// aspas; prefixo defensivo contra injeção de fórmula no Excel (=,+,-,@).
function csvCell(value: unknown): string {
  if (value == null) return ''
  const s = String(value)
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s
  return /[",;\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

export function downloadCsv(filename: string, rows: Array<Record<string, unknown>>) {
  const headers = Array.from(rows.reduce((set, row) => {
    Object.keys(row).forEach(key => set.add(key))
    return set
  }, new Set<string>()))
  const lines = [
    headers.map(csvCell).join(','),
    ...rows.map(row => headers.map(h => csvCell(row[h])).join(',')),
  ]
  // BOM (﻿) → Excel lê como UTF-8 e os acentos não viram mojibake. CRLF p/ Excel.
  const csv = '﻿' + lines.join('\r\n')
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

export async function adminSetUserRole(
  userId: string,
  patch: { isAdmin?: boolean; isMarketing?: boolean }
) {
  const blocked = requireSupabase()
  if (blocked) return fail(blocked)
  const { error } = await supabase.rpc('admin_set_user_role', {
    p_user_id:      userId,
    p_is_admin:     patch.isAdmin     ?? null,
    p_is_marketing: patch.isMarketing ?? null,
  })
  if (error) return fail(error.message)
  return ok(null)
}
