import { useState, useEffect, useCallback } from 'react'
import { Eyebrow } from '@/components/shared/Eyebrow'
import { Flag } from '@/components/shared/Flag'
import { useAuthStore } from '@/stores/auth.store'
import { useMatchStore } from '@/stores/match.store'
import { useIsDesktop } from '@/hooks/useBreakpoint'
import { WC2026_MATCHES, WC2026_GROUPS } from '@/data/wc2026'
import { TEAMS } from '@/data/teams'
import { POINT_RULES } from '@/types'
import { supabase, isMockMode } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { formatMatchDateTime } from '@/lib/matchTime'
import {
  downloadCsv,
  settleMatchResult,
  adminUpdateMatchStatus,
  adminBulkMatchStatus,
  adminDeletePrediction,
  adminSetUserRole,
} from '@/services/product'
import { Tooltip } from '@/components/shared/Tooltip'
import type { MarketStatus, MatchStatus, MatchStage } from '@/types'

function marketStatusFor(status: MatchStatus): MarketStatus {
  if (status === 'locked') return 'locked'
  if (status === 'finished') return 'settled'
  if (status === 'live') return 'closed'
  return 'open'
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function useToast() {
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const show = useCallback((text: string, ok = true) => {
    setMsg({ text, ok })
    setTimeout(() => setMsg(null), 4000)
  }, [])
  return { msg, show }
}

// ─── KPIs ─────────────────────────────────────────────────────────────────────

interface KpiData {
  totalUsers: number
  totalPredictions: number
  avgPredictionsPerUser: number
  matchesOpen: number
  matchesFinished: number
  matchesScheduled: number
}

async function fetchKpis(): Promise<KpiData> {
  const [usersRes, predsRes, matchesRes] = await Promise.all([
    supabase.from('users').select('id', { count: 'exact', head: true }),
    supabase.from('predictions').select('user_id', { count: 'exact', head: true }),
    supabase.from('matches').select('status'),
  ])
  const totalUsers = usersRes.count ?? 0
  const totalPredictions = predsRes.count ?? 0
  const matchRows = (matchesRes.data ?? []) as { status: string }[]
  return {
    totalUsers,
    totalPredictions,
    avgPredictionsPerUser: totalUsers > 0 ? Math.round(totalPredictions / totalUsers) : 0,
    matchesOpen: matchRows.filter(m => m.status === 'open').length,
    matchesFinished: matchRows.filter(m => m.status === 'finished').length,
    matchesScheduled: matchRows.filter(m => m.status === 'scheduled').length,
  }
}

// ─── Match action helpers ─────────────────────────────────────────────────────

async function updateMatchStatus(
  matchCode: string,
  status: MatchStatus,
  extra?: { homeScore?: number; awayScore?: number; liveMinute?: string; winner?: string; lockReason?: string }
) {
  const result = await adminUpdateMatchStatus(matchCode, status, extra)
  return result.error ? new Error(result.error) : null
}

async function setMatchResult(
  matchCode: string,
  homeScore: number,
  awayScore: number,
  _stage: MatchStage
): Promise<{ scored: number; error: string | null }> {
  // settle_match_result RPC handles: match update + server-side scoring
  // (via scoring_rules table) + ranking refresh + audit log + is_admin check
  const result = await settleMatchResult(matchCode, homeScore, awayScore)
  if (result.error) return { scored: 0, error: result.error }
  return { scored: 0, error: null }
}

// ─── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: MatchStatus | 'scheduled' }) {
  const cfg: Record<string, string> = {
    scheduled: 'bg-ink-4/20 text-ink-3',
    open:      'bg-green/20 text-green font-bold',
    locked:    'bg-yellow/40 text-ink font-bold',
    live:      'bg-red/20 text-red font-bold animate-pulse',
    finished:  'bg-paper-deep text-ink-4',
  }
  const labels: Record<string, string> = {
    scheduled: 'AGENDADO',
    open:      'ABERTO',
    locked:    'BLOQUEADO',
    live:      'AO VIVO',
    finished:  'ENCERRADO',
  }
  return (
    <span className={cn('font-mono text-[9px] px-2 py-0.5 uppercase', cfg[status] ?? cfg.scheduled)}>
      {labels[status] ?? status.toUpperCase()}
    </span>
  )
}

// ─── Match row ─────────────────────────────────────────────────────────────────

interface MatchRowAdminProps {
  matchCode: string
  homeCode: string
  awayCode: string
  dateStr: string
  group?: string
  currentStatus: MatchStatus
  currentHomeScore: number | null
  currentAwayScore: number | null
  stage: MatchStage
  onAction: (msg: string, ok: boolean) => void
}

