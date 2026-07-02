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
  adminSetUserRole,
  adminUpdatePrediction,
  adminDeletePrediction,
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
  extra?: { homeScore?: number; awayScore?: number; liveMinute?: string; winner?: string; lockReason?: string; decidedBy?: string }
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
  const [method, setMethod] = useState<'penalties' | 'extra_time' | null>(null)

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
    if (needsWinner && (!winnerPick || !method)) {
      onAction('Empate no tempo normal: escolha quem avançou E se foi pênaltis ou prorrogação.', false)
      return
    }
    setBusy(true)
    // Mata-mata empatado no tempo normal: settle_match_result gravaria winner='draw'
    // (não avança a chave nem pontua o "quem passa"). Usamos admin_update_match_status
    // com o vencedor + método (decided_by) → triggers apuram (o +2 sai em qualquer
    // empate; o método é só pra exibir "prorrogação" vs "pênaltis") + a próxima fase
    // preenche sozinha.
    if (needsWinner && winnerPick && method) {
      const err = await updateMatchStatus(matchCode, 'finished', { homeScore: homeGoals, awayScore: awayGoals, winner: winnerPick, decidedBy: method })
      if (err) {
        onAction(`Erro: ${err.message}`, false)
      } else {
        applyOverride({ matchCode, status: 'finished', marketStatus: 'settled', homeScore: homeGoals, awayScore: awayGoals })
        onAction(`✓ ${matchCode}: ${winnerPick} avançou (${method === 'penalties' ? 'pênaltis' : 'prorrogação'}) · palpites apurados`, true)
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
          {isKnockout && (
            <div className="font-mono text-[9px] leading-snug text-ink-3 border-l-2 border-green/60 pl-2">
              <strong className="text-ink-2">PLACAR DO TEMPO NORMAL (90 min).</strong> A prorrogação NÃO conta pro placar — se um jogo for pra prorrogação/pênaltis, digite o placar dos 90 min e escolha quem avançou abaixo.
            </div>
          )}
          <div className="flex items-end gap-3 flex-wrap">
            <div className="text-center">
              <div className="font-mono text-[8px] tracking-eyebrow text-ink-4 mb-1">CASA</div>
              <div className="flex items-center gap-1.5">
                <Flag team={homeTeam} size={16} />
                <span className="font-mono text-[11px] font-bold">{homeCode}</span>
                <input type="number" min={0} max={30} value={homeGoals}
                  onChange={e => { setHomeGoals(Math.max(0, parseInt(e.target.value) || 0)); setWinnerPick(null); setMethod(null) }}
                  className="w-12 border-2 border-ink text-center font-mono text-[15px] font-bold px-1 py-1 bg-yellow outline-none" />
              </div>
            </div>
            <span className="font-mono text-ink-4 pb-2">×</span>
            <div className="text-center">
              <div className="font-mono text-[8px] tracking-eyebrow text-ink-4 mb-1">FORA</div>
              <div className="flex items-center gap-1.5">
                <input type="number" min={0} max={30} value={awayGoals}
                  onChange={e => { setAwayGoals(Math.max(0, parseInt(e.target.value) || 0)); setWinnerPick(null); setMethod(null) }}
                  className="w-12 border-2 border-ink text-center font-mono text-[15px] font-bold px-1 py-1 bg-yellow outline-none" />
                <span className="font-mono text-[11px] font-bold">{awayCode}</span>
                <Flag team={awayTeam} size={16} />
              </div>
            </div>
          </div>

          {needsWinner && (
            <div className="border-2 border-yellow/70 bg-yellow/10 px-3 py-2 space-y-2">
              <div>
                <div className="font-mono text-[9px] tracking-eyebrow text-ink-2 mb-1.5">EMPATE NO TEMPO NORMAL — QUEM AVANÇOU?</div>
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
              <div>
                <div className="font-mono text-[9px] tracking-eyebrow text-ink-2 mb-1.5">COMO SE CLASSIFICOU? <span className="text-ink-4 normal-case tracking-normal">(só pra exibir; o +2 vale nos dois)</span></div>
                <div className="flex gap-2 flex-wrap">
                  <button type="button" onClick={() => setMethod('penalties')}
                    className={cn('border-2 px-3 py-1 font-mono text-[11px] font-bold transition-colors',
                      method === 'penalties' ? 'bg-ink border-ink text-paper' : 'border-ink/30 text-ink-3 hover:border-ink')}>
                    PÊNALTIS
                  </button>
                  <button type="button" onClick={() => setMethod('extra_time')}
                    className={cn('border-2 px-3 py-1 font-mono text-[11px] font-bold transition-colors',
                      method === 'extra_time' ? 'bg-ink border-ink text-paper' : 'border-ink/30 text-ink-3 hover:border-ink')}>
                    PRORROGAÇÃO
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button onClick={() => setEditResult(false)} className="btn-ghost text-[9px] px-2 py-1">CANCELAR</button>
            <button onClick={handleSetResult} disabled={busy || (needsWinner && (!winnerPick || !method))}
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
  // Exporta da MESMA fonte do ranking que os jogadores veem (current_ranking):
  // só ativos, com a pontuação oficial (jogos + especiais + mata-mata) e os
  // desempates. Antes somava predictions de TODOS os usuários (incl. pendentes/
  // bloqueados) → não batia com o ranking.
  const { data } = await supabase
    .from('current_ranking')
    .select('rank, first_name, last_name, dept, pts, correct, exact_score')
    .order('rank', { ascending: true })
  if (!data) return
  const rows = (data as Array<{ rank: number; first_name: string | null; last_name: string | null; dept: string | null; pts: number; correct: number; exact_score: number }>)
    .map(r => ({
      '#': r.rank,
      Nome: `${r.first_name ?? ''} ${r.last_name ?? ''}`.trim(),
      Setor: r.dept ?? '',
      Pontos: r.pts,
      Acertos: r.correct,
      Cravadas: r.exact_score,
    }))
  // downloadCsv já cuida de BOM (acentos), escape e CRLF → abre limpo no Excel.
  downloadCsv(`ranking-bolao-suprema-${new Date().toISOString().slice(0, 10)}.csv`, rows)
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

interface PersonRow {
  id: string
  first_name: string | null
  last_name: string | null
  dept: string | null
  email: string
  participant_status: string | null
  is_admin: boolean
  is_marketing: boolean
  is_owner: boolean
}

interface RankStat { rank: number; pts: number; correct: number; exact_score: number }

interface MatchResult {
  match_code: string
  home_code: string | null
  away_code: string | null
  home_score: number | null
  away_score: number | null
  winner: string | null
  stage: string
  group_code: string | null
  kickoff_utc: string | null
}

interface PredRow {
  id: string
  match_code: string
  home_score: number | null
  away_score: number | null
  points_earned: number | null
}

const personName = (p: PersonRow) => [p.first_name, p.last_name].filter(Boolean).join(' ') || p.email

function PeoplePanel({ onToast }: { onToast: (msg: string, ok: boolean) => void }) {
  const me = useAuthStore(s => s.user)
  const isOwner = me?.isOwner ?? false
  const [people, setPeople] = useState<PersonRow[]>([])
  const [ranks, setRanks] = useState<Record<string, RankStat>>({})
  const [results, setResults] = useState<Record<string, MatchResult>>({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [usersRes, rankRes, matchRes] = await Promise.all([
      supabase.from('users').select('id,first_name,last_name,dept,email,participant_status,is_admin,is_marketing,is_owner').order('first_name', { ascending: true }),
      supabase.from('current_ranking').select('user_id, rank, pts, correct, exact_score'),
      supabase.from('matches').select('match_code,home_code,away_code,home_score,away_score,winner,stage,group_code,kickoff_utc'),
    ])
    if (usersRes.error) onToast(`Erro ao carregar participantes: ${usersRes.error.message}`, false)
    setPeople((usersRes.data ?? []) as PersonRow[])
    const rk: Record<string, RankStat> = {}
    for (const r of (rankRes.data ?? []) as Array<{ user_id: string; rank: number; pts: number; correct: number; exact_score: number }>) {
      rk[r.user_id] = { rank: r.rank, pts: r.pts, correct: r.correct, exact_score: r.exact_score }
    }
    setRanks(rk)
    const rs: Record<string, MatchResult> = {}
    for (const m of (matchRes.data ?? []) as MatchResult[]) rs[m.match_code] = m
    setResults(rs)
    setLoading(false)
  }, [onToast])

  useEffect(() => { if (!isMockMode) load() }, [load])

  const ptsOf = (id: string) => ranks[id]?.pts ?? 0
  const q = query.trim().toLowerCase()
  const visible = people
    .filter(p => !q || `${personName(p)} ${p.email} ${p.dept ?? ''}`.toLowerCase().includes(q))
    .sort((a, b) => ptsOf(b.id) - ptsOf(a.id))
  const selected = people.find(p => p.id === selectedId) ?? null
  const total = people.length
  const blocked = people.filter(p => p.participant_status === 'blocked').length

  async function toggleBlock(p: PersonRow) {
    setBusy(p.id + 'block')
    const newStatus = p.participant_status === 'blocked' ? 'active' : 'blocked'
    const { error } = await supabase.rpc('update_participant_status', { p_user_id: p.id, p_status: newStatus })
    if (error) onToast(`Erro: ${error.message}`, false)
    else { onToast(`✓ ${personName(p)} → ${newStatus === 'blocked' ? 'BLOQUEADO' : 'ATIVO'}`, true); await load() }
    setBusy(null)
  }

  async function toggleRole(p: PersonRow, field: 'is_admin' | 'is_marketing') {
    if (!isOwner) { onToast('Apenas o proprietário pode alterar papéis.', false); return }
    setBusy(p.id + field)
    const res = await adminSetUserRole(p.id, field === 'is_admin' ? { isAdmin: !p.is_admin } : { isMarketing: !p.is_marketing })
    if (res.error) onToast(`Erro: ${res.error}`, false)
    else { onToast('✓ Papel atualizado', true); await load() }
    setBusy(null)
  }

  function exportCsv() {
    const rows = [...people]
      .sort((a, b) => ptsOf(b.id) - ptsOf(a.id))
      .map(p => ({
        Nome: personName(p),
        Setor: p.dept ?? '',
        Email: p.email,
        Status: p.participant_status ?? '',
        Pontos: ranks[p.id]?.pts ?? 0,
        Acertos: ranks[p.id]?.correct ?? 0,
      }))
    downloadCsv(`participantes-bolao-suprema-${new Date().toISOString().slice(0, 10)}.csv`, rows)
  }

  return (
    <section className="grid gap-4 lg:grid-cols-[330px_1fr]">
      {/* Lista (mestre) */}
      <div className="ui-panel flex flex-col">
        <div className="ui-panel-header flex items-center justify-between gap-3">
          <div>
            <div className="font-display text-lg">PARTICIPANTES</div>
            <div className="font-mono text-[9px] text-paper/55">{total} · {blocked} bloqueados</div>
          </div>
          <div className="flex gap-2">
            <button onClick={exportCsv} className="btn-ghost text-[9px]">CSV ↓</button>
            <button disabled={loading} onClick={load} className="btn-yellow text-[10px]">↺</button>
          </div>
        </div>
        <div className="border-b border-hairline p-3">
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar por nome, e-mail ou setor…"
            className="w-full border-2 border-hairline bg-card px-3 py-2 font-mono text-[11px] outline-none focus:border-ink" />
        </div>
        <div className="max-h-[200px] divide-y divide-hairline overflow-y-auto lg:max-h-[560px]">
          {loading && <div className="px-4 py-6 text-center font-mono text-[11px] text-ink-4 animate-pulse">CARREGANDO…</div>}
          {!loading && visible.length === 0 && <div className="px-4 py-6 text-center font-mono text-[11px] text-ink-4">Ninguém encontrado.</div>}
          {visible.map(p => {
            const sel = p.id === selectedId
            const isBlocked = p.participant_status === 'blocked'
            return (
              <button key={p.id} onClick={() => setSelectedId(p.id)}
                className={cn('flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors', sel ? 'bg-ink text-paper' : 'hover:bg-surface-hover')}>
                <span className={cn('w-7 flex-none text-right font-display text-[15px] tabular-nums', sel ? 'text-yellow' : 'text-ink-4')}>{ranks[p.id]?.rank ?? '—'}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 truncate font-mono text-[11px] font-bold">
                    {personName(p)}
                    {isBlocked && <span className={cn('h-1.5 w-1.5 flex-none rounded-full', sel ? 'bg-red/80' : 'bg-red')} title="bloqueado" />}
                  </span>
                  <span className={cn('block truncate font-mono text-[9px]', sel ? 'text-paper/55' : 'text-ink-4')}>{p.dept || '—'}</span>
                </span>
                <span className="font-display text-[16px] tabular-nums">{ranks[p.id]?.pts ?? 0}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Detalhe */}
      <div className="ui-panel">
        {!selected ? (
          <div className="flex h-full min-h-[260px] flex-col items-center justify-center gap-2 p-8 text-center">
            <span className="font-display text-3xl text-ink-4">☰</span>
            <p className="font-mono text-[11px] text-ink-3">Escolha um participante para ver o perfil e os palpites.</p>
          </div>
        ) : (
          <ParticipantDetail
            key={selected.id}
            person={selected}
            stat={ranks[selected.id]}
            results={results}
            isOwner={isOwner}
            busy={busy}
            onBlock={() => toggleBlock(selected)}
            onRole={f => toggleRole(selected, f)}
            onToast={onToast}
          />
        )}
      </div>
    </section>
  )
}

function ParticipantDetail({ person, stat, results, isOwner, busy, onBlock, onRole, onToast }: {
  person: PersonRow
  stat?: RankStat
  results: Record<string, MatchResult>
  isOwner: boolean
  busy: string | null
  onBlock: () => void
  onRole: (field: 'is_admin' | 'is_marketing') => void
  onToast: (msg: string, ok: boolean) => void
}) {
  const [preds, setPreds] = useState<PredRow[] | null>(null)
  const [predQuery, setPredQuery] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [editHome, setEditHome] = useState(0)
  const [editAway, setEditAway] = useState(0)
  const [confirmDel, setConfirmDel] = useState<string | null>(null)
  const [rowBusy, setRowBusy] = useState<string | null>(null)

  const loadPreds = useCallback(() => {
    if (isMockMode) { setPreds([]); return }
    supabase.from('predictions').select('id,match_code,home_score,away_score,points_earned').eq('user_id', person.id)
      .then(({ data }) => setPreds((data ?? []) as PredRow[]))
  }, [person.id])

  useEffect(() => { loadPreds() }, [loadPreds])

  function startEdit(p: PredRow) {
    setConfirmDel(null)
    setEditId(p.id)
    setEditHome(p.home_score ?? 0)
    setEditAway(p.away_score ?? 0)
  }

  async function saveEdit(id: string) {
    setRowBusy(id)
    const res = await adminUpdatePrediction(id, editHome, editAway)
    setRowBusy(null)
    if (res.error) { onToast(`Erro: ${res.error}`, false); return }
    setEditId(null)
    onToast('✓ Palpite atualizado', true)
    loadPreds()
  }

  async function doDelete(id: string) {
    setRowBusy(id)
    const res = await adminDeletePrediction(id)
    setRowBusy(null)
    if (res.error) { onToast(`Erro: ${res.error}`, false); return }
    setConfirmDel(null)
    onToast('✓ Palpite apagado', true)
    loadPreds()
  }

  const initials = `${person.first_name?.[0] ?? ''}${person.last_name?.[0] ?? ''}`.toUpperCase() || person.email[0]?.toUpperCase() || '?'
  const isBlocked = person.participant_status === 'blocked'

  const pq = predQuery.trim().toLowerCase()
  const enriched = (preds ?? [])
    .map(p => ({ p, m: results[p.match_code] as MatchResult | undefined }))
    .filter(({ p, m }) => {
      if (!pq) return true
      const teams = m && m.home_code && m.away_code ? `${m.home_code} ${m.away_code}` : ''
      return `${matchLabel(p.match_code)} ${teams}`.toLowerCase().includes(pq)
    })
    .sort((a, b) => (b.m?.kickoff_utc ?? '').localeCompare(a.m?.kickoff_utc ?? ''))
  const koRows = enriched.filter(({ m }) => m && m.stage !== 'group')
  const groupRows = enriched.filter(({ m }) => !m || m.stage === 'group')

  const teamsOf = (code: string, m?: MatchResult) =>
    m && m.home_code && m.away_code && m.home_code !== 'TBD' && m.away_code !== 'TBD' ? `${m.home_code} × ${m.away_code}` : matchLabel(code)
  const resultOf = (m?: MatchResult) => {
    if (!m || m.home_score == null || m.away_score == null) return '—'
    const base = `${m.home_score}–${m.away_score}`
    return m.stage !== 'group' && m.winner && m.winner !== 'draw' ? `${base} · ${m.winner} passou` : base
  }
  const isExact = (p: PredRow, m?: MatchResult) =>
    m && m.home_score != null && p.home_score === m.home_score && p.away_score === m.away_score

  const Table = ({ rows }: { rows: typeof enriched }) => (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-hairline">
            <th className="px-4 py-1.5 text-left font-mono text-[8px] tracking-eyebrow text-ink-4">Jogo</th>
            <th className="px-2 py-1.5 text-left font-mono text-[8px] tracking-eyebrow text-ink-4">Palpite</th>
            <th className="px-2 py-1.5 text-left font-mono text-[8px] tracking-eyebrow text-ink-4">Resultado</th>
            <th className="px-4 py-1.5 text-right font-mono text-[8px] tracking-eyebrow text-ink-4">Pts</th>
            <th className="px-3 py-1.5 text-right font-mono text-[8px] tracking-eyebrow text-ink-4">Ações</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ p, m }) => {
            const editing = editId === p.id
            const rBusy = rowBusy === p.id
            return (
            <tr key={p.id} className="border-b border-hairline last:border-0">
              <td className="px-4 py-2 font-mono text-[12px] font-bold">{teamsOf(p.match_code, m)}</td>
              <td className="px-2 py-2 font-mono text-[12px]">
                {editing ? (
                  <span className="inline-flex items-center gap-1">
                    <input type="number" min={0} max={30} value={editHome} onChange={e => setEditHome(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-10 border border-ink bg-yellow text-center font-mono text-[12px] px-0.5 py-0.5 outline-none" />
                    <span className="text-ink-4">–</span>
                    <input type="number" min={0} max={30} value={editAway} onChange={e => setEditAway(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-10 border border-ink bg-yellow text-center font-mono text-[12px] px-0.5 py-0.5 outline-none" />
                  </span>
                ) : (
                  <>{p.home_score ?? '?'}–{p.away_score ?? '?'}</>
                )}
              </td>
              <td className="px-2 py-2 font-mono text-[11px] text-ink-3">{resultOf(m)}</td>
              <td className="px-4 py-2 text-right">
                {p.points_earned == null
                  ? <span className="font-mono text-[10px] text-ink-4">—</span>
                  : (
                    <span className="inline-flex items-center gap-1.5">
                      {isExact(p, m) && <span className="bg-green px-1.5 py-0.5 font-mono text-[8px] font-bold text-white">CRAVOU</span>}
                      <span className={cn('font-display text-[16px] tabular-nums', p.points_earned > 0 ? 'text-green' : 'text-ink-4')}>{p.points_earned}</span>
                    </span>
                  )}
              </td>
              <td className="px-3 py-2 text-right whitespace-nowrap">
                {editing ? (
                  <span className="inline-flex gap-1">
                    <button onClick={() => saveEdit(p.id)} disabled={rBusy} className="btn-yellow text-[8px] px-2 py-1 disabled:opacity-40">{rBusy ? '…' : 'SALVAR'}</button>
                    <button onClick={() => setEditId(null)} disabled={rBusy} className="btn-ghost text-[8px] px-2 py-1">CANCELAR</button>
                  </span>
                ) : confirmDel === p.id ? (
                  <span className="inline-flex gap-1">
                    <button onClick={() => doDelete(p.id)} disabled={rBusy} className="bg-red text-white font-mono text-[8px] font-bold px-2 py-1 disabled:opacity-40">{rBusy ? '…' : 'CONFIRMAR'}</button>
                    <button onClick={() => setConfirmDel(null)} disabled={rBusy} className="btn-ghost text-[8px] px-2 py-1">NÃO</button>
                  </span>
                ) : (
                  <span className="inline-flex gap-1">
                    <button onClick={() => startEdit(p)} className="btn-ghost text-[8px] px-2 py-1" title="editar o palpite">EDITAR</button>
                    <button onClick={() => { setEditId(null); setConfirmDel(p.id) }} className="font-mono text-[8px] font-bold text-red border border-red/40 px-2 py-1 hover:bg-red/10" title="apagar o palpite">APAGAR</button>
                  </span>
                )}
              </td>
            </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )

  return (
    <div className="flex flex-col">
      {/* Cabeçalho */}
      <div className="flex items-center gap-3.5 border-b-2 border-ink bg-ink p-4 text-paper">
        <div className="grid h-12 w-12 flex-none place-items-center rounded-full font-display text-xl text-white" style={{ background: person.is_owner ? '#FFCB05' : '#C97B4A', color: person.is_owner ? '#0D0D0D' : '#fff' }}>{initials}</div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-2xl leading-none">{personName(person)}</div>
          <div className="mt-1 truncate font-mono text-[10px] text-paper/60">{person.dept || '—'} · {person.email} · {isBlocked ? 'bloqueado' : 'ativo'}</div>
        </div>
        <button disabled={busy === person.id + 'block'} onClick={onBlock}
          className={cn('flex-none border-2 px-3 py-1.5 font-mono text-[10px] font-bold transition-colors',
            isBlocked ? 'border-green bg-green/10 text-green' : 'border-paper/40 text-paper hover:bg-paper/10')}>
          {isBlocked ? 'DESBLOQUEAR' : 'BLOQUEAR'}
        </button>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-4 border-b border-hairline">
        {[
          { l: 'Ranking', v: stat ? `${stat.rank}º` : '—' },
          { l: 'Pontos', v: stat?.pts ?? 0 },
          { l: 'Acertos', v: stat?.correct ?? 0 },
          { l: 'Cravadas', v: stat?.exact_score ?? 0 },
        ].map((s, i) => (
          <div key={s.l} className={cn('px-3 py-2.5', i < 3 && 'border-r border-hairline')}>
            <div className="font-display text-2xl leading-none tabular-nums">{s.v}</div>
            <div className="mt-1 font-mono text-[8px] tracking-eyebrow text-ink-4">{s.l.toUpperCase()}</div>
          </div>
        ))}
      </div>

      {/* Papéis (somente owner) */}
      {isOwner && !person.is_owner && (
        <div className="flex items-center gap-2 border-b border-hairline px-4 py-2.5">
          <span className="font-mono text-[8px] tracking-eyebrow text-ink-4">PAPÉIS</span>
          <button disabled={busy === person.id + 'is_admin'} onClick={() => onRole('is_admin')}
            className={cn('border-2 px-2.5 py-1 font-mono text-[9px] font-bold', person.is_admin ? 'border-red bg-red/10 text-red' : 'border-hairline text-ink-3 hover:border-ink')}>
            {person.is_admin ? '− ADMIN' : '+ ADMIN'}
          </button>
          <button disabled={busy === person.id + 'is_marketing'} onClick={() => onRole('is_marketing')}
            className={cn('border-2 px-2.5 py-1 font-mono text-[9px] font-bold', person.is_marketing ? 'border-green bg-green/10 text-green' : 'border-hairline text-ink-3 hover:border-ink')}>
            {person.is_marketing ? '− MKT' : '+ MKT'}
          </button>
        </div>
      )}

      {/* Palpites */}
      <div className="border-b border-hairline p-3">
        <input value={predQuery} onChange={e => setPredQuery(e.target.value)} placeholder="Buscar palpite por time…"
          className="w-full border-2 border-hairline bg-card px-3 py-1.5 font-mono text-[11px] outline-none focus:border-ink" />
      </div>

      <div className="max-h-[420px] overflow-y-auto">
        {preds == null ? (
          <div className="px-4 py-6 text-center font-mono text-[11px] text-ink-4 animate-pulse">CARREGANDO PALPITES…</div>
        ) : enriched.length === 0 ? (
          <div className="px-4 py-6 text-center font-mono text-[11px] text-ink-4">Nenhum palpite{predQuery ? ' com esse filtro' : ''}.</div>
        ) : (
          <>
            {koRows.length > 0 && <>
              <div className="bg-paper-deep px-4 py-1.5 font-mono text-[9px] tracking-eyebrow text-ink-3">MATA-MATA</div>
              {Table({ rows: koRows })}
            </>}
            {groupRows.length > 0 && <>
              <div className="bg-paper-deep px-4 py-1.5 font-mono text-[9px] tracking-eyebrow text-ink-3">FASE DE GRUPOS</div>
              {Table({ rows: groupRows })}
            </>}
          </>
        )}
      </div>
    </div>
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
          <PeoplePanel onToast={showToast} />
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
        {activeTab === 'people' && <PeoplePanel onToast={showToast} />}
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
