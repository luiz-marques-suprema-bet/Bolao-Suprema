import { useState, useEffect, useCallback, type ReactNode } from 'react'
import { Eyebrow } from '@/components/shared/Eyebrow'
import { Flag } from '@/components/shared/Flag'
import { useAuthStore } from '@/stores/auth.store'
import { useMatchStore } from '@/stores/match.store'
import { useIsDesktop } from '@/hooks/useBreakpoint'
import { WC2026_MATCHES, WC2026_GROUPS } from '@/data/wc2026'
import { TEAMS } from '@/data/teams'
import { supabase, isMockMode } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { formatMatchDateTime } from '@/lib/matchTime'
import {
  downloadCsv,
  settleMatchResult,
  adminUpdateMatchStatus,
  adminDeletePrediction,
  adminSetUserRole,
  fetchSystemHealth,
} from '@/services/product'
import type { MarketStatus, MatchStatus, MatchStage } from '@/types'

// Código técnico da partida (g-h-4, ko-r32-1…) → rótulo legível pro admin ver
// nos palpites. Grupos mostram os times; mata-mata mostra a fase.
const MATCH_LABEL: Record<string, string> = Object.fromEntries(
  WC2026_MATCHES.map(m => {
    const hasTeams = m.home.code !== 'TBD' && m.away.code !== 'TBD'
    if (hasTeams) return [m.id, `${m.home.code} × ${m.away.code}${m.group ? ` · Grupo ${m.group}` : ''}`]
    return [m.id, m.stageLabel ?? m.id]
  }),
)
function matchLabel(code: string): string {
  return MATCH_LABEL[code] ?? code
}

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
    supabase.from('matches').select('status, market_status'),
  ])
  const totalUsers = usersRes.count ?? 0
  const totalPredictions = predsRes.count ?? 0
  const matchRows = (matchesRes.data ?? []) as { status: string; market_status: string | null }[]
  return {
    totalUsers,
    totalPredictions,
    avgPredictionsPerUser: totalUsers > 0 ? Math.round(totalPredictions / totalUsers) : 0,
    matchesOpen: matchRows.filter(m => m.market_status === 'open').length,
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
  // M1: contagem real. A trigger server-side define points_earned para todos os
  // palpites da partida; contamos quantos foram apurados em vez de devolver 0.
  const { count, error } = await supabase
    .from('predictions')
    .select('id', { count: 'exact', head: true })
    .eq('match_code', matchCode)
  if (error) return { scored: 0, error: null } // resultado salvo; só a contagem falhou
  return { scored: count ?? 0, error: null }
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
  const [winnerPick, setWinnerPick] = useState<string | null>(null)

  const homeTeam = TEAMS[homeCode]
  const awayTeam = TEAMS[awayCode]
  // No mata-mata, empate no tempo normal = decidido nos pênaltis/prorrogação →
  // o admin precisa dizer quem avançou (a TheSportsDB grátis não traz isso).
  const isKnockout = stage !== 'group'
  const needsWinner = isKnockout && homeGoals === awayGoals

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
    if (needsWinner && !winnerPick) {
      onAction('Empate no mata-mata: escolha quem avançou (pênaltis).', false)
      return
    }
    setBusy(true)
    // Mata-mata empatado: settle_match_result gravaria winner='draw' (não avança a
    // chave nem pontua o "quem passa"). Usamos admin_update_match_status com o
    // vencedor explícito → triggers apuram + a próxima fase preenche sozinha.
    if (needsWinner && winnerPick) {
      const err = await updateMatchStatus(matchCode, 'finished', { homeScore: homeGoals, awayScore: awayGoals, winner: winnerPick })
      if (err) {
        onAction(`Erro: ${err.message}`, false)
      } else {
        applyOverride({ matchCode, status: 'finished', marketStatus: 'settled', homeScore: homeGoals, awayScore: awayGoals })
        onAction(`✓ ${matchCode}: ${winnerPick} avançou (pênaltis) · palpites apurados`, true)
        setEditResult(false)
      }
      setBusy(false)
      return
    }
    const { scored, error } = await setMatchResult(matchCode, homeGoals, awayGoals, stage)
    if (error) {
      onAction(`Erro: ${error}`, false)
    } else {
      applyOverride({ matchCode, status: 'finished', marketStatus: 'settled', homeScore: homeGoals, awayScore: awayGoals })
      onAction(`✓ Resultado registrado · ${scored} palpites apurados`, true)
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
        <div className="px-4 pb-3 pt-1 bg-paper-deep border-t border-hairline space-y-2.5">
          <div className="flex items-end gap-3 flex-wrap">
            <div className="text-center">
              <div className="font-mono text-[8px] tracking-eyebrow text-ink-4 mb-1">CASA</div>
              <div className="flex items-center gap-1.5">
                <Flag team={homeTeam} size={16} />
                <span className="font-mono text-[11px] font-bold">{homeCode}</span>
                <input type="number" min={0} max={30} value={homeGoals}
                  onChange={e => { setHomeGoals(Math.max(0, parseInt(e.target.value) || 0)); setWinnerPick(null) }}
                  className="w-12 border-2 border-ink text-center font-mono text-[15px] font-bold px-1 py-1 bg-yellow outline-none" />
              </div>
            </div>
            <span className="font-mono text-ink-4 pb-2">×</span>
            <div className="text-center">
              <div className="font-mono text-[8px] tracking-eyebrow text-ink-4 mb-1">FORA</div>
              <div className="flex items-center gap-1.5">
                <input type="number" min={0} max={30} value={awayGoals}
                  onChange={e => { setAwayGoals(Math.max(0, parseInt(e.target.value) || 0)); setWinnerPick(null) }}
                  className="w-12 border-2 border-ink text-center font-mono text-[15px] font-bold px-1 py-1 bg-yellow outline-none" />
                <span className="font-mono text-[11px] font-bold">{awayCode}</span>
                <Flag team={awayTeam} size={16} />
              </div>
            </div>
          </div>

          {needsWinner && (
            <div className="border-2 border-yellow/70 bg-yellow/10 px-3 py-2">
              <div className="font-mono text-[9px] tracking-eyebrow text-ink-2 mb-1.5">EMPATE NO MATA-MATA — QUEM AVANÇOU? (pênaltis/prorrogação)</div>
              <div className="flex gap-2 flex-wrap">
                {[homeCode, awayCode].map(code => (
                  <button key={code} type="button" onClick={() => setWinnerPick(code)}
                    className={cn('flex items-center gap-1.5 border-2 px-3 py-1 font-mono text-[11px] font-bold transition-colors',
                      winnerPick === code ? 'bg-ink border-ink text-paper' : 'border-ink/30 text-ink-3 hover:border-ink')}>
                    <Flag team={TEAMS[code]} size={16} /> {code} avança
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button onClick={() => setEditResult(false)} className="btn-ghost text-[9px] px-2 py-1">CANCELAR</button>
            <button onClick={handleSetResult} disabled={busy || (needsWinner && !winnerPick)}
              className="btn-yellow text-[9px] px-3 py-1 disabled:opacity-40 ml-auto">
              {needsWinner ? 'CONFIRMAR AVANÇO + PONTUAR →' : 'CONFIRMAR + PONTUAR →'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Export CSV ───────────────────────────────────────────────────────────────

async function exportRankingCsv() {
  const { data: users } = await supabase.from('users').select('id, first_name, last_name, dept, email, participant_status')
  const { data: pts } = await supabase.from('predictions').select('user_id, points_earned')
  if (!users || !pts) return
  const pointsMap: Record<string, number> = {}
  const countMap: Record<string, number> = {}
  for (const p of pts as Array<{ user_id: string; points_earned: number | null }>) {
    pointsMap[p.user_id] = (pointsMap[p.user_id] ?? 0) + (p.points_earned ?? 0)
    countMap[p.user_id] = (countMap[p.user_id] ?? 0) + 1
  }
  const ranked = (users as Array<{ id: string; first_name: string | null; last_name: string | null; dept: string | null; email: string; participant_status: string | null }>)
    .map(u => ({
      Nome: `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() || u.email,
      Departamento: u.dept ?? '',
      Email: u.email,
      Status: u.participant_status ?? '',
      Palpites: countMap[u.id] ?? 0,
      Pontos: pointsMap[u.id] ?? 0,
    }))
    .sort((a, b) => b.Pontos - a.Pontos)
    .map((r, i) => ({ '#': i + 1, ...r }))
  // downloadCsv já cuida de BOM (acentos), escape e CRLF → abre limpo no Excel.
  downloadCsv(`ranking-bolao-suprema-${new Date().toISOString().slice(0, 10)}.csv`, ranked)
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
  const [pointsByUser, setPointsByUser] = useState<Record<string, number>>({})
  const [expanded, setExpanded] = useState<string | null>(null)
  const [preds, setPreds] = useState<PredRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [query, setQuery] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const [usersRes, ptsRes] = await Promise.all([
      supabase.from('users').select('id,first_name,last_name,dept,email,participant_status').order('first_name', { ascending: true }),
      supabase.from('predictions').select('user_id, points_earned'),
    ])
    if (usersRes.error) onToast(`Erro ao carregar participantes: ${usersRes.error.message}`, false)
    setParticipants((usersRes.data ?? []) as ParticipantRow[])
    const pts: Record<string, number> = {}
    for (const p of (ptsRes.data ?? []) as Array<{ user_id: string; points_earned: number | null }>) {
      pts[p.user_id] = (pts[p.user_id] ?? 0) + (p.points_earned ?? 0)
    }
    setPointsByUser(pts)
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
  const fullName = (p: ParticipantRow) => [p.first_name, p.last_name].filter(Boolean).join(' ') || p.email
  const q = query.trim().toLowerCase()
  const visible = participants
    .filter(p => !q || `${fullName(p)} ${p.email} ${p.dept ?? ''}`.toLowerCase().includes(q))
    .sort((a, b) => (pointsByUser[b.id] ?? 0) - (pointsByUser[a.id] ?? 0))

  function exportCsv() {
    const rows = [...participants]
      .sort((a, b) => (pointsByUser[b.id] ?? 0) - (pointsByUser[a.id] ?? 0))
      .map((p, i) => ({
        '#': i + 1,
        Nome: fullName(p),
        Departamento: p.dept ?? '',
        Email: p.email,
        Status: p.participant_status ?? '',
        Pontos: pointsByUser[p.id] ?? 0,
      }))
    downloadCsv(`participantes-bolao-suprema-${new Date().toISOString().slice(0, 10)}.csv`, rows)
  }

  return (
    <section className="ui-panel mb-6">
      <div className="ui-panel-header flex items-center justify-between gap-3">
        <div>
          <div className="font-display text-xl">PARTICIPANTES</div>
          <div className="font-mono text-[9px] text-paper/50">{total} cadastrados · {blocked} bloqueados · ordenados por pontos</div>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCsv} className="btn-ghost text-[9px]">CSV ↓</button>
          <button disabled={busy || loading} onClick={load} className="btn-yellow text-[10px]">↺</button>
        </div>
      </div>

      <div className="px-4 py-3 border-b border-hairline">
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Buscar participante por nome, e-mail ou setor…"
          className="w-full border-2 border-hairline bg-card px-3 py-2 font-mono text-[11px] outline-none focus:border-ink"
        />
      </div>

      {loading && (
        <div className="px-4 py-6 font-mono text-[11px] text-ink-4 text-center animate-pulse">CARREGANDO…</div>
      )}

      <div className="divide-y divide-hairline max-h-[460px] overflow-y-auto">
        {!loading && visible.length === 0 && (
          <div className="px-4 py-6 text-center font-mono text-[11px] text-ink-4">Nenhum participante encontrado.</div>
        )}
        {visible.map(p => {
          const name = fullName(p)
          const isBlocked = p.participant_status === 'blocked'
          const isOpen = expanded === p.id
          return (
            <div key={p.id}>
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-[11px] font-bold truncate">{name}</div>
                  <div className="font-mono text-[9px] text-ink-4 truncate">{p.dept || '—'} · {pointsByUser[p.id] ?? 0} pts</div>
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
                          <span className="font-bold">{matchLabel(pred.match_code)}</span>
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

// ─── Filtros de partida (fase + status + grupo + busca) ─────────────────────────

type StageFilter = 'all' | 'group' | 'round_of_32' | 'round_of_16' | 'quarter_final' | 'semi_final' | 'finals'

const STAGE_FILTERS: Array<{ id: StageFilter; label: string }> = [
  { id: 'all', label: 'TODAS' },
  { id: 'group', label: 'GRUPOS' },
  { id: 'round_of_32', label: '16-AVOS' },
  { id: 'round_of_16', label: 'OITAVAS' },
  { id: 'quarter_final', label: 'QUARTAS' },
  { id: 'semi_final', label: 'SEMIS' },
  { id: 'finals', label: 'FINAL · 3º' },
]

const STATUS_FILTERS: Array<{ id: 'all' | 'scheduled' | 'open' | 'locked' | 'finished'; label: string }> = [
  { id: 'all', label: 'TODOS' },
  { id: 'scheduled', label: 'AGENDADOS' },
  { id: 'open', label: 'ABERTOS' },
  { id: 'locked', label: 'BLOQ.' },
  { id: 'finished', label: 'ENCERR.' },
]

function stageMatchesFilter(stage: MatchStage, f: StageFilter): boolean {
  if (f === 'all') return true
  if (f === 'finals') return stage === 'final' || stage === 'third_place'
  return stage === f
}

function FilterChip({ active, onClick, children, small }: { active: boolean; onClick: () => void; children: ReactNode; small?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'font-mono uppercase border-2 transition-colors',
        small ? 'text-[8px] px-2 py-1' : 'text-[9px] px-2.5 py-1.5',
        active ? 'bg-ink border-ink text-paper' : 'border-hairline text-ink-3 hover:border-ink',
      )}
    >
      {children}
    </button>
  )
}

interface MatchFilterControlsProps {
  filter: 'all' | 'scheduled' | 'open' | 'locked' | 'finished'
  setFilter: (f: 'all' | 'scheduled' | 'open' | 'locked' | 'finished') => void
  stageFilter: StageFilter
  setStageFilter: (s: StageFilter) => void
  selectedGroup: string
  setSelectedGroup: (g: string) => void
  search: string
  setSearch: (s: string) => void
}

function MatchFilterControls(p: MatchFilterControlsProps) {
  const showGroups = p.stageFilter === 'all' || p.stageFilter === 'group'
  const Row = ({ label, children }: { label: string; children: ReactNode }) => (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="w-12 flex-shrink-0 font-mono text-[8px] tracking-eyebrow text-ink-4">{label}</span>
      {children}
    </div>
  )
  return (
    <div className="space-y-2.5">
      <input
        value={p.search}
        onChange={e => p.setSearch(e.target.value)}
        placeholder="Buscar time, sigla ou código (ex.: BRA, ko-r32-1)…"
        className="w-full border-2 border-hairline bg-card px-3 py-2 font-mono text-[11px] outline-none focus:border-ink"
      />
      <Row label="FASE">
        {STAGE_FILTERS.map(f => (
          <FilterChip key={f.id} active={p.stageFilter === f.id} onClick={() => p.setStageFilter(f.id)}>{f.label}</FilterChip>
        ))}
      </Row>
      <Row label="STATUS">
        {STATUS_FILTERS.map(f => (
          <FilterChip key={f.id} active={p.filter === f.id} onClick={() => p.setFilter(f.id)}>{f.label}</FilterChip>
        ))}
      </Row>
      {showGroups && (
        <Row label="GRUPO">
          <FilterChip small active={p.selectedGroup === 'all'} onClick={() => p.setSelectedGroup('all')}>TODOS</FilterChip>
          {WC2026_GROUPS.map(g => (
            <FilterChip small key={g.id} active={p.selectedGroup === g.id} onClick={() => p.setSelectedGroup(g.id)}>{g.id}</FilterChip>
          ))}
        </Row>
      )}
    </div>
  )
}

function useAdminData() {
  const { overrides, init } = useMatchStore()
  const [kpis, setKpis] = useState<KpiData | null>(null)
  const [filter, setFilter] = useState<'all' | 'scheduled' | 'open' | 'locked' | 'finished'>('all')
  const [stageFilter, setStageFilter] = useState<StageFilter>('all')
  const [selectedGroup, setSelectedGroup] = useState<string>('all')
  const [search, setSearch] = useState('')
  const { msg: toast, show: showToast } = useToast()

  useEffect(() => { init() }, [init])
  useEffect(() => {
    if (!isMockMode) fetchKpis().then(setKpis)
  }, [])

  const allMatches = WC2026_MATCHES.map(m => {
    const ov = overrides[m.id]
    if (!ov) return m
    // Sobrepõe TIMES materializados (mata-mata) além de status/placar — senão o
    // painel mostrava "TBD × TBD" mesmo nos jogos do 16-avos já definidos.
    const home = ov.homeCode && ov.homeCode !== 'TBD' && TEAMS[ov.homeCode] ? TEAMS[ov.homeCode] : m.home
    const away = ov.awayCode && ov.awayCode !== 'TBD' && TEAMS[ov.awayCode] ? TEAMS[ov.awayCode] : m.away
    return { ...m, status: ov.status, homeScore: ov.homeScore, awayScore: ov.awayScore, winner: ov.winner ?? m.winner, home, away }
  })

  const inGroupContext = stageFilter === 'all' || stageFilter === 'group'
  const q = search.trim().toLowerCase()
  const filtered = allMatches.filter(m => {
    if (filter !== 'all' && m.status !== filter) return false
    if (stageFilter !== 'all' && !stageMatchesFilter(m.stage, stageFilter)) return false
    if (inGroupContext && selectedGroup !== 'all' && m.group !== selectedGroup) return false
    if (q && !`${m.home.code} ${m.away.code} ${m.home.name} ${m.away.name} ${m.id}`.toLowerCase().includes(q)) return false
    return true
  })

  return { kpis, filtered, allMatches, overrides, filter, setFilter, stageFilter, setStageFilter, selectedGroup, setSelectedGroup, search, setSearch, toast, showToast }
}

type AdminTab = 'operation' | 'people' | 'comms' | 'health'

const ADMIN_TABS: Array<{ id: AdminTab; label: string; detail: string }> = [
  { id: 'operation', label: 'OPERAÇÃO', detail: 'partidas, mercados e resultados' },
  { id: 'people', label: 'PESSOAS', detail: 'participantes, bloqueios e papéis' },
  { id: 'comms', label: 'COMUNICAÇÃO', detail: 'avisos globais' },
  { id: 'health', label: 'SAÚDE', detail: 'status do sistema e auditoria' },
]

function AdminTabBar({ active, onChange }: { active: AdminTab; onChange: (tab: AdminTab) => void }) {
  return (
    <div className="mb-5 grid grid-cols-2 gap-2 md:grid-cols-4">
      {ADMIN_TABS.map(tab => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={cn(
            'border-2 px-3 py-3 text-left transition-colors',
            active === tab.id ? 'border-ink bg-ink text-paper' : 'border-hairline bg-card hover:border-line-strong',
          )}
        >
          <div className="font-display text-lg leading-none">{tab.label}</div>
          <div className={cn('mt-1 font-mono text-[8px] leading-tight', active === tab.id ? 'text-paper/55' : 'text-ink-4')}>
            {tab.detail}
          </div>
        </button>
      ))}
    </div>
  )
}

// Rótulos legíveis pras ações de auditoria que importam pro admin.
const AUDIT_LABELS: Record<string, string> = {
  match_settled: 'Resultado apurado',
  match_status_updated: 'Status de jogo alterado',
  knockout_materialized: 'Mata-mata materializado',
  knockout_advanced: 'Avanço no mata-mata',
  user_role_updated: 'Papel alterado',
  participant_removed: 'Participante removido',
  participant_status_updated: 'Bloqueio/desbloqueio',
  prediction_deleted: 'Palpite removido (admin)',
}
// Ruído: cada palpite/perfil salvo gera log; some pra auditoria mostrar o que importa.
const AUDIT_NOISE = ['prediction_created', 'prediction_updated', 'general_picks_updated', 'profile_updated', 'ranking_refreshed']

interface AuditRow { id: string; action: string; entity_type: string | null; entity_id: string | null; created_at: string; actor: string | null }

function AdminHealthPanel() {
  const [health, setHealth] = useState<Array<{ label: string; value: string | number; sub: string }>>([])
  const [logs, setLogs] = useState<AuditRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const [healthRes, auditRes] = await Promise.all([
      fetchSystemHealth(),
      supabase
        .from('audit_logs')
        .select('id, action, entity_type, entity_id, created_at, actor_user_id')
        .not('action', 'in', `(${AUDIT_NOISE.join(',')})`)
        .order('created_at', { ascending: false })
        .limit(30),
    ])
    if (healthRes.data) {
      setHealth([
        { label: 'USUÁRIOS', value: healthRes.data.usersTotal, sub: `${healthRes.data.usersPending} pendentes` },
        { label: 'PALPITES', value: healthRes.data.predictionsTotal, sub: 'total salvo' },
        { label: 'MERCADOS ABERTOS', value: healthRes.data.marketsOpen, sub: `${healthRes.data.marketsLocked} travados` },
        { label: 'SEM KICKOFF', value: healthRes.data.matchesWithoutKickoff, sub: 'deve ser 0 em jogos reais' },
      ])
    }
    const raw = (auditRes.data ?? []) as Array<{ id: string; action: string; entity_type: string | null; entity_id: string | null; created_at: string; actor_user_id: string | null }>
    const actorIds = Array.from(new Set(raw.map(l => l.actor_user_id).filter(Boolean))) as string[]
    let names: Record<string, string> = {}
    if (actorIds.length) {
      const { data: us } = await supabase.from('users').select('id, first_name, last_name').in('id', actorIds)
      names = Object.fromEntries(((us ?? []) as Array<{ id: string; first_name: string | null; last_name: string | null }>)
        .map(u => [u.id, `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim()]))
    }
    setLogs(raw.map(l => ({
      id: l.id, action: l.action, entity_type: l.entity_type, entity_id: l.entity_id, created_at: l.created_at,
      actor: l.actor_user_id ? (names[l.actor_user_id] || null) : null,
    })))
    setLoading(false)
  }, [])

  useEffect(() => { if (!isMockMode) load() }, [load])

  return (
    <section className="space-y-4">
      <div className="ui-panel">
        <div className="ui-panel-header flex items-center justify-between gap-3">
          <div>
            <div className="font-display text-xl">SAÚDE OPERACIONAL</div>
            <div className="font-mono text-[9px] text-paper/50">visão rápida do backend</div>
          </div>
          <button disabled={loading} onClick={load} className="btn-yellow text-[10px]">↺</button>
        </div>
        {loading ? (
          <div className="px-4 py-6 font-mono text-[11px] text-ink-4 animate-pulse">CARREGANDO...</div>
        ) : (
          <div className="grid gap-3 p-4 md:grid-cols-4">
            {health.map(item => (
              <KpiCard key={item.label} label={item.label} value={item.value} sub={item.sub} />
            ))}
          </div>
        )}
      </div>

      <div className="ui-panel">
        <div className="ui-panel-header">
          <div className="font-display text-xl">ATIVIDADE DO ADMIN</div>
          <div className="font-mono text-[9px] text-paper/50">resultados, papéis e bloqueios — sem o ruído dos palpites</div>
        </div>
        {logs.length === 0 ? (
          <div className="px-4 py-5 font-mono text-[11px] text-ink-4">Nenhuma ação registrada ainda.</div>
        ) : (
          <div className="divide-y divide-hairline max-h-[420px] overflow-y-auto">
            {logs.map(log => (
              <div key={log.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div className="min-w-0">
                  <div className="truncate font-mono text-[11px] font-bold">{AUDIT_LABELS[log.action] ?? log.action}</div>
                  <div className="truncate font-mono text-[9px] text-ink-4">
                    {log.entity_type === 'match' && log.entity_id ? matchLabel(log.entity_id) : (log.entity_id ?? log.entity_type ?? 'sistema')}
                    {log.actor ? ` · por ${log.actor}` : ''}
                  </div>
                </div>
                <span className="shrink-0 font-mono text-[9px] text-ink-4">
                  {new Date(log.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

// ─── Mobile ───────────────────────────────────────────────────────────────────

function AdminMobile() {
  const { kpis, filtered, filter, setFilter, stageFilter, setStageFilter, selectedGroup, setSelectedGroup, search, setSearch, toast, showToast } = useAdminData()
  const [activeTab, setActiveTab] = useState<AdminTab>('operation')

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
        <AdminTabBar active={activeTab} onChange={setActiveTab} />
      </div>

      {activeTab === 'comms' && (
        <div className="px-4 pt-3">
          <NoticesPanel onToast={showToast} />
        </div>
      )}

      {activeTab === 'people' && (
        <div className="px-4 pt-3">
          <ParticipantsPanel onToast={showToast} />
          <AdminRolesPanel onToast={showToast} />
        </div>
      )}

      {activeTab === 'health' && (
        <div className="px-4 pt-3">
          <AdminHealthPanel />
        </div>
      )}

      {activeTab === 'operation' && (
        <>
          <div className="px-4 pt-3">
            <MatchFilterControls
              filter={filter} setFilter={setFilter}
              stageFilter={stageFilter} setStageFilter={setStageFilter}
              selectedGroup={selectedGroup} setSelectedGroup={setSelectedGroup}
              search={search} setSearch={setSearch}
            />
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
        </>
      )}
    </div>
  )
}

// ─── Desktop ──────────────────────────────────────────────────────────────────

function AdminDesktop() {
  const { kpis, filtered, filter, setFilter, stageFilter, setStageFilter, selectedGroup, setSelectedGroup, search, setSearch, toast, showToast } = useAdminData()
  const [activeTab, setActiveTab] = useState<AdminTab>('operation')

  return (
    <div className="min-h-dvh bg-paper">
      <div className="app-shell py-8">

        <div className="flex items-center justify-between mb-6">
          <div>
            <Eyebrow>ADMIN · BOLÃO DA SUPREMA</Eyebrow>
            <h1 className="font-display text-4xl mt-1">PAINEL DE CONTROLE</h1>
          </div>
          <button onClick={() => exportRankingCsv()} className="btn-ghost">EXPORTAR RANKING (CSV) ↓</button>
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

        <AdminTabBar active={activeTab} onChange={setActiveTab} />

        {activeTab === 'comms' && <NoticesPanel onToast={showToast} />}
        {activeTab === 'people' && (
          <div className="grid gap-5 xl:grid-cols-2">
            <ParticipantsPanel onToast={showToast} />
            <AdminRolesPanel onToast={showToast} />
          </div>
        )}
        {activeTab === 'health' && <AdminHealthPanel />}

        {activeTab === 'operation' && (
          <div className="ui-panel">
            <div className="px-4 py-3 border-b border-hairline flex items-center justify-between gap-3">
              <span className="font-display text-lg">PARTIDAS</span>
              <span className="font-mono text-[10px] text-ink-3">{filtered.length} no filtro</span>
            </div>
            <div className="px-4 py-3 border-b border-hairline">
              <MatchFilterControls
                filter={filter} setFilter={setFilter}
                stageFilter={stageFilter} setStageFilter={setStageFilter}
                selectedGroup={selectedGroup} setSelectedGroup={setSelectedGroup}
                search={search} setSearch={setSearch}
              />
            </div>

            <div className="divide-y divide-hairline max-h-[620px] overflow-y-auto">
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
        )}
      </div>
    </div>
  )
}