function MatchRowAdmin({
  matchCode, homeCode, awayCode, dateStr, group, currentStatus,
  currentHomeScore, currentAwayScore, stage, onAction,
}: MatchRowAdminProps) {
  const applyOverride = useMatchStore(s => s.applyOverride)
  const [busy, setBusy] = useState(false)
  const [editResult, setEditResult] = useState(false)
  const [homeGoals, setHomeGoals] = useState(currentHomeScore ?? 0)
  const [awayGoals, setAwayGoals] = useState(currentAwayScore ?? 0)

  const homeTeam = TEAMS[homeCode]
  const awayTeam = TEAMS[awayCode]

  async function handleStatusChange(newStatus: MatchStatus) {
    if (isMockMode) { onAction('Mock mode: status não persiste', false); return }
    setBusy(true)
    const err = await updateMatchStatus(matchCode, newStatus)
    if (err) {
      onAction(`Erro: ${err.message}`, false)
    } else {
      applyOverride({ matchCode, status: newStatus, marketStatus: marketStatusFor(newStatus), homeScore: currentHomeScore, awayScore: currentAwayScore })
      onAction(`✓ Partida ${matchCode} → ${newStatus.toUpperCase()}`, true)
    }
    setBusy(false)
  }

  async function handleSetResult() {
    if (isMockMode) { onAction('Mock mode: resultado não persiste', false); return }
    setBusy(true)
    const { scored, error } = await setMatchResult(matchCode, homeGoals, awayGoals, stage)
    if (error) {
      onAction(`Erro: ${error}`, false)
    } else {
      applyOverride({ matchCode, status: 'finished', marketStatus: 'settled', homeScore: homeGoals, awayScore: awayGoals })
      onAction(`✓ Resultado registrado · ${scored} palpites pontuados`, true)
      setEditResult(false)
    }
    setBusy(false)
  }

  return (
    <div className="border-b border-hairline last:border-0">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <Flag team={homeTeam} size={18} />
          <span className="font-mono text-[11px] font-bold">{homeCode}</span>
          <span className="font-mono text-[9px] text-ink-4 mx-0.5">×</span>
          <span className="font-mono text-[11px] font-bold">{awayCode}</span>
          <Flag team={awayTeam} size={18} />
        </div>
        <div className="hidden sm:block text-right flex-shrink-0">
          {group && <div className="font-mono text-[9px] text-ink-4">GRUPO {group}</div>}
          <div className="font-mono text-[10px] text-ink-3">{dateStr}</div>
        </div>
        <div className="font-mono text-[13px] font-bold w-12 text-center flex-shrink-0">
          {currentStatus === 'finished' || currentStatus === 'live'
            ? `${currentHomeScore ?? 0}–${currentAwayScore ?? 0}`
            : '–'
          }
        </div>
        <StatusBadge status={currentStatus} />
        {!busy && (
          <div className="flex gap-1 flex-shrink-0 flex-wrap">
            {currentStatus === 'scheduled' && (
              <button onClick={() => handleStatusChange('open')} className="btn-ghost text-[9px] px-2 py-1">ABRIR</button>
            )}
            {currentStatus === 'open' && (
              <button onClick={() => handleStatusChange('locked')} className="btn-ghost text-[9px] px-2 py-1 border-yellow/60">BLOQUEAR</button>
            )}
            {currentStatus === 'locked' && (
              <button onClick={() => handleStatusChange('open')} className="btn-ghost text-[9px] px-2 py-1 border-green/60 text-green">REABRIR</button>
            )}
            {(currentStatus === 'locked' || currentStatus === 'live') && (
              <button onClick={() => setEditResult(v => !v)} className="btn-yellow text-[9px] px-2 py-1">RESULTADO</button>
            )}
            {currentStatus === 'finished' && (
              <button onClick={() => handleStatusChange('open')} className="btn-ghost text-[9px] px-2 py-1 border-green/60 text-green">REABRIR</button>
            )}
            {currentStatus === 'finished' && (
              <button onClick={() => setEditResult(v => !v)} className="btn-ghost text-[9px] px-2 py-1">CORRIGIR</button>
            )}
          </div>
        )}
        {busy && <span className="font-mono text-[9px] text-ink-4 animate-pulse">...</span>}
      </div>

      {editResult && (
        <div className="px-4 pb-3 bg-paper-deep border-t border-hairline flex items-center gap-3 flex-wrap">
          <span className="font-mono text-[9px] tracking-eyebrow text-ink-3">PLACAR FINAL:</span>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] font-bold">{homeCode}</span>
            <input type="number" min={0} max={20} value={homeGoals}
              onChange={e => setHomeGoals(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-12 border-2 border-ink text-center font-mono text-[14px] font-bold px-1 py-1 bg-yellow outline-none" />
            <span className="font-mono text-ink-4">×</span>
            <input type="number" min={0} max={20} value={awayGoals}
              onChange={e => setAwayGoals(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-12 border-2 border-ink text-center font-mono text-[14px] font-bold px-1 py-1 bg-yellow outline-none" />
            <span className="font-mono text-[11px] font-bold">{awayCode}</span>
          </div>
          <div className="flex gap-2 ml-auto">
            <button onClick={() => setEditResult(false)} className="btn-ghost text-[9px] px-2 py-1">CANCELAR</button>
            <button onClick={handleSetResult} disabled={busy} className="btn-yellow text-[9px] px-3 py-1 disabled:opacity-40">
              CONFIRMAR + PONTUAR →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Bulk actions ─────────────────────────────────────────────────────────────

async function openGroupMatches(groupCode: string, onAction: (msg: string, ok: boolean) => void) {
  if (isMockMode) { onAction('Mock mode: ação não persiste', false); return }
  const matchCodes = WC2026_MATCHES.filter(m => m.group === groupCode).map(m => m.id)
  const result = await adminBulkMatchStatus('open', ['scheduled'], matchCodes)
  if (result.error) onAction(`Erro: ${result.error}`, false)
  else onAction(`✓ Partidas do Grupo ${groupCode} abertas`, true)
}

async function lockAllOpenMatches(onAction: (msg: string, ok: boolean) => void) {
  if (isMockMode) { onAction('Mock mode: ação não persiste', false); return }
  const result = await adminBulkMatchStatus('locked', ['open'])
  if (result.error) onAction(`Erro: ${result.error}`, false)
  else onAction(`✓ ${result.data ?? 0} partidas → BLOQUEADAS`, true)
}

async function openAllMatches(onAction: (msg: string, ok: boolean) => void) {
  if (isMockMode) { onAction('Mock mode: ação não persiste', false); return }
  const result = await adminBulkMatchStatus('open', ['scheduled', 'locked'])
  if (result.error) onAction(`Erro: ${result.error}`, false)
  else onAction(`✓ ${result.data ?? 0} partidas → ABERTAS`, true)
}

// ─── Export CSV ───────────────────────────────────────────────────────────────

async function exportRankingCsv() {
  const { data: users } = await supabase.from('users').select('id, first_name, last_name, dept, email')
  const { data: pts } = await supabase.from('predictions').select('user_id, points_earned')
  if (!users || !pts) return
  const pointsMap: Record<string, number> = {}
  for (const p of pts) {
    pointsMap[p.user_id] = (pointsMap[p.user_id] ?? 0) + (p.points_earned ?? 0)
  }
  const rows = users
    .map(u => ({ nome: `${u.first_name} ${u.last_name}`.trim(), dept: u.dept, email: u.email, pontos: pointsMap[u.id] ?? 0 }))
    .sort((a, b) => b.pontos - a.pontos)
    .map((r, i) => `${i + 1},${r.nome},${r.dept},${r.email},${r.pontos}`)
  const csv = ['#,Nome,Departamento,Email,Pontos', ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `ranking-bolao-suprema-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ─── KPI card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub }: { label: string; value: number | string; sub: string }) {
  return (
    <div className="ui-card p-4">
      <div className="font-mono text-[9px] tracking-eyebrow text-ink-3 mb-1">{label}</div>
      <div className="font-display text-3xl leading-none">{value}</div>
      <div className="font-mono text-[10px] text-ink-4 mt-0.5">{sub}</div>
    </div>
  )
}

// ─── Participants Panel ────────────────────────────────────────────────────────

interface ParticipantRow {
  id: string
  first_name: string | null
  last_name: string | null
  dept: string | null
  email: string
  participant_status: string | null
}

interface PredRow {
  id: string
  match_code: string
  home_score: number | null
  away_score: number | null
  points_earned: number | null
}

function ParticipantsPanel({ onToast }: { onToast: (msg: string, ok: boolean) => void }) {
  const [participants, setParticipants] = useState<ParticipantRow[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)
  const [preds, setPreds] = useState<PredRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('users')
      .select('id,first_name,last_name,dept,email,participant_status')
      .order('first_name', { ascending: true })
    if (error) onToast(`Erro ao carregar participantes: ${error.message}`, false)
    setParticipants((data ?? []) as ParticipantRow[])
    setLoading(false)
  }, [onToast])

  useEffect(() => { if (!isMockMode) load() }, [load])

  async function toggleBlock(p: ParticipantRow) {
    setBusy(true)
    const newStatus = p.participant_status === 'blocked' ? 'active' : 'blocked'
    const { error } = await supabase.rpc('update_participant_status', { p_user_id: p.id, p_status: newStatus })
    if (error) { onToast(`Erro: ${error.message}`, false); setBusy(false); return }
    const name = [p.first_name, p.last_name].filter(Boolean).join(' ') || p.email
    onToast(`✓ ${name} → ${newStatus === 'blocked' ? 'BLOQUEADO' : 'DESBLOQUEADO'}`, true)
    await load()
    setBusy(false)
  }

  async function loadPreds(userId: string) {
    if (expanded === userId) { setExpanded(null); setPreds([]); return }
    const { data } = await supabase
      .from('predictions')
      .select('id,match_code,home_score,away_score,points_earned')
      .eq('user_id', userId)
      .order('match_code')
    setPreds((data ?? []) as PredRow[])
    setExpanded(userId)
  }

  async function undoPred(predId: string) {
    setBusy(true)
    const result = await adminDeletePrediction(predId)
    if (result.error) {
      onToast(`Erro ao desfazer palpite: ${result.error}`, false)
    } else {
      onToast('✓ Palpite removido', true)
      if (expanded) {
        const { data } = await supabase
          .from('predictions')
          .select('id,match_code,home_score,away_score,points_earned')
          .eq('user_id', expanded)
          .order('match_code')
        setPreds((data ?? []) as PredRow[])
      }
    }
    setBusy(false)
  }

  const total = participants.length
  const blocked = participants.filter(p => p.participant_status === 'blocked').length

  return (
    <section className="ui-panel mb-6">
      <div className="ui-panel-header flex items-center justify-between gap-3">
        <div>
          <div className="font-display text-xl">PARTICIPANTES</div>
          <div className="font-mono text-[9px] text-paper/50">{total} cadastrados · {blocked} bloqueados</div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => downloadCsv(`participantes-${Date.now()}.csv`, participants as unknown as Array<Record<string, unknown>>)}
            className="btn-ghost text-[9px]"
          >
            CSV ↓
          </button>
          <button disabled={busy || loading} onClick={load} className="btn-yellow text-[10px]">↺</button>
        </div>
      </div>

      {loading && (
        <div className="px-4 py-6 font-mono text-[11px] text-ink-4 text-center animate-pulse">CARREGANDO…</div>
      )}

      <div className="divide-y divide-hairline max-h-96 overflow-y-auto">
        {participants.map(p => {
          const name = [p.first_name, p.last_name].filter(Boolean).join(' ') || p.email
          const isBlocked = p.participant_status === 'blocked'
          const isOpen = expanded === p.id
          return (
            <div key={p.id}>
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-[11px] font-bold truncate">{name}</div>
                  <div className="font-mono text-[9px] text-ink-4 truncate">{p.dept || '—'}</div>
                </div>
                {isBlocked && (
                  <span className="font-mono text-[8px] bg-red/10 text-red px-2 py-0.5 flex-shrink-0 border border-red/30">
                    BLOQUEADO
                  </span>
                )}
                <div className="flex gap-1 flex-shrink-0">
                  <button
                    disabled={busy}
                    onClick={() => toggleBlock(p)}
                    className={cn(
                      'font-mono text-[8px] border px-2 py-1 transition-colors hover:bg-yellow',
                      isBlocked ? 'border-green/60 text-green' : 'border-red/40 text-red/80'
                    )}
                  >
                    {isBlocked ? 'DESBLOQUEAR' : 'BLOQUEAR'}
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => loadPreds(p.id)}
                    className="font-mono text-[8px] border border-hairline px-2 py-1 hover:bg-surface-hover transition-colors"
                  >
                    {isOpen ? '✕' : 'PALPITES'}
                  </button>
                </div>
              </div>

              {isOpen && (
                <div className="bg-paper-deep px-4 py-3 border-t border-hairline space-y-1.5">
                  {preds.length === 0 ? (
                    <div className="font-mono text-[10px] text-ink-4">Nenhum palpite encontrado.</div>
                  ) : (
                    preds.map(pred => (
                      <div key={pred.id} className="flex items-center justify-between gap-3">
                        <span className="font-mono text-[10px]">
                          <span className="font-bold">{pred.match_code}</span>
                          {' '}· {pred.home_score ?? '?'}×{pred.away_score ?? '?'}
                          {pred.points_earned != null && (
                            <span className="text-green ml-1">+{pred.points_earned}pts</span>
                          )}
                        </span>
                        <button
                          disabled={busy}
                          onClick={() => undoPred(pred.id)}
                          className="font-mono text-[8px] text-red border border-red/30 px-2 py-0.5 hover:bg-red/10 transition-colors flex-shrink-0"
                        >
                          DESFAZER
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

// ─── Notices Panel ────────────────────────────────────────────────────────────

interface NoticeRow {
  id: string
  title: string
  body: string | null
  created_at: string
}

function NoticesPanel({ onToast }: { onToast: (msg: string, ok: boolean) => void }) {
  const [notices, setNotices] = useState<NoticeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [title, setTitle]     = useState('')
  const [body, setBody]       = useState('')
  const [busy, setBusy]       = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('global_notices')
      .select('id,title,body,created_at')
      .order('created_at', { ascending: false })
    setNotices((data ?? []) as NoticeRow[])
    setLoading(false)
  }, [])

  useEffect(() => { if (!isMockMode) load() }, [load])

  async function post() {
    if (!title.trim()) return
    setBusy(true)
    const { error } = await supabase.from('global_notices').insert({ title: title.trim(), body: body.trim() || null })
    if (error) { onToast(`Erro: ${error.message}`, false) }
    else { onToast('✓ Aviso publicado', true); setTitle(''); setBody(''); await load() }
    setBusy(false)
  }

  async function remove(id: string) {
    setBusy(true)
    const { error } = await supabase.from('global_notices').delete().eq('id', id)
    if (error) { onToast(`Erro: ${error.message}`, false) }
    else { onToast('✓ Aviso removido', true); await load() }
    setBusy(false)
  }

  return (
    <section className="ui-panel mb-6">
      <div className="ui-panel-header flex items-center justify-between gap-3">
        <div>
          <div className="font-display text-xl">AVISOS GLOBAIS</div>
          <div className="font-mono text-[9px] text-paper/50">Aparecem na aba Avisos para todos</div>
        </div>
        <button disabled={busy || loading} onClick={load} className="btn-yellow text-[10px]">↺</button>
      </div>

      {/* New notice form */}
      <div className="px-4 py-4 border-b border-hairline space-y-2">
        <input
          value={title} onChange={e => setTitle(e.target.value)}
          placeholder="Título do aviso *"
          className="w-full bg-paper-deep border border-line px-3 py-2 font-sans text-[13px] outline-none focus:border-ink placeholder:text-ink-4"
        />
        <textarea
          value={body} onChange={e => setBody(e.target.value)}
          placeholder="Texto do aviso (opcional)"
          rows={2}
          className="w-full bg-paper-deep border border-line px-3 py-2 font-sans text-[13px] outline-none focus:border-ink placeholder:text-ink-4 resize-none"
        />
        <button
          disabled={!title.trim() || busy}
          onClick={post}
          className="btn-yellow text-[10px] disabled:opacity-40"
        >
          PUBLICAR AVISO
        </button>
      </div>

      {/* Existing notices */}
      {loading ? (
        <div className="px-4 py-4 font-mono text-[11px] text-ink-4 animate-pulse">CARREGANDO…</div>
      ) : notices.length === 0 ? (
        <div className="px-4 py-4 font-mono text-[11px] text-ink-4">Nenhum aviso publicado.</div>
      ) : (
        <div className="divide-y divide-hairline max-h-64 overflow-y-auto">
          {notices.map(n => (
            <div key={n.id} className="flex items-start gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <div className="font-mono text-[11px] font-bold truncate">{n.title}</div>
                {n.body && <div className="font-mono text-[10px] text-ink-3 mt-0.5 line-clamp-2">{n.body}</div>}
                <div className="font-mono text-[9px] text-ink-4 mt-1">
                  {new Date(n.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              <button
                disabled={busy}
                onClick={() => remove(n.id)}
                className="font-mono text-[8px] text-red border border-red/30 px-2 py-1 hover:bg-red/10 transition-colors flex-shrink-0 mt-1"
              >
                REMOVER
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

// ─── Roles Panel ─────────────────────────────────────────────────────────────

interface RoleUserRow {
  id: string
  first_name: string | null
  last_name: string | null
  email: string
  is_admin: boolean
  is_marketing: boolean
  is_owner: boolean
  user_role: string | null
  participant_status: string | null
}

function AdminRolesPanel({ onToast }: { onToast: (msg: string, ok: boolean) => void }) {
  const currentUser = useAuthStore(s => s.user)
  const isOwner = currentUser?.isOwner ?? false

  const [users, setUsers] = useState<RoleUserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('users')
      .select('id,first_name,last_name,email,is_admin,is_marketing,is_owner,user_role,participant_status')
      .order('first_name', { ascending: true })
    if (error) onToast(`Erro ao carregar usuários: ${error.message}`, false)
    setUsers(((data ?? []) as RoleUserRow[]).filter(u => u.email !== 'seu.email@suprema.group'))
    setLoading(false)
  }, [onToast])

  useEffect(() => { if (!isMockMode) load() }, [load])

  async function toggle(user: RoleUserRow, field: 'is_admin' | 'is_marketing') {
    if (!isOwner) { onToast('Apenas o proprietário pode alterar papéis.', false); return }
    setBusy(`${user.id}-${field}`)
    const newVal = !user[field]
    const patch = field === 'is_admin'
      ? { isAdmin: newVal }
      : { isMarketing: newVal }
    const result = await adminSetUserRole(user.id, patch)
    if (result.error) {
      onToast(`Erro: ${result.error}`, false)
    } else {
      const name = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email
      const label = field === 'is_admin' ? 'ADMIN' : 'MARKETING'
      onToast(`✓ ${name} → ${newVal ? label + ' CONCEDIDO' : label + ' REVOGADO'}`, true)
      await load()
    }
    setBusy(null)
  }

  const roleLabel = (u: RoleUserRow) => {
    if (u.is_owner)     return { text: 'OWNER',     cls: 'bg-yellow/30 text-ink border-yellow/50' }
    if (u.is_admin)     return { text: 'ADMIN',     cls: 'bg-red/10 text-red border-red/30' }
    if (u.is_marketing) return { text: 'MARKETING', cls: 'bg-green/10 text-green border-green/30' }
    return { text: 'USER', cls: 'bg-paper-deep text-ink-4 border-hairline' }
  }

  return (
    <section className="ui-panel mb-6">
      <div className="ui-panel-header flex items-center justify-between gap-3">
        <div>
          <div className="font-display text-xl">ATRIBUIÇÃO DE PAPÉIS</div>
          <div className="font-mono text-[9px] text-paper/50">
            {isOwner ? 'Clique em ADMIN ou MKT para conceder/revogar' : 'Somente o proprietário pode alterar papéis'}
          </div>
        </div>
        <button disabled={loading} onClick={load} className="btn-yellow text-[10px]">↺</button>
      </div>

      {loading ? (
        <div className="px-4 py-6 font-mono text-[11px] text-ink-4 text-center animate-pulse">CARREGANDO…</div>
      ) : (
        <div className="divide-y divide-hairline max-h-96 overflow-y-auto">
          {users.map(u => {
            const name = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email
            const role = roleLabel(u)
            const isSelf = u.id === currentUser?.id
            const isProtected = u.is_owner || isSelf

            return (
              <div key={u.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center">
                <div className="w-full min-w-0 sm:flex-1">
                  <div className="font-mono text-[11px] font-bold truncate">
                    {name}
                    {isSelf && <span className="ml-1.5 text-ink-4 font-normal">(você)</span>}
                  </div>
                  <div className="font-mono text-[9px] text-ink-4 truncate">{u.email}</div>
                </div>

                <span className={cn('w-fit font-mono text-[8px] px-2 py-0.5 border flex-shrink-0', role.cls)}>
                  {role.text}
                </span>

                {!isProtected && isOwner && (
                  <div className="grid grid-cols-2 gap-1 sm:flex sm:flex-shrink-0">
                    <button
                      disabled={busy !== null}
                      onClick={() => toggle(u, 'is_admin')}
                      className={cn(
                        'font-mono text-[8px] border px-2 py-1 transition-colors',
                        u.is_admin
                          ? 'border-red/40 text-red/80 hover:bg-red/10'
                          : 'border-ink-4/40 text-ink-3 hover:bg-yellow'
                      )}
                    >
                      {busy === `${u.id}-is_admin` ? '…' : u.is_admin ? '− ADMIN' : '+ ADMIN'}
                    </button>
                    <button
                      disabled={busy !== null}
                      onClick={() => toggle(u, 'is_marketing')}
                      className={cn(
                        'font-mono text-[8px] border px-2 py-1 transition-colors',
                        u.is_marketing
                          ? 'border-green/40 text-green hover:bg-green/10'
                          : 'border-ink-4/40 text-ink-3 hover:bg-yellow'
                      )}
                    >
                      {busy === `${u.id}-is_marketing` ? '…' : u.is_marketing ? '− MKT' : '+ MKT'}
                    </button>
                  </div>
                )}

                {isProtected && (
                  <span className="font-mono text-[8px] text-ink-4 flex-shrink-0">
                    {u.is_owner ? 'proprietário' : 'você'}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export function AdminScreen() {
  const user = useAuthStore(s => s.user)
  const isDesktop = useIsDesktop()

  if (!user?.isAdmin) {
    return (
      <div className="flex h-dvh items-center justify-center bg-paper flex-col gap-4">
        <span className="font-display text-4xl">✗</span>
        <p className="font-mono text-[12px] tracking-eyebrow text-ink-3">ACESSO RESTRITO · SOMENTE ADMIN</p>
      </div>
    )
  }

  return isDesktop ? <AdminDesktop /> : <AdminMobile />
}

// ─── Shared hook ─────────────────────────────────────────────────────────────

function useAdminData() {
  const { overrides, init } = useMatchStore()
  const [kpis, setKpis] = useState<KpiData | null>(null)
  const [filter, setFilter] = useState<'all' | 'scheduled' | 'open' | 'locked' | 'finished'>('all')
  const [selectedGroup, setSelectedGroup] = useState<string>('all')
  const { msg: toast, show: showToast } = useToast()

  useEffect(() => { init() }, [init])
  useEffect(() => {
    if (!isMockMode) fetchKpis().then(setKpis)
  }, [])

  const allMatches = WC2026_MATCHES.map(m => {
    const ov = overrides[m.id]
    if (!ov) return m
    return { ...m, status: ov.status, homeScore: ov.homeScore, awayScore: ov.awayScore }
  })

  const filtered = allMatches.filter(m => {
    if (filter !== 'all' && m.status !== filter) return false
    if (selectedGroup !== 'all' && m.group !== selectedGroup) return false
    return true
  })

  return { kpis, filtered, allMatches, overrides, filter, setFilter, selectedGroup, setSelectedGroup, toast, showToast }
}

// ─── Mobile ───────────────────────────────────────────────────────────────────

function AdminMobile() {
  const { kpis, filtered, filter, setFilter, selectedGroup, setSelectedGroup, toast, showToast } = useAdminData()

  return (
    <div className="min-h-dvh bg-paper pb-24">
      <div className="px-4 pt-5 pb-3 border-b border-line">
        <div className="flex items-center justify-between">
          <span className="font-display text-3xl">ADMIN</span>
          <span className="font-mono text-[10px] text-ink-4 tracking-eyebrow">BOLÃO DA SUPREMA</span>
        </div>
      </div>

      {toast && (
        <div className={cn(
          'mx-4 mt-3 p-3 border-2 font-mono text-[11px]',
          toast.ok ? 'border-green bg-green/5 text-green' : 'border-red/50 bg-red/5 text-red'
        )}>
          {toast.text}
        </div>
      )}

      {kpis && (
        <div className="grid grid-cols-2 gap-2 px-4 pt-3">
          <KpiCard label="PARTICIPANTES" value={kpis.totalUsers} sub="cadastrados" />
          <KpiCard label="PALPITES" value={kpis.totalPredictions} sub={`~${kpis.avgPredictionsPerUser} por usuário`} />
          <KpiCard label="ABERTAS" value={kpis.matchesOpen} sub="para apostas" />
          <KpiCard label="ENCERRADAS" value={kpis.matchesFinished} sub="com resultado" />
        </div>
      )}

      <div className="px-4 pt-3">
        <NoticesPanel onToast={showToast} />
        <ParticipantsPanel onToast={showToast} />
        <AdminRolesPanel onToast={showToast} />
      </div>

      <div className="px-4 pt-3 space-y-2">
        <button onClick={() => openAllMatches(showToast)} className="btn-ghost w-full justify-center text-[10px] border-green/60 text-green">
          ABRIR TODAS AS APOSTAS
        </button>
        <button onClick={() => lockAllOpenMatches(showToast)} className="btn-ghost w-full justify-center text-[10px]">
          BLOQUEAR TODAS AS APOSTAS ABERTAS
        </button>
      </div>

      <div className="px-4 pt-3">
        <div className="flex gap-1.5 flex-wrap mb-2">
          {(['all', 'scheduled', 'open', 'locked', 'finished'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'font-mono text-[9px] px-2.5 py-1.5 border-2 uppercase transition-colors',
                filter === f ? 'bg-ink border-ink text-paper' : 'border-hairline text-ink-3 hover:border-ink'
              )}
            >
              {f === 'all' ? 'TODOS' : f === 'scheduled' ? 'AGEND.' : f === 'open' ? 'ABERTOS' : f === 'locked' ? 'BLOQ.' : 'ENCERR.'}
            </button>
          ))}
        </div>
        <div className="flex gap-1 flex-wrap">
          <button
            onClick={() => setSelectedGroup('all')}
            className={cn('font-mono text-[8px] px-2 py-1 border', selectedGroup === 'all' ? 'bg-ink text-paper border-ink' : 'border-hairline text-ink-3')}
          >
            TODOS GRUPOS
          </button>
          {WC2026_GROUPS.map(g => (
            <button
              key={g.id}
              onClick={() => setSelectedGroup(g.id)}
              className={cn('font-mono text-[8px] px-2 py-1 border', selectedGroup === g.id ? 'bg-ink text-paper border-ink' : 'border-hairline text-ink-3')}
            >
              {g.id}
            </button>
          ))}
        </div>
      </div>

      <div className="ui-panel mx-4 mt-3">
        <div className="px-3 py-2 border-b border-hairline font-mono text-[10px] tracking-eyebrow text-ink-3">
          PARTIDAS ({filtered.length})
        </div>
        {filtered.length === 0 ? (
          <div className="px-4 py-6 text-center font-mono text-[11px] text-ink-4">Nenhuma partida com esse filtro</div>
        ) : (
          filtered.map(m => (
            <MatchRowAdmin
              key={m.id}
              matchCode={m.id}
              homeCode={m.home.code}
              awayCode={m.away.code}
              dateStr={formatMatchDateTime(m)}
              group={m.group}
              currentStatus={m.status}
              currentHomeScore={m.homeScore}
              currentAwayScore={m.awayScore}
              stage={m.stage}
              onAction={showToast}
            />
          ))
        )}
      </div>
    </div>
  )
}

// ─── Desktop ──────────────────────────────────────────────────────────────────

function AdminDesktop() {
  const { kpis, filtered, filter, setFilter, selectedGroup, setSelectedGroup, toast, showToast } = useAdminData()

  return (
    <div className="min-h-dvh bg-paper">
      <div className="max-w-screen-xl mx-auto px-6 py-8">

        <div className="flex items-center justify-between mb-6">
          <div>
            <Eyebrow>ADMIN · BOLÃO DA SUPREMA</Eyebrow>
            <h1 className="font-display text-4xl mt-1">PAINEL DE CONTROLE</h1>
          </div>
          <div className="flex gap-2">
            <button onClick={() => exportRankingCsv()} className="btn-ghost">EXPORTAR CSV ↓</button>
            <button onClick={() => openAllMatches(showToast)} className="btn-ghost border-green/60 text-green">
              ABRIR TODAS
            </button>
            <button onClick={() => lockAllOpenMatches(showToast)} className="btn-ghost border-yellow/60">
              BLOQUEAR TODAS
            </button>
          </div>
        </div>

        {toast && (
          <div className={cn(
            'border-2 p-3 mb-4 font-mono text-[11px]',
            toast.ok ? 'border-green bg-green/5 text-green' : 'border-red/50 bg-red/5 text-red'
          )}>
            {toast.text}
          </div>
        )}

        {kpis && (
          <div className="grid grid-cols-4 gap-3 mb-6">
            <KpiCard label="PARTICIPANTES" value={kpis.totalUsers} sub="cadastrados" />
            <KpiCard label="PALPITES" value={kpis.totalPredictions} sub={`~${kpis.avgPredictionsPerUser}/usuário`} />
            <KpiCard label="ABERTAS" value={kpis.matchesOpen} sub="para apostas" />
            <KpiCard label="ENCERRADAS" value={kpis.matchesFinished} sub="com resultado" />
          </div>
        )}

        <NoticesPanel onToast={showToast} />
        <ParticipantsPanel onToast={showToast} />
        <AdminRolesPanel onToast={showToast} />

        <div className="grid grid-cols-[1.6fr_1fr] gap-5">

          <div className="space-y-4">
            <div className="ui-panel">
              <div className="px-4 py-3 border-b border-hairline flex items-center gap-3 flex-wrap">
                <span className="font-mono text-[10px] tracking-eyebrow text-ink-3">FILTRAR:</span>
                {(['all', 'scheduled', 'open', 'locked', 'finished'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={cn(
                      'font-mono text-[9px] px-2.5 py-1.5 border-2 uppercase transition-colors',
                      filter === f ? 'bg-ink border-ink text-paper' : 'border-hairline text-ink-3 hover:border-ink'
                    )}
                  >
                    {f === 'all' ? 'TODOS' : f === 'scheduled' ? 'AGENDADOS' : f === 'open' ? 'ABERTOS' : f === 'locked' ? 'BLOQ.' : 'ENCERR.'}
                  </button>
                ))}
                <div className="ml-auto flex gap-1 flex-wrap">
                  <button
                    onClick={() => setSelectedGroup('all')}
                    className={cn('font-mono text-[9px] px-2 py-1 border', selectedGroup === 'all' ? 'bg-ink text-paper border-ink' : 'border-hairline text-ink-3')}
                  >
                    TODOS
                  </button>
                  {WC2026_GROUPS.map(g => (
                    <button
                      key={g.id}
                      onClick={() => setSelectedGroup(g.id)}
                      className={cn('font-mono text-[9px] px-2 py-1 border', selectedGroup === g.id ? 'bg-ink text-paper border-ink' : 'border-hairline text-ink-3')}
                    >
                      {g.id}
                    </button>
                  ))}
                </div>
              </div>

              <div className="divide-y divide-hairline max-h-[560px] overflow-y-auto">
                {filtered.length === 0 ? (
                  <div className="px-5 py-8 text-center font-mono text-[11px] text-ink-4">
                    Nenhuma partida com esse filtro
                  </div>
                ) : (
                  filtered.map(m => (
                    <MatchRowAdmin
                      key={m.id}
                      matchCode={m.id}
                      homeCode={m.home.code}
                      awayCode={m.away.code}
                      dateStr={formatMatchDateTime(m)}
                      group={m.group}
                      currentStatus={m.status}
                      currentHomeScore={m.homeScore}
                      currentAwayScore={m.awayScore}
                      stage={m.stage}
                      onAction={showToast}
                    />
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="ui-card p-4">
              <p className="font-mono text-[10px] tracking-eyebrow text-ink-3 mb-3">AÇÕES POR GRUPO</p>
              <div className="grid grid-cols-3 gap-1.5 mb-3">
                {WC2026_GROUPS.map(g => (
                  <button
                    key={g.id}
                    onClick={() => openGroupMatches(g.id, showToast)}
                    className="btn-ghost text-[9px] px-2 py-1.5"
                  >
                    ABRIR GRUPO {g.id}
                  </button>
                ))}
              </div>
              <button
                onClick={() => openAllMatches(showToast)}
                className="btn-ghost w-full justify-center text-[10px] border-green/60 text-green mb-2"
              >
                ABRIR TODAS AS APOSTAS
              </button>
              <button
                onClick={() => lockAllOpenMatches(showToast)}
                className="btn-ghost w-full justify-center text-[10px] border-yellow/60"
              >
                BLOQUEAR TODAS AS APOSTAS ABERTAS
              </button>
            </div>

            <div className="ui-card p-4">
              <p className="font-mono text-[10px] tracking-eyebrow text-ink-3 mb-3">DATAS-CHAVE</p>
              <div className="space-y-2">
                {[
                  { date: '11 JUN', label: 'Início fase de grupos' },
                  { date: '28 JUN', label: 'Fase de 32' },
                  { date: '4 JUL',  label: 'Oitavas de final' },
                  { date: '9 JUL',  label: 'Quartas de final' },
                  { date: '14 JUL', label: 'Semifinais' },
                  { date: '18 JUL', label: '3° lugar' },
                  { date: '19 JUL', label: 'FINAL' },
                ].map(d => (
                  <div key={d.date} className="flex items-center gap-3">
                    <span className="font-display text-base w-16 flex-shrink-0">{d.date}</span>
                    <span className="font-mono text-[11px] text-ink-3">{d.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="ui-card p-4">
              <p className="font-mono text-[10px] tracking-eyebrow text-ink-3 mb-3">TABELA DE PONTUAÇÃO</p>
              <div className="space-y-1.5">
                {POINT_RULES.map(r => (
                  <div key={r.id} className="flex items-center gap-2">
                    <span className="font-display text-lg text-green w-7 flex-shrink-0">+{r.points}</span>
                    <Tooltip content={r.description} side="top" maxWidth={240}>
                      <span className="font-mono text-[10px] text-ink-3 cursor-default underline decoration-dotted decoration-ink-4 underline-offset-2">
                        {r.label}
                      </span>
                    </Tooltip>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
