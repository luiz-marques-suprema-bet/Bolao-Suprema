import { useEffect, useState, useMemo, useCallback } from 'react'
import { useParams, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Flag } from '@/components/shared/Flag'
import { Tooltip } from '@/components/shared/Tooltip'
import { usePredictionStore } from '@/stores/prediction.store'
import { useIsDesktop } from '@/hooks/useBreakpoint'
import { WC2026_MATCHES, WC2026_GROUPS } from '@/data/wc2026'
import { TEAMS } from '@/data/teams'
import { clamp, cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth.store'
import { useMatchesWithStatus } from '@/hooks/useMatchWithStatus'
import { formatMatchDate, formatMatchDateTime, getBettingDeadline } from '@/lib/matchTime'
import { isBetOpen } from '@/lib/markets'
import { getGroupOfTeam } from '@/lib/tournamentValidation'
import type { Match } from '@/types'

type PredTab = 'groups' | 'knockout' | 'champion'

const GROUP_LABELS = ['A','B','C','D','E','F','G','H','I','J','K','L'] as const

// ─── Standings engine ─────────────────────────────────────────────────────────

interface StandingRow {
  code: string
  pts: number
  gf: number
  ga: number
  gd: number
  w: number
  d: number
  l: number
  mp: number
}

function computeStandings(
  groupCode: string,
  predictions: Record<string, { homeScore: number; awayScore: number }>,
  allMatches: Match[]
): StandingRow[] {
  const groupDef = WC2026_GROUPS.find(g => g.id === groupCode)
  if (!groupDef) return []

  const rows: Record<string, StandingRow> = {}
  for (const code of groupDef.teams) {
    rows[code] = { code, pts: 0, gf: 0, ga: 0, gd: 0, w: 0, d: 0, l: 0, mp: 0 }
  }

  const matches = allMatches.filter(m => m.group === groupCode)

  for (const m of matches) {
    const pred = predictions[m.id]
    let hg: number | null = null
    let ag: number | null = null

    if (m.status === 'finished' || m.status === 'live') {
      hg = m.homeScore
      ag = m.awayScore
    } else if (pred) {
      hg = pred.homeScore
      ag = pred.awayScore
    }

    if (hg === null || ag === null) continue

    const home = rows[m.home.code]
    const away = rows[m.away.code]
    if (!home || !away) continue

    home.mp++; away.mp++
    home.gf += hg; home.ga += ag
    away.gf += ag; away.ga += hg
    home.gd = home.gf - home.ga
    away.gd = away.gf - away.ga

    if (hg > ag) {
      home.pts += 3; home.w++; away.l++
    } else if (hg === ag) {
      home.pts += 1; away.pts += 1; home.d++; away.d++
    } else {
      away.pts += 3; away.w++; home.l++
    }
  }

  return Object.values(rows).sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts
    if (b.gd !== a.gd) return b.gd - a.gd
    return b.gf - a.gf
  })
}

function computeGroupTop2(
  groupCode: string,
  predictions: Record<string, { homeScore: number; awayScore: number }>,
  allMatches: Match[]
): [string | null, string | null] {
  const sorted = computeStandings(groupCode, predictions, allMatches)
  return [sorted[0]?.code ?? null, sorted[1]?.code ?? null]
}

// ─── Score input — horizontal +/– ────────────────────────────────────────────

function ScoreInput({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center">
      <button
        onClick={() => onChange(clamp(value - 1, 0, 9))}
        disabled={value === 0}
        className="w-11 h-11 flex items-center justify-center border-2 border-r-0 border-ink font-mono text-2xl font-bold hover:bg-yellow active:bg-yellow transition-colors disabled:opacity-25 disabled:cursor-not-allowed select-none"
        aria-label="diminuir"
      >−</button>
      <div className="w-12 h-11 flex items-center justify-center border-2 border-ink bg-paper font-display text-3xl leading-none select-none">
        {value}
      </div>
      <button
        onClick={() => onChange(clamp(value + 1, 0, 9))}
        className="w-11 h-11 flex items-center justify-center border-2 border-l-0 border-ink font-mono text-2xl font-bold hover:bg-yellow active:bg-yellow transition-colors select-none"
        aria-label="aumentar"
      >+</button>
    </div>
  )
}

// ─── Status chip ──────────────────────────────────────────────────────────────

function StatusChip({ match }: { match: Match }) {
  if (match.status === 'live') {
    return (
      <Tooltip content="Partida em andamento — palpites encerrados" side="top">
        <span className="inline-flex items-center gap-1 font-mono text-[8px] font-bold tracking-eyebrow text-red cursor-default">
          <span className="w-1.5 h-1.5 rounded-full bg-red animate-pulse-live" />
          {match.liveMinute ? `${match.liveMinute}'` : 'AO VIVO'}
        </span>
      </Tooltip>
    )
  }
  if (match.status === 'finished') {
    return (
      <Tooltip content="Partida encerrada — resultado oficial registrado e pontos calculados" side="top">
        <span className="font-mono text-[8px] tracking-eyebrow text-ink-3 cursor-default">ENCERRADO</span>
      </Tooltip>
    )
  }
  if (match.status === 'locked') {
    return (
      <Tooltip content="Prazo encerrado — apostas não são mais aceitas para esta partida" side="top">
        <span className="font-mono text-[8px] tracking-eyebrow text-ink-3 cursor-default">■ BLOQUEADO</span>
      </Tooltip>
    )
  }
  return (
    <Tooltip content="Apostas abertas! Clique na partida para registrar seu palpite antes do prazo" side="top">
      <span className="font-mono text-[8px] tracking-eyebrow text-green font-bold cursor-default">ABERTO</span>
    </Tooltip>
  )
}

// ─── Match row ────────────────────────────────────────────────────────────────

