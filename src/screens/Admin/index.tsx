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
import { createInvite, fetchAuditLogs, fetchInvites, fetchParticipants, fetchScoringRules, fetchSystemHealth, refreshRanking, updateParticipantStatus, downloadCsv, setMarketStatus, settleMatchResult } from '@/services/product'
import type { Invite, MarketStatus, MatchStatus, MatchStage, ParticipantStatus, ScoringRule, SystemHealthStatus } from '@/types'

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
  extra?: { lockReason?: string }
) {
  const market = marketStatusFor(status)
  if (status === 'finished') {
    return { message: 'Use o fluxo de registrar resultado para encerrar e pontuar a partida.' }
  }

  const rpc = await setMarketStatus(matchCode, market, extra?.lockReason)
  if (rpc.error) return { message: rpc.error }
  return null
}

/**
 * Registra placar + dispara cálculo de pontos para todas as predictions da partida.
 * Retorna { scored, error }.
 */
async function setMatchResult(
  matchCode: string,
  homeScore: number,
  awayScore: number,
  _stage: MatchStage
): Promise<{ scored: number; error: string | null }> {
  const rpc = await settleMatchResult(matchCode, homeScore, awayScore)
  if (!rpc.error) return { scored: 0, error: null }
  return { scored: 0, error: rpc.error }
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

// ─── Match result dialog (inline) ─────────────────────────────────────────────

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
        {/* Match info */}
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <Flag team={homeTeam} size={18} />
          <span className="font-mono text-[11px] font-bold">{homeCode}</span>
          <span className="font-mono text-[9px] text-ink-4 mx-0.5">×</span>
          <span className="font-mono text-[11px] font-bold">{awayCode}</span>
          <Flag team={awayTeam} size={18} />
        </div>

        {/* Group + date */}
        <div className="hidden sm:block text-right flex-shrink-0">
          {group && <div className="font-mono text-[9px] text-ink-4">GRUPO {group}</div>}
          <div className="font-mono text-[10px] text-ink-3">{dateStr}</div>
        </div>

        {/* Score */}
        <div className="font-mono text-[13px] font-bold w-12 text-center flex-shrink-0">
          {currentStatus === 'finished' || currentStatus === 'live'
            ? `${currentHomeScore ?? 0}–${currentAwayScore ?? 0}`
            : '–'
          }
        </div>

        {/* Status */}
        <StatusBadge status={currentStatus} />

        {/* Actions */}
        {!busy && (
          <div className="flex gap-1 flex-shrink-0 flex-wrap">
            {currentStatus === 'scheduled' && (
              <button
                onClick={() => handleStatusChange('open')}
                className="btn-ghost text-[9px] px-2 py-1"
                title="Abrir apostas"
              >
                ABRIR
              </button>
            )}
            {currentStatus === 'open' && (
              <button
                onClick={() => handleStatusChange('locked')}
                className="btn-ghost text-[9px] px-2 py-1 border-yellow/60"
                title="Bloquear apostas"
              >
                BLOQUEAR
              </button>
            )}
            {currentStatus === 'locked' && (
              <button
                onClick={() => handleStatusChange('open')}
                className="btn-ghost text-[9px] px-2 py-1 border-green/60 text-green"
                title="Reabrir apostas"
              >
                REABRIR
              </button>
            )}
            {(currentStatus === 'locked' || currentStatus === 'live') && (
              <button
                onClick={() => setEditResult(v => !v)}
                className="btn-yellow text-[9px] px-2 py-1"
                title="Registrar resultado"
              >
                RESULTADO
              </button>
            )}
            {currentStatus === 'finished' && (
              <button
                onClick={() => handleStatusChange('open')}
                className="btn-ghost text-[9px] px-2 py-1 border-green/60 text-green"
                title="Reabrir para correção"
              >
                REABRIR
              </button>
            )}
            {currentStatus === 'finished' && (
              <button
                onClick={() => setEditResult(v => !v)}
                className="btn-ghost text-[9px] px-2 py-1"
                title="Corrigir resultado"
              >
                CORRIGIR
              </button>
            )}
          </div>
        )}
        {busy && (
          <span className="font-mono text-[9px] text-ink-4 animate-pulse">...</span>
        )}
      </div>

      {/* Inline result editor */}
      {editResult && (
        <div className="px-4 pb-3 bg-paper-deep border-t border-hairline flex items-center gap-3 flex-wrap">
          <span className="font-mono text-[9px] tracking-eyebrow text-ink-3">PLACAR FINAL:</span>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] font-bold">{homeCode}</span>
            <input
              type="number" min={0} max={20}
              value={homeGoals}
              onChange={e => setHomeGoals(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-12 border-2 border-ink text-center font-mono text-[14px] font-bold px-1 py-1 bg-yellow outline-none"
            />
            <span className="font-mono text-ink-4">×</span>
            <input
              type="number" min={0} max={20}
              value={awayGoals}
              onChange={e => setAwayGoals(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-12 border-2 border-ink text-center font-mono text-[14px] font-bold px-1 py-1 bg-yellow outline-none"
            />
            <span className="font-mono text-[11px] font-bold">{awayCode}</span>
          </div>
          <div className="flex gap-2 ml-auto">
            <button onClick={() => setEditResult(false)} className="btn-ghost text-[9px] px-2 py-1">
              CANCELAR
            </button>
            <button
              onClick={handleSetResult}
              disabled={busy}
              className="btn-yellow text-[9px] px-3 py-1 disabled:opacity-40"
            >
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
  const matchCodes = WC2026_MATCHES
    .filter(m => m.group === groupCode)
    .map(m => m.id)

  const results = await Promise.all(matchCodes.map(code => setMarketStatus(code, 'open', `group_${groupCode}_open`)))
  const failed = results.find(result => result.error)

  if (failed?.error) onAction(`Erro: ${failed.error}`, false)
  else onAction(`✓ Partidas do Grupo ${groupCode} abertas para apostas`, true)
}

async function lockAllOpenMatches(matchCodes: string[], onAction: (msg: string, ok: boolean) => void) {
  if (isMockMode) { onAction('Mock mode: ação não persiste', false); return }
  const openCodes = matchCodes
  if (matchCodes.length === 0) { onAction('Nenhuma partida aberta para bloquear', true); return }
  const results = await Promise.all(matchCodes.map(code => setMarketStatus(code, 'locked', 'bulk_admin_lock')))
  const failed = results.find(result => result.error)
  if (failed?.error) onAction(`Erro: ${failed.error}`, false)
  else onAction(`✓ ${openCodes.length} partidas abertas → BLOQUEADAS`, true)
}

// ─── Export CSV ───────────────────────────────────────────────────────────────

async function exportRankingCsv() {
  const { data: users } = await supabase
    .from('users')
    .select('id, first_name, last_name, dept, email')

  const { data: pts } = await supabase
    .from('predictions')
    .select('user_id, points_earned')

  if (!users || !pts) return

  const pointsMap: Record<string, number> = {}
  for (const p of pts) {
    pointsMap[p.user_id] = (pointsMap[p.user_id] ?? 0) + (p.points_earned ?? 0)
  }

  const rows = users
    .map(u => ({
      nome: `${u.first_name} ${u.last_name}`.trim(),
      dept: u.dept,
      email: u.email,
      pontos: pointsMap[u.id] ?? 0,
    }))
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
    <div className="border-2 border-ink p-4">
      <div className="font-mono text-[9px] tracking-eyebrow text-ink-3 mb-1">{label}</div>
      <div className="font-display text-3xl leading-none">{value}</div>
      <div className="font-mono text-[10px] text-ink-4 mt-0.5">{sub}</div>
    </div>
  )
}

function AdminOpsPanel() {
  const [health, setHealth] = useState<SystemHealthStatus | null>(null)
  const [participants, setParticipants] = useState<Array<Record<string, unknown>>>([])
  const [rules, setRules] = useState<ScoringRule[]>([])
  const [audit, setAudit] = useState<Array<Record<string, unknown>>>([])
  const [invites, setInvites] = useState<Invite[]>([])
  const [inviteLabel, setInviteLabel] = useState('Convite interno')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [h, p, r, a, i] = await Promise.all([
      fetchSystemHealth(),
      fetchParticipants(),
      fetchScoringRules(),
      fetchAuditLogs(20),
      fetchInvites(),
    ])
    setHealth(h.data)
    setParticipants((p.data ?? []) as Array<Record<string, unknown>>)
    setRules(r.data ?? [])
    setAudit((a.data ?? []) as Array<Record<string, unknown>>)
    setInvites(i.data ?? [])
    setError(h.error ?? p.error ?? r.error ?? a.error ?? i.error)
  }, [])

  useEffect(() => { load() }, [load])

  async function setParticipant(id: unknown, status: ParticipantStatus) {
    if (typeof id !== 'string') return
    setBusy(true)
    const res = await updateParticipantStatus(id, status)
    setBusy(false)
    if (res.error) setError(res.error)
    await load()
  }

  async function recalcRanking() {
    setBusy(true)
    const res = await refreshRanking()
    setBusy(false)
    if (res.error) setError(res.error)
    await load()
  }

  async function handleCreateInvite() {
    setBusy(true)
    const res = await createInvite(inviteLabel || 'Convite interno')
    setBusy(false)
    if (res.error) setError(res.error)
    await load()
  }

  return (
    <section className="border-2 border-ink mb-6">
      <div className="px-4 py-3 bg-ink text-paper flex items-center justify-between gap-3">
        <div>
          <div className="font-display text-xl">OPERACAO T.I.</div>
          <div className="font-mono text-[9px] text-paper/50">saude, participantes, regras, auditoria e exportacoes</div>
        </div>
        <button disabled={busy} onClick={load} className="btn-yellow text-[10px]">ATUALIZAR</button>
      </div>
      {error && <div className="px-4 py-2 border-b border-red/30 bg-red/5 font-mono text-[10px] text-red">{error}</div>}
      <div className="grid md:grid-cols-4 gap-0 border-b border-hairline">
        <Mini label="usuarios" value={health?.usersTotal ?? '—'} />
        <Mini label="pendentes" value={health?.usersPending ?? '—'} />
        <Mini label="palpites" value={health?.predictionsTotal ?? '—'} />
        <Mini label="mercados abertos" value={health?.marketsOpen ?? '—'} />
      </div>
      <div className="grid lg:grid-cols-4 gap-0">
        <div className="p-4 border-r border-hairline">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display text-lg">PARTICIPANTES</h3>
            <button onClick={() => downloadCsv(`participantes-${Date.now()}.csv`, participants)} className="font-mono text-[9px] underline">CSV</button>
          </div>
          <div className="space-y-2 max-h-64 overflow-auto">
            {participants.slice(0, 12).map(p => (
              <div key={String(p.id)} className="border border-hairline p-2">
                <div className="font-mono text-[10px] font-bold truncate">{String(p.first_name ?? '')} {String(p.last_name ?? '')}</div>
                <div className="font-mono text-[8px] text-ink-4 truncate">{String(p.participant_status ?? 'active')} · {String(p.user_role ?? 'user')}</div>
                <div className="flex gap-1 mt-2">
                  {(['active','blocked','removed'] as ParticipantStatus[]).map(status => (
                    <button key={status} disabled={busy} onClick={() => setParticipant(p.id, status)} className="font-mono text-[8px] border border-hairline px-1.5 py-1 hover:bg-yellow">{status}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="p-4 border-r border-hairline">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display text-lg">PONTUACAO</h3>
            <button onClick={recalcRanking} disabled={busy} className="font-mono text-[9px] underline">RECALCULAR</button>
          </div>
          <div className="space-y-1 max-h-64 overflow-auto">
            {rules.map(rule => (
              <div key={rule.id} className="flex items-center justify-between border-b border-hairline py-1">
                <span className="font-mono text-[10px]">{rule.label}</span>
                <span className="font-display text-lg">{rule.points}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="p-4 border-r border-hairline">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display text-lg">CONVITES</h3>
            <button onClick={() => downloadCsv(`convites-${Date.now()}.csv`, invites as unknown as Array<Record<string, unknown>>)} className="font-mono text-[9px] underline">CSV</button>
          </div>
          <div className="flex gap-2 mb-3">
            <input
              value={inviteLabel}
              onChange={e => setInviteLabel(e.target.value)}
              className="min-w-0 flex-1 border border-hairline px-2 py-1 font-mono text-[10px] bg-paper-deep outline-none"
              aria-label="Nome do convite"
            />
            <button disabled={busy} onClick={handleCreateInvite} className="btn-yellow text-[9px]">CRIAR</button>
          </div>
          <div className="space-y-2 max-h-64 overflow-auto">
            {invites.slice(0, 10).map(invite => {
              const url = `${window.location.origin}${window.location.pathname}#/login?invite=${invite.code}`
              return (
                <div key={invite.id} className="border border-hairline p-2">
                  <div className="font-mono text-[10px] font-bold">{invite.code}</div>
                  <div className="font-mono text-[8px] text-ink-4 truncate">{invite.label} · {invite.usedCount}/{invite.maxUses ?? '∞'}</div>
                  <button onClick={() => navigator.clipboard?.writeText(url)} className="font-mono text-[8px] underline mt-1">COPIAR LINK</button>
                </div>
              )
            })}
          </div>
        </div>
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display text-lg">AUDITORIA</h3>
            <button onClick={() => downloadCsv(`audit-${Date.now()}.csv`, audit)} className="font-mono text-[9px] underline">CSV</button>
          </div>
          <div className="space-y-2 max-h-64 overflow-auto">
            {audit.map(log => (
              <div key={String(log.id)} className="font-mono text-[9px] border-b border-hairline pb-2">
                <div className="font-bold">{String(log.action)}</div>
                <div className="text-ink-4">{String(log.entity_type)} · {String(log.created_at).slice(0, 16)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function Mini({ label, value }: { label: string; value: number | string }) {
  return <div className="p-3 border-r border-hairline last:border-r-0"><div className="font-display text-2xl">{value}</div><div className="font-mono text-[8px] text-ink-4">{label.toUpperCase()}</div></div>
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

  // Merged list: static wc2026 + DB overrides
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
  const { kpis, filtered, allMatches, filter, setFilter, selectedGroup, setSelectedGroup, toast, showToast } = useAdminData()
  const openMatchCodes = allMatches.filter(match => match.status === 'open').map(match => match.id)

  return (
    <div className="min-h-dvh bg-paper pb-24">
      {/* Header */}
      <div className="px-4 pt-5 pb-3 border-b border-line">
        <div className="flex items-center justify-between">
          <span className="font-display text-3xl">ADMIN</span>
          <span className="font-mono text-[10px] text-ink-4 tracking-eyebrow">BOLÃO DA SUPREMA</span>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={cn(
          'mx-4 mt-3 p-3 border-2 font-mono text-[11px]',
          toast.ok ? 'border-green bg-green/5 text-green' : 'border-red/50 bg-red/5 text-red'
        )}>
          {toast.text}
        </div>
      )}

      {/* KPIs */}
      {kpis && (
        <div className="grid grid-cols-2 gap-2 px-4 pt-3">
          <KpiCard label="PARTICIPANTES" value={kpis.totalUsers} sub="cadastrados" />
          <KpiCard label="PALPITES" value={kpis.totalPredictions} sub={`~${kpis.avgPredictionsPerUser} por usuário`} />
          <KpiCard label="ABERTAS" value={kpis.matchesOpen} sub="para apostas" />
          <KpiCard label="ENCERRADAS" value={kpis.matchesFinished} sub="com resultado" />
        </div>
      )}

      <div className="px-4 pt-3">
        <AdminOpsPanel />
      </div>

      {/* Bulk actions */}
      <div className="px-4 pt-3 space-y-2">
        <button
          onClick={() => lockAllOpenMatches(openMatchCodes, showToast)}
          className="btn-ghost w-full justify-center text-[10px]"
        >
          BLOQUEAR TODAS AS APOSTAS ABERTAS
        </button>
      </div>

      {/* Filters */}
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

      {/* Match list */}
      <div className="border-2 border-ink mx-4 mt-3">
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
  const { kpis, filtered, allMatches, filter, setFilter, selectedGroup, setSelectedGroup, toast, showToast } = useAdminData()
  const openMatchCodes = allMatches.filter(match => match.status === 'open').map(match => match.id)

  return (
    <div className="min-h-dvh bg-paper">
      <div className="max-w-screen-xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <Eyebrow>ADMIN · BOLÃO DA SUPREMA</Eyebrow>
            <h1 className="font-display text-4xl mt-1">PAINEL DE CONTROLE</h1>
          </div>
          <div className="flex gap-2">
            <button onClick={() => exportRankingCsv()} className="btn-ghost">
              EXPORTAR CSV ↓
            </button>
            <button
              onClick={() => lockAllOpenMatches(openMatchCodes, showToast)}
              className="btn-ghost border-yellow/60"
            >
              BLOQUEAR TODAS APOSTAS
            </button>
          </div>
        </div>

        {/* Toast */}
        {toast && (
          <div className={cn(
            'border-2 p-3 mb-4 font-mono text-[11px]',
            toast.ok ? 'border-green bg-green/5 text-green' : 'border-red/50 bg-red/5 text-red'
          )}>
            {toast.text}
          </div>
        )}

        {/* KPIs */}
        {kpis && (
          <div className="grid grid-cols-5 gap-3 mb-6">
            <KpiCard label="PARTICIPANTES" value={kpis.totalUsers} sub="cadastrados" />
            <KpiCard label="PALPITES" value={kpis.totalPredictions} sub={`~${kpis.avgPredictionsPerUser}/usuário`} />
            <KpiCard label="ABERTAS" value={kpis.matchesOpen} sub="para apostas" />
            <KpiCard label="BLOQUEADAS" value={filtered.filter(m => m.status === 'locked').length} sub="aguardando resultado" />
            <KpiCard label="ENCERRADAS" value={kpis.matchesFinished} sub="com resultado" />
          </div>
        )}

        <AdminOpsPanel />

        <div className="grid grid-cols-[1.6fr_1fr] gap-5">

          {/* Left: match control */}
          <div className="space-y-4">

            {/* Filters */}
            <div className="border-2 border-ink">
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

          {/* Right sidebar */}
          <div className="space-y-4">

            {/* Bulk group actions */}
            <div className="border-2 border-ink p-4">
              <p className="font-mono text-[10px] tracking-eyebrow text-ink-3 mb-3">AÇÕES POR GRUPO</p>
              <div className="grid grid-cols-3 gap-1.5 mb-3">
                {WC2026_GROUPS.map(g => (
                  <button
                    key={g.id}
                    onClick={() => openGroupMatches(g.id, showToast)}
                    className="btn-ghost text-[9px] px-2 py-1.5"
                  >
                    ABRIR GRP {g.id}
                  </button>
                ))}
              </div>
              <button
                onClick={() => lockAllOpenMatches(openMatchCodes, showToast)}
                className="btn-ghost w-full justify-center text-[10px] border-yellow/60"
              >
                BLOQUEAR TODAS AS APOSTAS ABERTAS
              </button>
            </div>

            {/* Tournament dates */}
            <div className="border-2 border-ink p-4">
              <p className="font-mono text-[10px] tracking-eyebrow text-ink-3 mb-3">DATAS-CHAVE</p>
              <div className="space-y-2">
                {[
                  { date: '11 JUN', label: 'Início fase de grupos' },
                  { date: '27 JUN', label: 'Rodada de 32' },
                  { date: '4 JUL',  label: 'Oitavas de final' },
                  { date: '10 JUL', label: 'Quartas de final' },
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

            {/* Scoring rules */}
            <div className="border-2 border-ink p-4">
              <p className="font-mono text-[10px] tracking-eyebrow text-ink-3 mb-3">TABELA DE PONTUAÇÃO</p>
              <div className="space-y-1.5">
                {POINT_RULES.map(r => (
                  <div key={r.id} className="flex items-center gap-2">
                    <span className="font-display text-lg text-green w-7 flex-shrink-0">+{r.points}</span>
                    <span className="font-mono text-[10px] text-ink-3">{r.label}</span>
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