function MatchRow({ match, onConfirmed }: { match: Match; onConfirmed?: () => void }) {
  const { predictions, drafts, setDraft, clearDraft, confirmPrediction } = usePredictionStore()
  const userId = useAuthStore(s => s.user?.id ?? 'me')
  const existing = predictions[match.id]
  const draft = drafts[match.id]

  const [editing, setEditing] = useState(false)
  const [home, setHome] = useState(draft?.home ?? existing?.homeScore ?? 0)
  const [away, setAway] = useState(draft?.away ?? existing?.awayScore ?? 0)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const isPickable = isBetOpen(match)
  const isLocked = match.status === 'locked' || (!isPickable && (match.status === 'open' || match.status === 'scheduled'))
  const isLive = match.status === 'live'
  const isDone = match.status === 'finished'
  const hasPick = !!existing

  useEffect(() => {
    if (!hasPick) return
    if (editing) return
    setHome(existing?.homeScore ?? 0)
    setAway(existing?.awayScore ?? 0)
  }, [existing?.homeScore, existing?.awayScore, editing, hasPick])

  const updateHome = (value: number) => {
    setHome(value)
    setDraft(match.id, value, away)
  }

  const updateAway = (value: number) => {
    setAway(value)
    setDraft(match.id, home, value)
  }

  const handleConfirm = async () => {
    setSaveError(null)
    setSaving(true)
    const result = await confirmPrediction({
      id: `pred-${match.id}`,
      userId,
      matchId: match.id,
      homeScore: home,
      awayScore: away,
      submittedAt: new Date().toISOString(),
    })
    setSaving(false)
    if (!result.ok) {
      setSaveError(result.error ?? 'Erro ao salvar palpite.')
      return
    }
    clearDraft(match.id)
    setEditing(false)
    onConfirmed?.()
  }

  const handleEdit = () => {
    if (!isPickable || !hasPick) return
    if (!editing) {
      setHome(draft?.home ?? existing!.homeScore)
      setAway(draft?.away ?? existing!.awayScore)
    }
    setEditing(v => !v)
  }

  const pickerContent = (
    <div className="px-4 pt-5 pb-5 bg-paper-deep border-t border-hairline">
      <p className="font-mono text-[10px] tracking-eyebrow text-ink text-center mb-1 font-bold">
        QUAL VAI SER O PLACAR?
      </p>
      <p className="font-mono text-[9px] text-ink-2 text-center mb-5">
        {match.venue} · {formatMatchDateTime(match)}
      </p>

      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col items-center gap-2 flex-1">
          <Flag team={match.home} size={44} />
          <span className="font-mono text-[9px] font-bold text-center leading-tight">
            {match.home.name.toUpperCase()}
          </span>
          <ScoreInput value={home} onChange={updateHome} />
        </div>

        <span className="font-serif-it text-3xl text-ink-3 flex-shrink-0 mb-6">×</span>

        <div className="flex flex-col items-center gap-2 flex-1">
          <Flag team={match.away} size={44} />
          <span className="font-mono text-[9px] font-bold text-center leading-tight">
            {match.away.name.toUpperCase()}
          </span>
          <ScoreInput value={away} onChange={updateAway} />
        </div>
      </div>

      {saveError && (
        <p className="font-mono text-[10px] text-red text-center mt-3 border border-red/30 bg-red/5 px-2 py-1.5">
          {saveError}
        </p>
      )}

      <button
        onClick={handleConfirm}
        disabled={saving}
        className="btn-yellow w-full text-[11px] py-3 mt-3 tracking-eyebrow font-bold disabled:opacity-50 disabled:cursor-wait"
      >
        {saving ? 'SALVANDO...' : hasPick ? 'ATUALIZAR PALPITE ✓' : 'CONFIRMAR PALPITE ✓'}
      </button>
    </div>
  )

  return (
    <div
      id={`match-row-${match.id}`}
      className={cn(
        'border-b border-hairline last:border-0 transition-colors',
        hasPick && isPickable ? 'bg-green/[0.04]' : '',
      )}
    >
      {/* Match header */}
      <button
        onClick={handleEdit}
        className={cn(
          'w-full px-4 py-3.5 flex items-center gap-3 text-left',
          isPickable && hasPick ? 'cursor-pointer hover:bg-paper-deep' : 'cursor-default',
        )}
      >
        {/* Home */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Flag team={match.home} size={32} />
          <div className="min-w-0">
            <div className="font-mono text-[11px] font-bold leading-tight">{match.home.code}</div>
            <div className="font-mono text-[9px] text-ink-2 truncate leading-tight">
              {match.home.name}
            </div>
          </div>
        </div>

        {/* Center */}
        <div className="flex flex-col items-center gap-0.5 flex-shrink-0 min-w-[80px]">
          {isLive && (
            <span className="font-display text-xl">{match.homeScore}–{match.awayScore}</span>
          )}
          {isDone && (
            <span className="font-display text-xl text-ink-3">{match.homeScore}–{match.awayScore}</span>
          )}
          {isLocked && !isLive && !isDone && (
            hasPick
              ? <span className="font-display text-xl text-green">{existing.homeScore}–{existing.awayScore}</span>
              : <span className="font-mono text-[9px] text-ink-3">sem palpite</span>
          )}
          {!isLive && !isDone && !isLocked && hasPick && (
            <div className="flex items-center gap-1">
              <span className="font-display text-xl text-green">{existing.homeScore}–{existing.awayScore}</span>
              <span className="font-mono text-[10px] text-green">✓</span>
            </div>
          )}
          {!isLive && !isDone && !isLocked && !hasPick && (
            <div className="flex flex-col items-center">
              <span className="font-mono text-[9px] text-ink-3">{formatMatchDate(match)}</span>
              <span className="font-mono text-[8px] text-ink-2 font-bold">{match.time} BRT</span>
            </div>
          )}
          <StatusChip match={match} />
        </div>

        {/* Away */}
        <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
          <div className="min-w-0 text-right">
            <div className="font-mono text-[11px] font-bold leading-tight">{match.away.code}</div>
            <div className="font-mono text-[9px] text-ink-2 truncate leading-tight">
              {match.away.name}
            </div>
          </div>
          <Flag team={match.away} size={32} />
        </div>

        {isPickable && hasPick && (
          <span className="font-mono text-[9px] text-ink-3 flex-shrink-0 w-3 text-center">
            {editing ? '▲' : '✎'}
          </span>
        )}
      </button>

      {/* Always-visible picker for open matches without a confirmed pick */}
      {isPickable && !hasPick && pickerContent}

      {/* Animated picker for editing an existing confirmed pick */}
      <AnimatePresence>
        {isPickable && hasPick && editing && (
          <motion.div
            key="picker"
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            transition={{ type: 'spring', damping: 32, stiffness: 400 }}
            className="overflow-hidden"
          >
            {pickerContent}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Mini-standings ───────────────────────────────────────────────────────────

function MiniStandings({ standings, totalMatches, filledMatches }: {
  standings: StandingRow[]
  totalMatches: number
  filledMatches: number
}) {
  if (filledMatches === 0) return null

  const classified = standings.slice(0, 2)
  const thirdPlace = standings[2]
  const eliminated = standings.slice(3)

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="mx-4 mb-4 ui-panel overflow-hidden"
    >
      <div className="px-3 py-2 bg-ink flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[9px] tracking-eyebrow text-paper/70">QUEM PASSA?</span>
          <span className="font-mono text-[8px] text-paper/50">2 diretos + melhores 3ºs</span>
        </div>
        <span className="font-mono text-[8px] text-yellow font-bold">
          {filledMatches === totalMatches ? '✓ COMPLETO' : `${filledMatches}/${totalMatches} jogos`}
        </span>
      </div>

      {/* Header */}
      <div className="grid grid-cols-[1fr_36px_28px_36px] px-3 py-1.5 border-b border-hairline bg-paper-deep">
        <span className="font-mono text-[8px] text-ink-3">SELEÇÃO</span>
        <span className="font-mono text-[8px] text-ink-3 text-center">PTS</span>
        <span className="font-mono text-[8px] text-ink-3 text-center">J</span>
        <span className="font-mono text-[8px] text-ink-3 text-center">SALDO</span>
      </div>

      {classified.map((row, i) => (
        <div
          key={row.code}
          className="grid grid-cols-[1fr_36px_28px_36px] px-3 py-2.5 border-b border-hairline bg-green/5 items-center"
        >
          <div className="flex items-center gap-2">
            <span className="font-mono text-[9px] text-green font-bold w-4">{i + 1}°</span>
            <Flag team={TEAMS[row.code]} size={18} />
            <span className="font-mono text-[10px] font-bold">{row.code}</span>
            <span className="font-mono text-[7px] text-green border border-green/30 px-1 py-px">↑</span>
          </div>
          <span className="font-display text-sm text-ink text-center">{row.pts}</span>
          <span className="font-mono text-[9px] text-ink-3 text-center">{row.mp}</span>
          <span className={cn(
            'font-mono text-[9px] text-center',
            row.gd > 0 ? 'text-green' : row.gd < 0 ? 'text-red' : 'text-ink-4'
          )}>
            {row.gd > 0 ? `+${row.gd}` : row.gd}
          </span>
        </div>
      ))}

      {thirdPlace && (
        <div className="grid grid-cols-[1fr_36px_28px_36px] px-3 py-2.5 border-b border-hairline bg-yellow/10 items-center">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[9px] text-ink font-bold w-4">3°</span>
            <Flag team={TEAMS[thirdPlace.code]} size={18} />
            <span className="font-mono text-[10px] font-bold">{thirdPlace.code}</span>
            <span className="font-mono text-[7px] text-ink border border-yellow/60 px-1 py-px">melhor 3º</span>
          </div>
          <span className="font-display text-sm text-ink text-center">{thirdPlace.pts}</span>
          <span className="font-mono text-[9px] text-ink-2 text-center">{thirdPlace.mp}</span>
          <span className={cn(
            'font-mono text-[9px] text-center',
            thirdPlace.gd > 0 ? 'text-green' : thirdPlace.gd < 0 ? 'text-red' : 'text-ink-3'
          )}>
            {thirdPlace.gd > 0 ? `+${thirdPlace.gd}` : thirdPlace.gd}
          </span>
        </div>
      )}

      <div className="px-3 py-1 flex items-center gap-2">
        <div className="flex-1 h-px bg-hairline" />
        <span className="font-mono text-[7px] text-ink-3 tracking-eyebrow">fora da zona</span>
        <div className="flex-1 h-px bg-hairline" />
      </div>

      {eliminated.map((row, i) => (
        <div
          key={row.code}
          className="grid grid-cols-[1fr_36px_28px_36px] px-3 py-2 border-t border-hairline last:border-0 opacity-40 items-center"
        >
          <div className="flex items-center gap-2">
            <span className="font-mono text-[9px] text-ink-4 w-4">{i + 3}°</span>
            <Flag team={TEAMS[row.code]} size={18} />
            <span className="font-mono text-[10px]">{row.code}</span>
          </div>
          <span className="font-display text-sm text-ink-3 text-center">{row.pts}</span>
          <span className="font-mono text-[9px] text-ink-3 text-center">{row.mp}</span>
          <span className="font-mono text-[9px] text-ink-3 text-center">
            {row.gd > 0 ? `+${row.gd}` : row.gd}
          </span>
        </div>
      ))}
    </motion.div>
  )
}

// ─── Compact match row (group stage) ─────────────────────────────────────────

function CompactMatchRow({ match, onConfirmed }: { match: Match; onConfirmed?: () => void }) {
  const { predictions, drafts, setDraft, clearDraft, confirmPrediction } = usePredictionStore()
  const userId = useAuthStore(s => s.user?.id ?? 'me')
  const existing = predictions[match.id]
  const draft = drafts[match.id]

  const [editing, setEditing] = useState(false)
  const [home, setHome] = useState(draft?.home ?? existing?.homeScore ?? 0)
  const [away, setAway] = useState(draft?.away ?? existing?.awayScore ?? 0)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const isPickable = isBetOpen(match)
  const isLocked = match.status === 'locked' || (!isPickable && (match.status === 'open' || match.status === 'scheduled'))
  const isLive = match.status === 'live'
  const isDone = match.status === 'finished'
  const hasPick = !!existing

  useEffect(() => {
    if (!hasPick) return
    if (editing) return
    setHome(existing?.homeScore ?? 0)
    setAway(existing?.awayScore ?? 0)
  }, [existing?.homeScore, existing?.awayScore, editing, hasPick])

  const updateHome = (v: number) => { setHome(v); setDraft(match.id, v, away) }
  const updateAway = (v: number) => { setAway(v); setDraft(match.id, home, v) }

  const handleConfirm = async () => {
    setSaveError(null)
    setSaving(true)
    const result = await confirmPrediction({
      id: `pred-${match.id}`,
      userId,
      matchId: match.id,
      homeScore: home,
      awayScore: away,
      submittedAt: new Date().toISOString(),
    })
    setSaving(false)
    if (!result.ok) { setSaveError(result.error ?? 'Erro ao salvar.'); return }
    clearDraft(match.id)
    setEditing(false)
    onConfirmed?.()
  }

  const handleHeaderClick = () => {
    if (!isPickable || !hasPick) return
    if (!editing) {
      setHome(draft?.home ?? existing!.homeScore)
      setAway(draft?.away ?? existing!.awayScore)
    }
    setEditing(v => !v)
  }

  const showInputs = isPickable && (!hasPick || editing)

  return (
    <div
      id={`match-row-${match.id}`}
      className={cn(
        'border-b border-hairline last:border-0',
        hasPick && isPickable ? 'bg-green/[0.04]' : '',
      )}
    >
      {/* Info row — grid garante espaço igual para os dois times */}
      <div
        onClick={handleHeaderClick}
        className={cn(
          'px-3 py-3 grid grid-cols-[1fr_80px_1fr] items-center gap-x-2',
          isPickable && hasPick ? 'cursor-pointer hover:bg-paper-deep transition-colors' : '',
        )}
      >
        {/* Home */}
        <div className="flex items-center gap-2 min-w-0">
          <Flag team={match.home} size={28} className="shrink-0" />
          <div className="min-w-0">
            <div className="font-mono text-[12px] font-bold leading-none">{match.home.code}</div>
            <div className="font-mono text-[9px] text-ink-3 truncate leading-none mt-0.5">{match.home.name}</div>
          </div>
        </div>

        {/* Center */}
        <div className="flex flex-col items-center gap-0.5">
          {isLive && (
            <>
              <span className="font-display text-lg leading-none">{match.homeScore}–{match.awayScore}</span>
              <span className="inline-flex items-center gap-1 font-mono text-[7px] font-bold text-red">
                <span className="w-1 h-1 rounded-full bg-red animate-pulse-live" />
                {match.liveMinute ? `${match.liveMinute}'` : 'AO VIVO'}
              </span>
            </>
          )}
          {isDone && (
            <>
              <span className="font-display text-lg leading-none text-ink-3">{match.homeScore}–{match.awayScore}</span>
              <span className="font-mono text-[7px] text-ink-4 tracking-eyebrow">ENCERRADO</span>
            </>
          )}
          {isLocked && !isLive && !isDone && (
            hasPick
              ? <><span className="font-display text-lg leading-none text-ink-3">{existing.homeScore}–{existing.awayScore}</span><span className="font-mono text-[7px] text-ink-4 tracking-eyebrow">BLOQUEADO</span></>
              : <span className="font-mono text-[8px] text-ink-4 text-center leading-tight">sem<br/>palpite</span>
          )}
          {!isLive && !isDone && !isLocked && hasPick && !editing && (
            <>
              <span className="font-display text-lg leading-none text-green">{existing.homeScore}–{existing.awayScore}</span>
              <span className="font-mono text-[7px] text-green font-bold tracking-eyebrow">SALVO ✓</span>
            </>
          )}
          {!isLive && !isDone && !isLocked && hasPick && editing && (
            <span className="font-mono text-[7px] text-ink-3 tracking-eyebrow text-center">EDITAR<br/>▲</span>
          )}
          {!isLive && !isDone && !isLocked && !hasPick && (
            <>
              <span className="font-mono text-[9px] text-ink-3 font-bold">{formatMatchDate(match)}</span>
              <span className="font-display text-base leading-none">{match.time}</span>
              <span className="font-mono text-[7px] text-green font-bold tracking-eyebrow">ABERTO</span>
            </>
          )}
        </div>

        {/* Away */}
        <div className="flex items-center gap-2 min-w-0 justify-end">
          <div className="min-w-0 text-right">
            <div className="font-mono text-[12px] font-bold leading-none">{match.away.code}</div>
            <div className="font-mono text-[9px] text-ink-3 truncate leading-none mt-0.5">{match.away.name}</div>
          </div>
          <Flag team={match.away} size={28} className="shrink-0" />
        </div>
      </div>

      {/* Score inputs — mesmo grid da info row para alinhar com os times */}
      {showInputs && (
        <>
          <div className="px-3 pb-2 grid grid-cols-[1fr_80px_1fr] gap-x-2 items-center">
            <div className="flex items-center justify-center">
              <button onClick={() => updateHome(clamp(home - 1, 0, 9))} disabled={home === 0}
                className="w-8 h-8 flex items-center justify-center border-2 border-r-0 border-ink font-mono text-base hover:bg-yellow active:bg-yellow disabled:opacity-25 select-none">−</button>
              <div className="w-9 h-8 flex items-center justify-center border-2 border-ink font-display text-lg select-none">{home}</div>
              <button onClick={() => updateHome(clamp(home + 1, 0, 9))}
                className="w-8 h-8 flex items-center justify-center border-2 border-l-0 border-ink font-mono text-base hover:bg-yellow active:bg-yellow select-none">+</button>
            </div>
            <div className="flex items-center justify-center">
              <span className="font-mono text-[11px] text-ink-3">×</span>
            </div>
            <div className="flex items-center justify-center">
              <button onClick={() => updateAway(clamp(away - 1, 0, 9))} disabled={away === 0}
                className="w-8 h-8 flex items-center justify-center border-2 border-r-0 border-ink font-mono text-base hover:bg-yellow active:bg-yellow disabled:opacity-25 select-none">−</button>
              <div className="w-9 h-8 flex items-center justify-center border-2 border-ink font-display text-lg select-none">{away}</div>
              <button onClick={() => updateAway(clamp(away + 1, 0, 9))}
                className="w-8 h-8 flex items-center justify-center border-2 border-l-0 border-ink font-mono text-base hover:bg-yellow active:bg-yellow select-none">+</button>
            </div>
          </div>
          <div className="px-3 pb-3">
            <button
              onClick={handleConfirm}
              disabled={saving}
              className="btn-yellow w-full text-[10px] py-2 tracking-eyebrow font-bold disabled:opacity-50"
            >
              {saving ? 'SALVANDO...' : hasPick ? 'ATUALIZAR PALPITE' : 'CONFIRMAR PALPITE'}
            </button>
          </div>
        </>
      )}

      {saveError && (
        <p className="font-mono text-[9px] text-red px-3 pb-2">{saveError}</p>
      )}
    </div>
  )
}

// ─── Groups tab ───────────────────────────────────────────────────────────────

function GroupBatchSaveBar({ selectedGroup, matches, compact = false }: {
  selectedGroup: string
  matches: Match[]
  compact?: boolean
}) {
  const { predictions, drafts, confirmPredictionBatch } = usePredictionStore()
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const openMatches = useMemo(() => matches.filter(m => isBetOpen(m)), [matches])
  const savedCount = matches.filter(m => predictions[m.id]).length
  const draftCount = matches.filter(m => drafts[m.id]).length
  const canSave = openMatches.length > 0 && !saving

  const handleSaveGroup = async () => {
    setSaving(true)
    setNotice(null)
    const result = await confirmPredictionBatch(openMatches.map(match => {
      const draft = drafts[match.id]
      const existing = predictions[match.id]
      return {
        match,
        homeScore: draft?.home ?? existing?.homeScore ?? 0,
        awayScore: draft?.away ?? existing?.awayScore ?? 0,
      }
    }))
    setSaving(false)
    if (!result.ok) {
      setNotice(result.error ?? 'Erro ao salvar grupo.')
      return
    }
    const skipped = result.skipped > 0 ? ` · ${result.skipped} bloqueados` : ''
    setNotice(`${result.saved} palpites salvos${skipped}`)
  }

  return (
    <div className={cn(
      'border-y border-hairline bg-paper-white px-4 py-3',
      compact ? 'md:px-5' : ''
    )}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="font-mono text-[9px] tracking-eyebrow text-ink-3">GRUPO {selectedGroup}</div>
          <div className="font-mono text-[10px] text-ink-4">
            {savedCount}/{matches.length} salvos
            {draftCount > 0 ? ` · ${draftCount} em edicao` : ''}
          </div>
        </div>
        <button
          onClick={handleSaveGroup}
          disabled={!canSave}
          className="btn-yellow w-full px-3 py-2 text-[10px] disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
        >
          {saving ? 'SALVANDO...' : `SALVAR GRUPO ${selectedGroup}`}
        </button>
      </div>
      {notice && (
        <div className="mt-2 font-mono text-[10px] text-ink-3">{notice}</div>
      )}
    </div>
  )
}

function GroupsTab() {
  const [selectedGroup, setSelectedGroup] = useState<string>('A')
  const { predictions, lastError, clearError } = usePredictionStore()
  const allMatches = useMatchesWithStatus(WC2026_MATCHES)

  const countPerGroup = useMemo(() => {
    const map: Record<string, number> = {}
    for (const g of GROUP_LABELS) {
      map[g] = allMatches.filter(m => m.group === g && predictions[m.id]).length
    }
    return map
  }, [allMatches, predictions])

  const groupMatches = useMemo(
    () => allMatches.filter(m => m.group === selectedGroup),
    [allMatches, selectedGroup]
  )

  const totalInGroup = groupMatches.length
  const doneInGroup = countPerGroup[selectedGroup] ?? 0

  const byMatchday = useMemo(() => {
    const map: Record<number, Match[]> = { 1: [], 2: [], 3: [] }
    for (const m of groupMatches) {
      const md = parseInt(m.stageLabel.split('MD')[1] ?? '1')
      ;(map[md] ?? (map[md] = [])).push(m)
    }
    return map
  }, [groupMatches])

  const groupDef = WC2026_GROUPS.find(g => g.id === selectedGroup)

  const standings = useMemo(() => {
    const predMap: Record<string, { homeScore: number; awayScore: number }> = {}
    for (const [matchId, pred] of Object.entries(predictions)) {
      predMap[matchId] = { homeScore: pred.homeScore, awayScore: pred.awayScore }
    }
    return computeStandings(selectedGroup, predMap, allMatches)
  }, [selectedGroup, predictions, allMatches])

  const filledMatches = groupMatches.filter(m => {
    if (m.status === 'finished' || m.status === 'live') return true
    return !!predictions[m.id]
  }).length

  const completedGroups = GROUP_LABELS.filter(g => (countPerGroup[g] ?? 0) === 6).length

  return (
    <div className="pb-24">
      {/* Overall progress */}
      {completedGroups > 0 && (
        <div className="px-4 py-2.5 bg-green/5 border-b border-hairline flex items-center justify-between">
          <span className="font-mono text-[9px] text-green font-bold">
            {completedGroups}/12 grupos completos
          </span>
          <div className="flex gap-0.5 items-center">
            {GROUP_LABELS.map(g => (
              <div
                key={g}
                className={cn(
                  'h-1.5 w-2.5 rounded-sm transition-colors',
                  (countPerGroup[g] ?? 0) === 6 ? 'bg-green' : 'bg-hairline'
                )}
              />
            ))}
          </div>
        </div>
      )}

      {/* Group selector */}
        <div className="px-3 py-3 border-b border-hairline bg-paper/95 sticky top-[44px] z-10 overflow-x-auto backdrop-blur-md">
        <div className="flex gap-1.5 min-w-max">
          {GROUP_LABELS.map(g => {
            const count = countPerGroup[g] ?? 0
            const done = count === 6
            const active = g === selectedGroup
            const groupTeams = WC2026_GROUPS.find(gr => gr.id === g)?.teams ?? []
            return (
              <button
                key={g}
                onClick={() => setSelectedGroup(g)}
                className={cn(
                  'flex flex-col items-center px-3 py-2 border-2 transition-colors min-w-[70px] gap-1',
                  active ? 'bg-ink border-ink text-paper' :
                  done  ? 'border-green text-green bg-green/5' :
                          'border-hairline text-ink-3 hover:border-ink hover:text-ink',
                )}
              >
                <span className="font-display text-sm leading-none">GRUPO {g}</span>
                <div className="flex gap-px">
                  {groupTeams.map(code => (
                    <Flag key={code} team={TEAMS[code]} size={11} />
                  ))}
                </div>
                <span className="font-mono text-[7px] opacity-60">{count}/6</span>
              </button>
            )
          })}
        </div>
      </div>

      {lastError && (
        <div className="mx-4 mt-4 border border-red/30 bg-red/5 px-3 py-2 flex items-center justify-between gap-3">
          <p className="font-mono text-[10px] text-red">{lastError}</p>
          <button onClick={clearError} className="font-mono text-[10px] text-red underline">OK</button>
        </div>
      )}

      {/* Group header */}
      <div className="px-4 pt-4 pb-2 flex items-center gap-3">
        <span className="font-display text-2xl">GRUPO {selectedGroup}</span>
        <div className="flex gap-1">
          {groupDef?.teams.map(code => (
            <Flag key={code} team={TEAMS[code]} size={20} />
          ))}
        </div>
        <span className="ml-auto font-mono text-[10px] text-ink-3">
          {doneInGroup}/{totalInGroup} palpites
        </span>
      </div>

      {/* Progress bar */}
      {doneInGroup > 0 && (
        <div className="px-4 mb-3">
          <div className="h-1 bg-hairline overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(doneInGroup / totalInGroup) * 100}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="h-full bg-green"
            />
          </div>
        </div>
      )}

      {/* Matchdays */}
      {[1, 2, 3].map(md => {
        const matches = byMatchday[md] ?? []
        if (!matches.length) return null
        return (
          <div key={md}>
            <div className="px-4 py-2 bg-paper-deep border-y border-hairline">
              <span className="font-mono text-[9px] tracking-eyebrow text-ink-3">RODADA {md}</span>
            </div>
            {matches.map(m => (
              <CompactMatchRow
                key={m.id}
                match={m}
                onConfirmed={() => {
                  setTimeout(() => {
                    const preds = usePredictionStore.getState().predictions
                    const next = groupMatches.find(gm => isBetOpen(gm) && !preds[gm.id] && gm.id !== m.id)
                    if (!next) return
                    const el = document.getElementById(`match-row-${next.id}`)
                    if (!el) return
                    // 44px tab bar + 52px group selector + 20px breathing room
                    const offset = el.getBoundingClientRect().top + window.scrollY - 116
                    window.scrollTo({ top: Math.max(0, offset), behavior: 'smooth' })
                  }, 200)
                }}
              />
            ))}
          </div>
        )
      })}

      <GroupBatchSaveBar selectedGroup={selectedGroup} matches={groupMatches} />

      {/* Standings */}
      <div className="mt-4">
        <MiniStandings
          standings={standings}
          totalMatches={totalInGroup}
          filledMatches={filledMatches}
        />
      </div>

      {/* Points guide */}
      <div className="mx-4 mt-2 mb-2 border border-hairline">
        <div className="px-3 py-2 border-b border-hairline bg-paper-deep">
          <span className="font-mono text-[9px] tracking-eyebrow text-ink-3">PONTUAÇÃO FASE DE GRUPOS</span>
        </div>
        {GROUP_POINTS_GUIDE.map(rule => (
          <div key={rule.pts} className="flex items-center gap-3 px-3 py-2 border-b border-hairline last:border-0">
            <span className="font-display text-lg text-green w-8">{rule.pts}</span>
            <span className="font-mono text-[10px] text-ink-3">{rule.label}</span>
          </div>
        ))}
      </div>

      {/* Group complete banner */}

      {doneInGroup === totalInGroup && standings.length >= 2 && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-4 mb-4 p-4 border-2 border-yellow bg-yellow/10 flex items-center gap-4"
        >
          <div className="flex gap-1.5">
            <Flag team={TEAMS[standings[0]?.code]} size={36} ring />
            <Flag team={TEAMS[standings[1]?.code]} size={36} ring />
          </div>
          <div>
            <p className="font-mono text-[9px] tracking-eyebrow text-ink-3">GRUPO {selectedGroup} COMPLETO</p>
            <p className="font-display text-lg leading-tight">
              {standings[0]?.code} e {standings[1]?.code} avançam no seu palpite
            </p>
          </div>
        </motion.div>
      )}
    </div>
  )
}

// ─── Knockout tab ─────────────────────────────────────────────────────────────

const GROUP_POINTS_GUIDE = [
  { pts: '+10', label: 'Placar exato' },
  { pts: '+7',  label: 'Resultado + gols do vencedor' },
  { pts: '+5',  label: 'Resultado correto (V/E/D)' },
  { pts: '+1',  label: 'Gols de uma equipe acertados' },
]

const KO_STAGE_LABELS: Record<string, string> = {
  round_of_32:   'FASE DE 32',
  round_of_16:   'OITAVAS DE FINAL',
  quarter_final: 'QUARTAS DE FINAL',
  semi_final:    'SEMIFINAIS',
  third_place:   '3° LUGAR',
  final:         'FINAL',
}
const KO_STAGE_ORDER = ['round_of_32', 'round_of_16', 'quarter_final', 'semi_final', 'third_place', 'final']

const KO_POINTS_GUIDE = [
  { pts: '+2',  label: 'Classificado acertado (incl. prorrogação/pênaltis)' },
  { pts: '+5',  label: 'Resultado correto (vitória/derrota no regulamentar)' },
  { pts: '+8',  label: 'Resultado + gols de um time' },
  { pts: '+12', label: 'Placar exato (tempo regulamentar)' },
]

function KnockoutTab() {
  const allMatches = useMatchesWithStatus(WC2026_MATCHES)
  const koMatches = allMatches.filter(m => m.stage !== 'group')

  return (
    <div className="pb-24">
      {koMatches.length === 0 ? (
        /* ── Empty state: KO matches not in DB yet ── */
        <div className="mx-4 mt-8 p-6 ui-card text-center">
          <div className="font-display text-5xl text-ink mb-3">32</div>
          <p className="font-display text-xl text-ink mb-2">FASE DE 32</p>
          <p className="font-mono text-[11px] text-ink-2 leading-relaxed max-w-sm mx-auto">
            O mata-mata da Copa 2026 começa em <strong>28 Jun</strong> com 32 seleções:
            os dois primeiros de cada grupo e os oito melhores terceiros.
          </p>
          <div className="mt-5 pt-4 border-t border-hairline grid grid-cols-2 gap-2 text-left">
            {[
              ['GRUPOS', '72 jogos'],
              ['FASE DE 32', '16 jogos'],
              ['OITAVAS', '8 jogos'],
              ['FINAL', '19 Jul'],
            ].map(([label, value]) => (
              <div key={label} className="border border-hairline px-3 py-2">
                <p className="font-mono text-[8px] text-ink-3 tracking-eyebrow">{label}</p>
                <p className="font-display text-lg text-ink leading-none mt-1">{value}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 border border-yellow bg-yellow/10 px-3 py-2">
            <p className="font-mono text-[10px] text-ink-2">
              Complete a fase de grupos para projetar os classificados. O 3º colocado entra na briga dos melhores terceiros.
            </p>
          </div>
        </div>
      ) : (
        /* ── Real KO matches from DB, grouped by stage ── */
        KO_STAGE_ORDER.map(stage => {
          const stageMatches = koMatches.filter(m => m.stage === stage)
          if (stageMatches.length === 0) return null
          return (
            <div key={stage}>
              <div className="px-4 py-3 border-b border-hairline bg-paper-deep flex items-center justify-between">
                <span className="font-display text-base">{KO_STAGE_LABELS[stage]}</span>
                <span className="font-mono text-[9px] text-ink-4">{stageMatches.length} partidas</span>
              </div>
              {stageMatches.map(match => (
                <MatchRow key={match.id} match={match} />
              ))}
            </div>
          )
        })
      )}

      {/* Points guide */}
      <div className="mx-4 mt-6 border border-hairline">
        <div className="px-3 py-2 border-b border-hairline bg-paper-deep">
          <span className="font-mono text-[9px] tracking-eyebrow text-ink-3">PONTUAÇÃO MATA-MATA</span>
        </div>
        {KO_POINTS_GUIDE.map(rule => (
          <div key={rule.pts} className="flex items-center gap-3 px-3 py-2.5 border-b border-hairline last:border-0">
            <span className="font-display text-lg text-green w-8">{rule.pts}</span>
            <span className="font-mono text-[10px] text-ink-3">{rule.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}


// ─── General picks validation ─────────────────────────────────────────────────

export function validateGeneralPicks(
  champion: string | null,
  vice: string | null
): { valid: boolean; error: string | null } {
  if (!champion || !vice) return { valid: true, error: null }
  if (champion === vice) return { valid: false, error: 'Campeão e vice não podem ser a mesma seleção.' }
  const cGroup = getGroupOfTeam(champion)
  const vGroup = getGroupOfTeam(vice)
  if (cGroup && vGroup && cGroup === vGroup)
    return { valid: false, error: `Campeão e vice não podem ser do mesmo grupo (Grupo ${cGroup}).` }
  return { valid: true, error: null }
}

// ─── Team picker grid ─────────────────────────────────────────────────────────

function TeamPickerGrid({
  pick, onPick, disabledCodes = [], disabledReason,
}: {
  pick: string | null
  onPick: (code: string) => void
  disabledCodes?: string[]
  disabledReason?: string
}) {
  const [search, setSearch] = useState('')
  const q = search.trim().toLowerCase()

  const visibleGroups = WC2026_GROUPS.map(group => ({
    ...group,
    teams: group.teams.filter(code => {
      if (!q) return true
      const team = TEAMS[code]
      return code.toLowerCase().includes(q) || team?.name.toLowerCase().includes(q)
    }),
  })).filter(g => g.teams.length > 0)

  return (
    <div>
      {pick && (
        <div className="mb-3 flex items-center gap-3 p-3 border-2 border-green bg-green/5">
          <Flag team={TEAMS[pick]} size={32} />
          <div className="flex-1">
            <p className="font-mono text-[8px] tracking-eyebrow text-ink-4">ESCOLHIDO</p>
            <p className="font-display text-lg leading-none">{TEAMS[pick]?.name.toUpperCase()}</p>
          </div>
          <span className="font-mono text-[11px] text-green font-bold">✓</span>
        </div>
      )}

      {disabledReason && (
        <div className="mb-3 px-3 py-2 border border-yellow/40 bg-yellow/5">
          <p className="font-mono text-[9px] text-ink-3 leading-relaxed">{disabledReason}</p>
        </div>
      )}

      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Buscar seleção..."
        className="w-full bg-paper-deep border-2 border-line px-3 py-2 font-mono text-[11px] mb-3 outline-none focus:border-ink placeholder:text-ink-4"
      />

      {visibleGroups.length === 0 && (
        <p className="font-mono text-[10px] text-ink-4 text-center py-4">Nenhuma seleção encontrada.</p>
      )}

      <div className="space-y-3">
        {visibleGroups.map(group => (
          <div key={group.id}>
            <p className="font-mono text-[8px] tracking-eyebrow text-ink-4 mb-1.5">GRUPO {group.id}</p>
            <div className="grid grid-cols-4 gap-1.5">
              {group.teams.map(code => {
                const team = TEAMS[code]
                if (!team) return null
                const selected = pick === code
                const blocked = !selected && disabledCodes.includes(code)
                return (
                  <motion.button
                    key={code}
                    onClick={() => !blocked && onPick(code)}
                    whileTap={blocked ? {} : { scale: 0.95 }}
                    disabled={blocked}
                    className={cn(
                      'flex flex-col items-center gap-1 py-2 px-1 border-2 transition-colors',
                      selected ? 'border-green bg-green/10' :
                      blocked  ? 'border-hairline opacity-25 cursor-not-allowed' :
                                 'border-hairline hover:border-ink',
                    )}
                  >
                    <Flag team={team} size={26} />
                    <span className="font-mono text-[8px] font-bold leading-none">{code}</span>
                    {q && <span className="font-mono text-[6px] text-ink-4 truncate w-full text-center leading-none">{team.name}</span>}
                  </motion.button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Champion tab ────────────────────────────────────────────────────────────

const GENERAL_DEADLINE = getBettingDeadline(WC2026_MATCHES[0])

type GeneralSection = 'champion' | 'vice' | 'scorer'

function ChampionTab() {
  const {
    championPick, vicePick, scorerPick,
    setChampionPick, setVicePick, setScorerPick,
    lastError, clearError,
  } = usePredictionStore()

  const [scorerInput, setScorerInput] = useState(scorerPick ?? '')
  const [activeSection, setActiveSection] = useState<GeneralSection>(
    !championPick ? 'champion' : !vicePick ? 'vice' : 'champion'
  )

  const championGroup = championPick ? getGroupOfTeam(championPick) : null
  const viceGroup     = vicePick     ? getGroupOfTeam(vicePick)     : null

  const viceDisabledCodes     = championPick ? WC2026_GROUPS.find(g => g.id === championGroup)?.teams ?? [] : []
  const championDisabledCodes = vicePick     ? WC2026_GROUPS.find(g => g.id === viceGroup)?.teams    ?? [] : []

  function handleChampionPick(code: string) {
    if (vicePick && getGroupOfTeam(vicePick) === getGroupOfTeam(code)) setVicePick('')
    setChampionPick(code)
    if (!vicePick || (vicePick && getGroupOfTeam(vicePick) === getGroupOfTeam(code))) setActiveSection('vice')
    else if (!scorerPick) setActiveSection('scorer')
  }

  function handleVicePick(code: string) {
    if (championPick && getGroupOfTeam(championPick) === getGroupOfTeam(code)) return
    setVicePick(code)
    if (!scorerPick) setActiveSection('scorer')
  }

  const now = new Date()
  const isDeadlinePassed = now >= GENERAL_DEADLINE
  const allSet = championPick && vicePick && scorerPick
  const deadlineStr = formatMatchDateTime(WC2026_MATCHES[0])

  const slots: { id: GeneralSection; label: string; pts: number; pick: string | null; isTeam: boolean }[] = [
    { id: 'champion', label: 'CAMPEÃO',    pts: 25, pick: championPick, isTeam: true  },
    { id: 'vice',     label: 'VICE',       pts: 15, pick: vicePick,     isTeam: true  },
    { id: 'scorer',   label: 'ARTILHEIRO', pts: 10, pick: scorerPick,   isTeam: false },
  ]

  return (
    <div className="px-4 py-5 pb-24">
      {/* Header */}
      <div className="mb-5">
        <div className="font-display text-4xl leading-none text-ink">APOSTAS ESPECIAIS</div>
        <div className="font-serif-it text-xl text-green-deep leading-snug mt-0.5">
          campeão, vice e artilheiro — antes de tudo
        </div>
        <div className={cn(
          'mt-3 inline-flex items-center gap-2 px-3 py-1.5 border font-mono text-[10px]',
          isDeadlinePassed
            ? 'border-red/40 bg-red/5 text-red'
            : 'border-yellow/50 bg-yellow/5 text-ink-3'
        )}>
          {isDeadlinePassed ? '■ ENCERRADO' : 'PRAZO:'} {deadlineStr}
        </div>
      </div>

      {lastError && (
        <div className="mb-4 border border-red/30 bg-red/5 px-3 py-2 flex items-center justify-between gap-3">
          <p className="font-mono text-[10px] text-red">{lastError}</p>
          <button onClick={clearError} className="font-mono text-[10px] text-red underline">OK</button>
        </div>
      )}

      {/* Pós-prazo: só leitura */}
      {isDeadlinePassed ? (
        <div className="space-y-3">
          <div className="mb-4 border border-red/30 bg-red/5 px-3 py-2">
            <p className="font-mono text-[10px] text-red">Apostas especiais encerradas. Registradas no início da competição.</p>
          </div>
          {championPick && (
            <div className="flex items-center gap-3 p-4 border-2 border-hairline">
              <Flag team={TEAMS[championPick]} size={36} />
              <div className="flex-1">
                <p className="font-mono text-[8px] tracking-eyebrow text-ink-4">CAMPEÃO</p>
                <p className="font-display text-xl">{TEAMS[championPick]?.name.toUpperCase()}</p>
              </div>
              <span className="font-mono text-[10px] text-green font-bold">+25 pts</span>
            </div>
          )}
          {vicePick && (
            <div className="flex items-center gap-3 p-4 border-2 border-hairline">
              <Flag team={TEAMS[vicePick]} size={36} />
              <div className="flex-1">
                <p className="font-mono text-[8px] tracking-eyebrow text-ink-4">VICE</p>
                <p className="font-display text-xl">{TEAMS[vicePick]?.name.toUpperCase()}</p>
              </div>
              <span className="font-mono text-[10px] text-green font-bold">+15 pts</span>
            </div>
          )}
          {scorerPick && (
            <div className="flex items-center gap-3 p-4 border-2 border-hairline">
              <div className="w-9 h-9 flex items-center justify-center border-2 border-hairline font-display text-xl flex-shrink-0">○</div>
              <div className="flex-1">
                <p className="font-mono text-[8px] tracking-eyebrow text-ink-4">ARTILHEIRO</p>
                <p className="font-display text-xl">{scorerPick.toUpperCase()}</p>
              </div>
              <span className="font-mono text-[10px] text-green font-bold">+10 pts</span>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* 3 pick slots */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            {slots.map(slot => {
              const isActive = activeSection === slot.id
              const hasPick = !!slot.pick
              return (
                <button
                  key={slot.id}
                  onClick={() => setActiveSection(slot.id)}
                  className={cn(
                    'flex flex-col items-center gap-2 p-3 border-2 transition-all min-h-[108px]',
                    isActive ? 'border-line-strong bg-surface-2 shadow-card' :
                    hasPick  ? 'border-green bg-green/5 hover:bg-green/10' :
                               'border-hairline hover:border-ink',
                  )}
                >
                  {hasPick && slot.isTeam ? (
                    <Flag team={TEAMS[slot.pick!]} size={36} />
                  ) : hasPick && !slot.isTeam ? (
                    <div className="w-9 h-9 flex items-center justify-center border-2 border-green font-mono text-base text-green">✓</div>
                  ) : (
                    <div className="w-9 h-9 flex items-center justify-center border-2 border-dashed border-hairline font-mono text-xl text-ink-4">?</div>
                  )}
                  <span className={cn('font-mono text-[8px] font-bold leading-tight text-center line-clamp-2', hasPick ? 'text-green' : 'text-ink-4')}>
                    {hasPick
                      ? (slot.isTeam ? TEAMS[slot.pick!]?.name.toUpperCase() : slot.pick!.toUpperCase())
                      : 'TOQUE PARA ESCOLHER'}
                  </span>
                  <div className="mt-auto text-center">
                    <div className="font-mono text-[7px] tracking-eyebrow text-ink-3">{slot.label}</div>
                    <div className={cn('font-mono text-[9px] font-bold', hasPick ? 'text-green' : 'text-ink-4')}>+{slot.pts} pts</div>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Picker panel for active slot */}
          <div className="ui-panel overflow-hidden">
            <div className="ui-panel-header flex items-center justify-between">
              <span className="font-display text-base">
                {activeSection === 'champion' ? 'ESCOLHA O CAMPEÃO' :
                 activeSection === 'vice'     ? 'ESCOLHA O VICE' :
                                               'ARTILHEIRO DA COPA'}
              </span>
              <span className="font-mono text-[9px] text-paper/50">
                +{slots.find(s => s.id === activeSection)?.pts} pts
              </span>
            </div>
            <div className="p-4">
              {activeSection === 'champion' && (
                <TeamPickerGrid
                  pick={championPick}
                  onPick={handleChampionPick}
                  disabledCodes={championDisabledCodes}
                  disabledReason={vicePick ? `Times do Grupo ${viceGroup} bloqueados — mesmo grupo que o vice.` : undefined}
                />
              )}
              {activeSection === 'vice' && (
                <TeamPickerGrid
                  pick={vicePick}
                  onPick={handleVicePick}
                  disabledCodes={viceDisabledCodes}
                  disabledReason={championPick ? `Times do Grupo ${championGroup} bloqueados — mesmo grupo que o campeão.` : undefined}
                />
              )}
              {activeSection === 'scorer' && (
                <div>
                  <p className="font-mono text-[10px] text-ink-3 mb-4 leading-relaxed">
                    Quem vai ser o artilheiro da Copa 2026? Esse palpite é critério de desempate no ranking.
                  </p>
                  <div className="ui-card p-4">
                    <p className="font-mono text-[9px] tracking-eyebrow text-ink-3 mb-2">NOME DO JOGADOR</p>
                    <input
                      value={scorerInput}
                      onChange={e => setScorerInput(e.target.value)}
                      placeholder="ex: Mbappé, Vinicius Jr, Haaland..."
                      className="w-full bg-paper-deep border border-line px-3 py-2.5 font-sans text-[14px] outline-none focus:border-ink placeholder:text-ink-4"
                    />
                    <button
                      onClick={() => { if (scorerInput.trim()) setScorerPick(scorerInput.trim()) }}
                      disabled={!scorerInput.trim() || scorerInput.trim() === scorerPick}
                      className="mt-3 btn-yellow w-full text-[11px] py-3 tracking-eyebrow font-bold disabled:opacity-40"
                    >
                      {scorerPick ? `ALTERAR — ${scorerPick}` : 'CONFIRMAR ARTILHEIRO ✓'}
                    </button>
                  </div>
                  <p className="font-mono text-[9px] text-ink-4 mt-3 leading-relaxed">
                    Reg. 7: em caso de empate, desempata quem acertou o artilheiro com mais gols.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* All set banner */}
          {allSet && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-5 p-4 bg-green/10 border-2 border-green text-center"
            >
              <p className="font-display text-xl text-green">APOSTAS ESPECIAIS FEITAS ✓</p>
              <p className="font-mono text-[10px] text-green/70 mt-1">
                Campeão: {TEAMS[championPick]?.name} · Vice: {TEAMS[vicePick]?.name} · Artilheiro: {scorerPick}
              </p>
            </motion.div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Desktop views ────────────────────────────────────────────────────────────

function DesktopGroupView({
  selectedGroup,
  predictions,
}: {
  selectedGroup: string
  predictions: Record<string, { homeScore: number; awayScore: number }>
}) {
  const allMatches = useMatchesWithStatus(WC2026_MATCHES)

  const groupMatches = useMemo(
    () => allMatches.filter(m => m.group === selectedGroup),
    [allMatches, selectedGroup]
  )

  const standings = useMemo(
    () => computeStandings(selectedGroup, predictions, allMatches),
    [selectedGroup, predictions, allMatches]
  )

  const filledMatches = groupMatches.filter(m => {
    if (m.status === 'finished' || m.status === 'live') return true
    return !!predictions[m.id]
  }).length

  const countInGroup = allMatches.filter(m => m.group === selectedGroup && predictions[m.id]).length

  return (
    <div className="ui-panel flex flex-col">
      <div className="px-5 py-4 border-b border-hairline flex items-center gap-3">
        <span className="font-display text-xl">GRUPO {selectedGroup}</span>
        <div className="flex gap-1">
          {WC2026_GROUPS.find(g => g.id === selectedGroup)?.teams.map(code => (
            <Flag key={code} team={TEAMS[code]} size={20} />
          ))}
        </div>
        <span className="ml-auto font-mono text-[10px] text-ink-3">{countInGroup}/6 palpites</span>
      </div>

      {[1, 2, 3].map(md => {
        const matches = allMatches.filter(
          m => m.group === selectedGroup && m.stageLabel.endsWith(`MD${md}`)
        )
        if (!matches.length) return null
        return (
          <div key={md}>
            <div className="px-5 py-2.5 border-b border-hairline bg-surface-2">
              <span className="font-mono text-[9px] tracking-eyebrow text-ink-3">RODADA {md}</span>
            </div>
            {matches.map(m => (
              <CompactMatchRow
                key={m.id}
                match={m}
                onConfirmed={() => {
                  setTimeout(() => {
                    const preds = usePredictionStore.getState().predictions
                    const next = groupMatches.find(gm => isBetOpen(gm) && !preds[gm.id] && gm.id !== m.id)
                    if (!next) return
                    const el = document.getElementById(`match-row-${next.id}`)
                    if (!el) return
                    // 44px tab bar + 52px group selector + 20px breathing room
                    const offset = el.getBoundingClientRect().top + window.scrollY - 116
                    window.scrollTo({ top: Math.max(0, offset), behavior: 'smooth' })
                  }, 200)
                }}
              />
            ))}
          </div>
        )
      })}

      <GroupBatchSaveBar selectedGroup={selectedGroup} matches={groupMatches} compact />

      {filledMatches > 0 && (
        <div className="border-t-2 border-ink">
          <MiniStandings
            standings={standings}
            totalMatches={groupMatches.length}
            filledMatches={filledMatches}
          />
        </div>
      )}
    </div>
  )
}

function DesktopGroupSidebar({
  selectedGroup,
  onSelect,
  countPerGroup,
}: {
  selectedGroup: string
  onSelect: (g: string) => void
  countPerGroup: Record<string, number>
}) {
  return (
    <div className="ui-panel">
      <div className="px-4 py-3 border-b border-hairline">
        <span className="font-mono text-[10px] tracking-eyebrow text-ink-3">GRUPOS</span>
      </div>
      <div className="divide-y divide-hairline">
        {GROUP_LABELS.map(g => {
          const done = countPerGroup[g] === 6
          const active = g === selectedGroup
          return (
            <button
              key={g}
              onClick={() => onSelect(g)}
              className={cn(
                'w-full px-4 py-3 flex items-center justify-between transition-colors',
                active ? 'bg-yellow text-[#0D0D0D]' : 'hover:bg-surface-hover',
              )}
            >
              <div className="flex items-center gap-2">
                <span className="font-display text-base">GRUPO {g}</span>
                <div className="flex gap-0.5">
                  {WC2026_GROUPS.find(gr => gr.id === g)?.teams.map(code => (
                    <Flag key={code} team={TEAMS[code]} size={14} />
                  ))}
                </div>
              </div>
              <span className={cn('font-mono text-[9px]', done ? 'text-green font-bold' : 'text-ink-3')}>
                {countPerGroup[g] ?? 0}/6{done ? ' ✓' : ''}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Root screen ──────────────────────────────────────────────────────────────

export function PredictionScreen() {
  const { matchId } = useParams<{ matchId?: string }>()
  const location = useLocation()
  const rawTab = (location.state as { tab?: string } | null)?.tab
  const initialTab: PredTab = rawTab === 'champion' ? 'champion' : rawTab === 'knockout' ? 'knockout' : 'groups'
  const [tab, setTab] = useState<PredTab>(initialTab)
  const allMatches = useMatchesWithStatus(WC2026_MATCHES)

  const initialGroup = useMemo(() => {
    if (!matchId) return 'A'
    const m = allMatches.find(m => m.id === matchId)
    return m?.group ?? 'A'
  }, [matchId, allMatches])

  const [selectedGroup, setSelectedGroup] = useState(initialGroup)
  const { predictions } = usePredictionStore()
  const isDesktop = useIsDesktop()

  useEffect(() => {
    setSelectedGroup(initialGroup)
  }, [initialGroup])

  const predMap = useMemo(() => {
    const m: Record<string, { homeScore: number; awayScore: number }> = {}
    for (const [mId, pred] of Object.entries(predictions)) {
      m[mId] = { homeScore: pred.homeScore, awayScore: pred.awayScore }
    }
    return m
  }, [predictions])

  const countPerGroup = useMemo(() => {
    const map: Record<string, number> = {}
    for (const g of GROUP_LABELS) {
      map[g] = allMatches.filter(m => m.group === g && predictions[m.id]).length
    }
    return map
  }, [allMatches, predictions])

  const totalGroupPreds = Object.values(predictions).filter(p => !p.matchId?.startsWith('ko-')).length
  const totalGroupMatches = allMatches.length

  const tabs = [
    { id: 'groups'   as const, label: 'GRUPOS'        },
    { id: 'knockout' as const, label: 'MATA-MATA'      },
    { id: 'champion' as const, label: 'ESPECIAIS' },
  ]

  return (
    <div className="min-h-dvh bg-paper">
      {/* Header editorial */}
      <div className="border-b border-hairline pt-6 pb-5 md:pt-8 md:pb-6">
        <div className="mx-auto flex max-w-screen-xl items-end justify-between gap-4 px-4 md:px-6">
          <div className="min-w-0">
            <div className="font-display text-5xl md:text-7xl leading-none text-ink">PALPITA</div>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="font-serif-it text-3xl md:text-5xl text-green-deep leading-none">tudo,</span>
              <span className="font-mono text-[10px] tracking-eyebrow text-ink-3 self-end mb-1">jogador.</span>
              <span className="md:hidden rounded-full border border-hairline bg-paper-white px-2.5 py-1 font-mono text-[9px] font-bold tracking-eyebrow text-ink-3">
                {totalGroupPreds} de {totalGroupMatches}
              </span>
            </div>
          </div>
          <div className="text-right hidden md:block">
            <div className="font-display text-4xl text-ink">{totalGroupPreds}</div>
            <div className="font-mono text-[9px] text-ink-3">de {totalGroupMatches} jogos</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-hairline flex sticky top-0 lg:top-14 bg-paper/95 z-20 backdrop-blur-md">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'flex-1 py-3 font-mono text-[10px] font-bold tracking-eyebrow border-b-2 transition-colors',
              tab === t.id ? 'border-ink text-ink' : 'border-transparent text-ink-3 hover:text-ink',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {tab === 'groups' && (
          <motion.div
            key="groups"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
          >
            {isDesktop ? (
              <div className="max-w-screen-xl mx-auto px-6 py-6 grid grid-cols-[260px_1fr] gap-6">
                <DesktopGroupSidebar
                  selectedGroup={selectedGroup}
                  onSelect={setSelectedGroup}
                  countPerGroup={countPerGroup}
                />
                <DesktopGroupView selectedGroup={selectedGroup} predictions={predMap} />
              </div>
            ) : (
              <GroupsTab />
            )}
          </motion.div>
        )}

        {tab === 'knockout' && (
          <motion.div
            key="knockout"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
          >
            <div className="md:max-w-2xl md:mx-auto">
              <KnockoutTab />
            </div>
          </motion.div>
        )}

        {tab === 'champion' && (
          <motion.div
            key="champion"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
          >
            <div className="md:max-w-2xl md:mx-auto">
              <ChampionTab />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
