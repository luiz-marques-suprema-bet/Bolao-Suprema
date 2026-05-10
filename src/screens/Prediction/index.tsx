import { useState, useMemo, useCallback } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Flag } from '@/components/shared/Flag'
import { usePredictionStore } from '@/stores/prediction.store'
import { useIsDesktop } from '@/hooks/useBreakpoint'
import { WC2026_MATCHES, WC2026_GROUPS } from '@/data/wc2026'
import { TEAMS } from '@/data/teams'
import { clamp, cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth.store'
import type { Match } from '@/types'

type PredTab = 'groups' | 'champion'

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
  predictions: Record<string, { homeScore: number; awayScore: number }>
): StandingRow[] {
  const groupDef = WC2026_GROUPS.find(g => g.id === groupCode)
  if (!groupDef) return []

  const rows: Record<string, StandingRow> = {}
  for (const code of groupDef.teams) {
    rows[code] = { code, pts: 0, gf: 0, ga: 0, gd: 0, w: 0, d: 0, l: 0, mp: 0 }
  }

  const matches = WC2026_MATCHES.filter(m => m.group === groupCode)

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

    home.mp++
    away.mp++
    home.gf += hg
    home.ga += ag
    away.gf += ag
    away.ga += hg
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

// ─── Score stepper ────────────────────────────────────────────────────────────

function ScoreControl({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <button
        onClick={() => onChange(clamp(value + 1, 0, 9))}
        className="w-9 h-9 flex items-center justify-center border-2 border-ink font-mono text-sm font-bold hover:bg-yellow transition-colors"
      >+</button>
      <div className="score-cell active w-9 h-9">{value}</div>
      <button
        onClick={() => onChange(clamp(value - 1, 0, 9))}
        disabled={value === 0}
        className="w-9 h-9 flex items-center justify-center border-2 border-ink font-mono text-sm font-bold hover:bg-yellow transition-colors disabled:opacity-30"
      >–</button>
    </div>
  )
}

// ─── Match row (expandable inline picker) ─────────────────────────────────────

function MatchRow({ match, onScoreChange }: { match: Match; onScoreChange?: () => void }) {
  const { predictions, drafts, confirmPrediction, setDraft } = usePredictionStore()
  const userId = useAuthStore(s => s.user?.id ?? 'me')
  const existing = predictions[match.id]
  const draft = drafts[match.id]

  const [expanded, setExpanded] = useState(false)
  const [home, setHome] = useState(draft?.home ?? existing?.homeScore ?? 0)
  const [away, setAway] = useState(draft?.away ?? existing?.awayScore ?? 0)

  const isPickable = match.status === 'open' || match.status === 'scheduled'
  const isLocked = match.status === 'locked'
  const isLive = match.status === 'live'
  const isDone = match.status === 'finished'
  const hasPick = !!existing

  const handleHomeChange = (v: number) => { setHome(v); onScoreChange?.() }
  const handleAwayChange = (v: number) => { setAway(v); onScoreChange?.() }

  const handleConfirm = () => {
    confirmPrediction({
      id: `pred-${match.id}`,
      userId,
      matchId: match.id,
      homeScore: home,
      awayScore: away,
      submittedAt: new Date().toISOString(),
    })
    setExpanded(false)
    onScoreChange?.()
  }

  const handleSaveDraft = () => {
    setDraft(match.id, home, away)
    setExpanded(false)
    onScoreChange?.()
  }

  const toggle = () => { if (isPickable) setExpanded(v => !v) }

  return (
    <div className="border-b border-hairline last:border-0">
      {/* ── collapsed row ── */}
      <button
        onClick={toggle}
        className={cn(
          'w-full px-4 py-3 flex items-center gap-2 text-left transition-colors',
          isPickable ? 'hover:bg-hairline cursor-pointer' : 'cursor-default',
          hasPick ? 'bg-green/5' : '',
        )}
      >
        {/* home */}
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <Flag team={match.home} size={20} />
          <span className="font-mono text-[11px] font-bold truncate">{match.home.code}</span>
        </div>

        {/* score / info */}
        <div className="flex items-center gap-1.5 flex-shrink-0 mx-1">
          {isLive && (
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-red animate-pulse-live" />
              <span className="font-display text-base leading-none">{match.homeScore}</span>
              <span className="font-mono text-[10px] text-ink-4">-</span>
              <span className="font-display text-base leading-none">{match.awayScore}</span>
              <span className="font-mono text-[9px] text-red font-bold ml-0.5">{match.liveMinute}</span>
            </div>
          )}
          {isDone && (
            <div className="flex items-center gap-1">
              <span className="font-display text-base leading-none text-ink-3">{match.homeScore}</span>
              <span className="font-mono text-[10px] text-ink-4">-</span>
              <span className="font-display text-base leading-none text-ink-3">{match.awayScore}</span>
              <span className="font-mono text-[8px] text-ink-4 ml-1">FIM</span>
            </div>
          )}
          {(isLocked) && (
            <span className="font-mono text-[9px] text-ink-4 flex items-center gap-1">
              <span>■</span>
              {hasPick ? (
                <span className="text-green">{existing.homeScore}–{existing.awayScore}</span>
              ) : (
                <span>SEM PALPITE</span>
              )}
            </span>
          )}
          {!isLive && !isDone && !isLocked && hasPick && (
            <div className="flex items-center gap-1">
              <span className="font-display text-base leading-none text-green">{existing.homeScore}</span>
              <span className="font-mono text-[10px] text-ink-4">-</span>
              <span className="font-display text-base leading-none text-green">{existing.awayScore}</span>
              <span className="font-mono text-[9px] text-green ml-0.5">✓</span>
            </div>
          )}
          {!isLive && !isDone && !isLocked && !hasPick && (
            <span className="font-mono text-[9px] text-ink-3 whitespace-nowrap">
              {match.date.split(' ').slice(1).join(' ')} · {match.time}
            </span>
          )}
        </div>

        {/* away */}
        <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
          <span className="font-mono text-[11px] font-bold truncate">{match.away.code}</span>
          <Flag team={match.away} size={20} />
        </div>

        {isPickable && (
          <span className="font-mono text-[9px] text-ink-4 ml-2 flex-shrink-0">
            {expanded ? '▲' : hasPick ? '✎' : '▼'}
          </span>
        )}
      </button>

      {/* ── expanded picker ── */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            key="picker"
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            transition={{ type: 'spring', damping: 32, stiffness: 400 }}
            className="overflow-hidden"
          >
            <div className="px-4 py-5 bg-paper-deep border-t border-hairline">
              <p className="font-mono text-[9px] tracking-eyebrow text-ink-3 mb-1 text-center">
                PALPITE · PLACAR EXATO
              </p>
              <p className="font-mono text-[8px] text-ink-4 mb-4 text-center">{match.venue}</p>
              <div className="flex items-center justify-center gap-5">
                <div className="flex flex-col items-center gap-2 min-w-0">
                  <Flag team={match.home} size={40} />
                  <span className="font-mono text-[10px] font-bold">{match.home.name.split(' ')[0].toUpperCase()}</span>
                </div>
                <div className="flex items-center gap-3">
                  <ScoreControl value={home} onChange={handleHomeChange} />
                  <span className="font-serif-it text-2xl text-ink-3">×</span>
                  <ScoreControl value={away} onChange={handleAwayChange} />
                </div>
                <div className="flex flex-col items-center gap-2 min-w-0">
                  <Flag team={match.away} size={40} />
                  <span className="font-mono text-[10px] font-bold">{match.away.name.split(' ')[0].toUpperCase()}</span>
                </div>
              </div>
              <div className="flex gap-2 mt-5">
                <button onClick={handleSaveDraft} className="btn-ghost flex-1 text-[11px] py-2.5">
                  RASCUNHO
                </button>
                <button onClick={handleConfirm} className="btn-yellow text-[11px] py-2.5" style={{ flex: 2 }}>
                  CONFIRMAR ✓
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Mini-standings table (quem passa?) ───────────────────────────────────────

function MiniStandings({ standings, totalMatches, filledMatches }: {
  standings: StandingRow[]
  totalMatches: number
  filledMatches: number
}) {
  if (filledMatches === 0) return null

  const classified = standings.slice(0, 2)
  const eliminated = standings.slice(2)

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="mx-4 mb-4 border-2 border-ink overflow-hidden"
    >
      {/* Header */}
      <div className="px-3 py-2 bg-ink flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[9px] tracking-eyebrow text-paper/70">QUEM PASSA?</span>
          <span className="font-mono text-[8px] text-yellow font-bold">
            {filledMatches === totalMatches ? 'GRUPO COMPLETO' : `${filledMatches}/${totalMatches} jogos`}
          </span>
        </div>
        <span className="font-mono text-[8px] text-paper/40">baseado nos seus palpites</span>
      </div>

      {/* Table header */}
      <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-0 px-3 py-1.5 border-b border-hairline bg-paper-deep">
        <span className="font-mono text-[8px] text-ink-4">SELEÇÃO</span>
        <span className="font-mono text-[8px] text-ink-4 w-6 text-center">PTS</span>
        <span className="font-mono text-[8px] text-ink-4 w-6 text-center">GF</span>
        <span className="font-mono text-[8px] text-ink-4 w-6 text-center">GC</span>
        <span className="font-mono text-[8px] text-ink-4 w-8 text-center">SG</span>
      </div>

      {/* Classified */}
      {classified.map((row, i) => (
        <div
          key={row.code}
          className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-0 px-3 py-2 border-b border-hairline bg-green/5 items-center"
        >
          <div className="flex items-center gap-2">
            <span className="font-mono text-[9px] text-green font-bold">{i + 1}°</span>
            <Flag team={TEAMS[row.code]} size={16} />
            <span className="font-mono text-[10px] font-bold">{row.code}</span>
            <span className="font-mono text-[7px] text-green font-bold bg-green/10 px-1 py-0.5">PASSA</span>
          </div>
          <span className="font-display text-sm text-ink w-6 text-center">{row.pts}</span>
          <span className="font-mono text-[9px] text-ink-3 w-6 text-center">{row.gf}</span>
          <span className="font-mono text-[9px] text-ink-3 w-6 text-center">{row.ga}</span>
          <span className={cn('font-mono text-[9px] w-8 text-center', row.gd > 0 ? 'text-green' : row.gd < 0 ? 'text-red' : 'text-ink-4')}>
            {row.gd > 0 ? `+${row.gd}` : row.gd}
          </span>
        </div>
      ))}

      {/* Separator */}
      <div className="px-3 py-1 bg-hairline flex items-center gap-2">
        <div className="flex-1 h-px bg-ink-4/30" />
        <span className="font-mono text-[7px] text-ink-4 tracking-eyebrow">ELIMINADOS</span>
        <div className="flex-1 h-px bg-ink-4/30" />
      </div>

      {/* Eliminated */}
      {eliminated.map((row, i) => (
        <div
          key={row.code}
          className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-0 px-3 py-2 border-b border-hairline last:border-0 opacity-50 items-center"
        >
          <div className="flex items-center gap-2">
            <span className="font-mono text-[9px] text-ink-4">{i + 3}°</span>
            <Flag team={TEAMS[row.code]} size={16} />
            <span className="font-mono text-[10px]">{row.code}</span>
          </div>
          <span className="font-display text-sm text-ink-3 w-6 text-center">{row.pts}</span>
          <span className="font-mono text-[9px] text-ink-3 w-6 text-center">{row.gf}</span>
          <span className="font-mono text-[9px] text-ink-3 w-6 text-center">{row.ga}</span>
          <span className="font-mono text-[9px] text-ink-3 w-8 text-center">
            {row.gd > 0 ? `+${row.gd}` : row.gd}
          </span>
        </div>
      ))}
    </motion.div>
  )
}

// ─── Groups tab ───────────────────────────────────────────────────────────────

function GroupsTab() {
  const [selectedGroup, setSelectedGroup] = useState<string>('A')
  const { predictions } = usePredictionStore()
  const [tick, setTick] = useState(0)

  const countPerGroup = useMemo(() => {
    const map: Record<string, number> = {}
    for (const g of GROUP_LABELS) {
      map[g] = WC2026_MATCHES.filter(m => m.group === g && predictions[m.id]).length
    }
    return map
  }, [predictions, tick])

  const groupMatches = useMemo(
    () => WC2026_MATCHES.filter(m => m.group === selectedGroup),
    [selectedGroup]
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
    return computeStandings(selectedGroup, predMap)
  }, [selectedGroup, predictions, tick])

  const filledMatches = groupMatches.filter(m => {
    if (m.status === 'finished' || m.status === 'live') return true
    return !!predictions[m.id]
  }).length

  const handleScoreChange = useCallback(() => setTick(t => t + 1), [])

  return (
    <div className="pb-24">
      {/* Group pill selector */}
      <div className="px-3 py-3 border-b border-hairline bg-paper sticky top-[44px] z-10 overflow-x-auto">
        <div className="flex gap-1.5 min-w-max">
          {GROUP_LABELS.map(g => {
            const done = countPerGroup[g] === 6
            const active = g === selectedGroup
            return (
              <button
                key={g}
                onClick={() => setSelectedGroup(g)}
                className={[
                  'flex flex-col items-center px-3 py-2 border-2 transition-colors min-w-[44px]',
                  active ? 'bg-ink border-ink text-paper' :
                  done ? 'border-green text-green bg-green/5' :
                  'border-hairline text-ink-3 hover:border-ink hover:text-ink',
                ].join(' ')}
              >
                <span className="font-display text-sm leading-none">{g}</span>
                <span className="font-mono text-[7px] mt-0.5 opacity-60">
                  {countPerGroup[g] ?? 0}/6
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Group header */}
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-display text-xl">GRUPO {selectedGroup}</span>
          <div className="flex gap-1">
            {groupDef?.teams.map(code => (
              <Flag key={code} team={TEAMS[code]} size={18} />
            ))}
          </div>
        </div>
        <span className="font-mono text-[10px] text-ink-3">
          {doneInGroup}/{totalInGroup} palpites
        </span>
      </div>

      {/* Matchdays */}
      {[1, 2, 3].map(md => {
        const matches = byMatchday[md] ?? []
        if (!matches.length) return null
        return (
          <div key={md}>
            <div className="px-4 py-2 border-t border-hairline mt-2">
              <span className="font-mono text-[9px] tracking-eyebrow text-ink-3">
                RODADA {md}
              </span>
            </div>
            {matches.map(m => (
              <MatchRow key={m.id} match={m} onScoreChange={handleScoreChange} />
            ))}
          </div>
        )
      })}

      {/* Progress bar */}
      {doneInGroup > 0 && (
        <div className="mx-4 mt-4 mb-4">
          <div className="h-1 bg-hairline overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(doneInGroup / totalInGroup) * 100}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="h-full bg-green"
            />
          </div>
          <p className="font-mono text-[9px] text-ink-3 mt-1">
            {doneInGroup} de {totalInGroup} jogos do Grupo {selectedGroup} palpitados
          </p>
        </div>
      )}

      {/* Mini standings preview */}
      <MiniStandings
        standings={standings}
        totalMatches={totalInGroup}
        filledMatches={filledMatches}
      />

      {/* CTA when group complete */}
      {doneInGroup === totalInGroup && standings.length >= 2 && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-4 mb-4 p-3 border-2 border-yellow bg-yellow/10 flex items-center gap-3"
        >
          <div>
            <p className="font-mono text-[9px] tracking-eyebrow text-ink-3">GRUPO COMPLETO</p>
            <p className="font-display text-base leading-none">
              {standings[0]?.code} e {standings[1]?.code} avançam no seu palpite
            </p>
          </div>
        </motion.div>
      )}
    </div>
  )
}

// ─── Team picker grid (shared by champion + vice) ────────────────────────────

function TeamPickerGrid({
  label, pts, pick, onPick,
}: { label: string; pts: number; pick: string | null; onPick: (code: string) => void }) {
  return (
    <div>
      <div className="flex items-baseline gap-2 mb-3">
        <span className="font-display text-2xl leading-none">{label}</span>
        <span className="font-mono text-[9px] text-ink-3">+{pts} pontos</span>
      </div>
      {pick && (
        <div className="mb-3 flex items-center gap-2.5 p-2.5 border-2 border-ink bg-yellow">
          <Flag team={TEAMS[pick]} size={28} />
          <div className="flex-1">
            <p className="font-mono text-[8px] tracking-eyebrow text-ink-3">ESCOLHIDO</p>
            <p className="font-display text-base leading-none">{TEAMS[pick]?.name.toUpperCase()}</p>
          </div>
          <span className="font-mono text-[10px] text-green font-bold">✓</span>
        </div>
      )}
      <div className="space-y-3">
        {WC2026_GROUPS.map(group => (
          <div key={group.id}>
            <p className="font-mono text-[8px] tracking-eyebrow text-ink-4 mb-1.5">GRUPO {group.id}</p>
            <div className="grid grid-cols-4 gap-1.5">
              {group.teams.map(code => {
                const team = TEAMS[code]
                if (!team) return null
                const selected = pick === code
                return (
                  <motion.button
                    key={code}
                    onClick={() => onPick(code)}
                    whileTap={{ scale: 0.95 }}
                    className={[
                      'flex flex-col items-center gap-1 py-2 px-1 border-2 transition-colors',
                      selected ? 'border-ink bg-yellow' : 'border-hairline hover:border-ink',
                    ].join(' ')}
                  >
                    <Flag team={team} size={24} />
                    <span className="font-mono text-[7px] font-bold">{code}</span>
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

// ─── Champion tab (campeão + vice + artilheiro) ───────────────────────────────

const GENERAL_DEADLINE = new Date('2026-06-11T18:00:00Z')

function ChampionTab() {
  const { championPick, vicePick, scorerPick, setChampionPick, setVicePick, setScorerPick } = usePredictionStore()
  const [scorerInput, setScorerInput] = useState(scorerPick ?? '')
  const [section, setSection] = useState<'champion' | 'vice' | 'scorer'>('champion')

  const now = new Date()
  const isDeadlinePassed = now >= GENERAL_DEADLINE
  const allSet = championPick && vicePick && scorerPick

  const deadlineStr = '11 Jun · 16:00'

  return (
    <div className="px-4 py-6 pb-24">
      <div className="mb-5">
        <div className="font-display text-4xl leading-none text-ink">APOSTAS GERAIS</div>
        <div className="font-serif-it text-xl text-green-deep leading-snug mt-0.5">
          obrigatórias antes da primeira partida
        </div>
        <div className={cn(
          'mt-2 inline-flex items-center gap-2 px-3 py-1.5 border font-mono text-[10px]',
          isDeadlinePassed
            ? 'border-red/40 bg-red/5 text-red'
            : 'border-yellow/40 bg-yellow/5 text-ink-3'
        )}>
          {isDeadlinePassed ? '■ ENCERRADO' : 'PRAZO:'} {deadlineStr}
        </div>
      </div>

      <div className="flex gap-2 mb-5">
        {[
          { id: 'champion' as const, label: 'CAMPEÃO',   pts: 25, done: !!championPick },
          { id: 'vice' as const,     label: 'VICE',       pts: 15, done: !!vicePick },
          { id: 'scorer' as const,   label: 'ARTILHEIRO', pts: 10, done: !!scorerPick },
        ].map(s => (
          <button
            key={s.id}
            onClick={() => !isDeadlinePassed && setSection(s.id)}
            disabled={isDeadlinePassed && !s.done}
            className={[
              'flex-1 py-2.5 border-2 transition-colors',
              section === s.id ? 'border-ink bg-ink text-paper' :
              s.done ? 'border-green bg-green/5' : 'border-hairline hover:border-ink',
              isDeadlinePassed ? 'opacity-60 cursor-default' : '',
            ].join(' ')}
          >
            <div className="font-mono text-[8px] tracking-eyebrow">{s.label}</div>
            <div className="font-mono text-[8px] text-current/60">+{s.pts} pts</div>
            {s.done && <div className="font-mono text-[8px] text-green">✓</div>}
          </button>
        ))}
      </div>

      {isDeadlinePassed && (
        <div className="mb-5 p-3 border border-red/30 bg-red/5">
          <p className="font-mono text-[10px] text-red">
            Apostas gerais encerradas. As apostas travaram no início da competição.
          </p>
        </div>
      )}

      {!isDeadlinePassed && section === 'champion' && (
        <TeamPickerGrid label="CAMPEÃO" pts={25} pick={championPick} onPick={setChampionPick} />
      )}
      {!isDeadlinePassed && section === 'vice' && (
        <TeamPickerGrid label="VICE-CAMPEÃO" pts={15} pick={vicePick} onPick={setVicePick} />
      )}
      {!isDeadlinePassed && section === 'scorer' && (
        <div>
          <div className="flex items-baseline gap-2 mb-3">
            <span className="font-display text-2xl leading-none">ARTILHEIRO</span>
            <span className="font-mono text-[9px] text-ink-3">+10 pts · critério de desempate</span>
          </div>
          <p className="font-mono text-[10px] text-ink-3 mb-4">
            Quem você acha que vai ser o artilheiro da Copa 2026? Esse palpite é critério de desempate — muito importante!
          </p>
          <div className="border-2 border-ink p-4">
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
              className="mt-3 btn-yellow w-full text-[11px] disabled:opacity-40"
            >
              {scorerPick ? `ALTERAR — ${scorerPick}` : 'CONFIRMAR ARTILHEIRO ✓'}
            </button>
            {scorerPick && (
              <p className="font-mono text-[10px] text-green mt-2 text-center">
                Salvo: {scorerPick} ✓
              </p>
            )}
          </div>
          <p className="font-mono text-[9px] text-ink-4 mt-3">
            Reg. 7: em caso de empate, vale quem mais gols fez entre os artilheiros escolhidos pelos empatados.
          </p>
        </div>
      )}

      {isDeadlinePassed && (
        <div className="space-y-3">
          {championPick && (
            <div className="flex items-center gap-3 p-3 border border-hairline">
              <Flag team={TEAMS[championPick]} size={32} />
              <div>
                <p className="font-mono text-[8px] tracking-eyebrow text-ink-4">CAMPEÃO</p>
                <p className="font-display text-lg">{TEAMS[championPick]?.name.toUpperCase()}</p>
              </div>
              <span className="ml-auto font-mono text-[9px] text-green">✓ +25pts</span>
            </div>
          )}
          {vicePick && (
            <div className="flex items-center gap-3 p-3 border border-hairline">
              <Flag team={TEAMS[vicePick]} size={32} />
              <div>
                <p className="font-mono text-[8px] tracking-eyebrow text-ink-4">VICE</p>
                <p className="font-display text-lg">{TEAMS[vicePick]?.name.toUpperCase()}</p>
              </div>
              <span className="ml-auto font-mono text-[9px] text-green">✓ +15pts</span>
            </div>
          )}
          {scorerPick && (
            <div className="flex items-center gap-3 p-3 border border-hairline">
              <div className="w-8 h-8 flex items-center justify-center border-2 border-hairline font-display text-lg">○</div>
              <div>
                <p className="font-mono text-[8px] tracking-eyebrow text-ink-4">ARTILHEIRO</p>
                <p className="font-display text-lg">{scorerPick.toUpperCase()}</p>
              </div>
              <span className="ml-auto font-mono text-[9px] text-green">✓ +10pts</span>
            </div>
          )}
        </div>
      )}

      {allSet && !isDeadlinePassed && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 p-4 bg-green/10 border-2 border-green text-center"
        >
          <p className="font-display text-xl text-green">APOSTAS GERAIS FEITAS ✓</p>
          <p className="font-mono text-[10px] text-green/70 mt-1">
            Campeão: {TEAMS[championPick]?.name} · Vice: {TEAMS[vicePick]?.name} · Artilheiro: {scorerPick}
          </p>
        </motion.div>
      )}
    </div>
  )
}

// ─── Desktop sidebar ──────────────────────────────────────────────────────────

function DesktopGroupView({
  selectedGroup,
  predictions,
}: {
  selectedGroup: string
  predictions: Record<string, { homeScore: number; awayScore: number }>
}) {
  const [tick, setTick] = useState(0)
  const handleScoreChange = useCallback(() => setTick(t => t + 1), [])

  const groupMatches = useMemo(
    () => WC2026_MATCHES.filter(m => m.group === selectedGroup),
    [selectedGroup]
  )

  const standings = useMemo(
    () => computeStandings(selectedGroup, predictions),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedGroup, predictions, tick]
  )

  const filledMatches = groupMatches.filter(m => {
    if (m.status === 'finished' || m.status === 'live') return true
    return !!predictions[m.id]
  }).length

  const countPerGroup = useMemo(() => {
    return WC2026_MATCHES.filter(m => m.group === selectedGroup && predictions[m.id]).length
  }, [selectedGroup, predictions, tick])

  return (
    <div className="border-2 border-ink flex flex-col">
      <div className="px-5 py-4 border-b border-hairline flex items-center gap-3">
        <span className="font-display text-xl">GRUPO {selectedGroup}</span>
        <div className="flex gap-1">
          {WC2026_GROUPS.find(g => g.id === selectedGroup)?.teams.map(code => (
            <Flag key={code} team={TEAMS[code]} size={20} />
          ))}
        </div>
        <span className="ml-auto font-mono text-[10px] text-ink-3">
          {countPerGroup}/6 palpites
        </span>
      </div>

      {[1, 2, 3].map(md => {
        const matches = WC2026_MATCHES.filter(
          m => m.group === selectedGroup && m.stageLabel.endsWith(`MD${md}`)
        )
        if (!matches.length) return null
        return (
          <div key={md}>
            <div className="px-5 py-2.5 border-b border-hairline bg-paper-deep">
              <span className="font-mono text-[9px] tracking-eyebrow text-ink-3">RODADA {md}</span>
            </div>
            {matches.map(m => (
              <MatchRow key={m.id} match={m} onScoreChange={handleScoreChange} />
            ))}
          </div>
        )
      })}

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
    <div className="border-2 border-ink">
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
              className={[
                'w-full px-4 py-3 flex items-center justify-between transition-colors',
                active ? 'bg-yellow' : 'hover:bg-hairline',
              ].join(' ')}
            >
              <div className="flex items-center gap-2">
                <span className="font-display text-base">GRUPO {g}</span>
                <div className="flex gap-0.5">
                  {WC2026_GROUPS.find(gr => gr.id === g)?.teams.map(code => (
                    <Flag key={code} team={TEAMS[code]} size={14} />
                  ))}
                </div>
              </div>
              <span className={['font-mono text-[9px]', done ? 'text-green' : 'text-ink-3'].join(' ')}>
                {countPerGroup[g] ?? 0}/6 {done ? '✓' : ''}
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
  const initialTab: PredTab = rawTab === 'champion' ? 'champion' : 'groups'
  const [tab, setTab] = useState<PredTab>(initialTab)

  const initialGroup = useMemo(() => {
    if (!matchId) return 'A'
    const m = WC2026_MATCHES.find(m => m.id === matchId)
    return m?.group ?? 'A'
  }, [matchId])

  const [selectedGroup, setSelectedGroup] = useState(initialGroup)
  const { predictions } = usePredictionStore()
  const navigate = useNavigate()
  const isDesktop = useIsDesktop()

  const predMap = useMemo(() => {
    const m: Record<string, { homeScore: number; awayScore: number }> = {}
    for (const [matchId, pred] of Object.entries(predictions)) {
      m[matchId] = { homeScore: pred.homeScore, awayScore: pred.awayScore }
    }
    return m
  }, [predictions])

  const countPerGroup = useMemo(() => {
    const map: Record<string, number> = {}
    for (const g of GROUP_LABELS) {
      map[g] = WC2026_MATCHES.filter(m => m.group === g && predictions[m.id]).length
    }
    return map
  }, [predictions])

  const totalDone = Object.values(predictions).length
  const totalMatches = WC2026_MATCHES.length

  const tabs = [
    { id: 'groups' as const,   label: 'GRUPOS' },
    { id: 'champion' as const, label: 'APOSTAS GERAIS' },
  ]

  return (
    <div className="min-h-dvh bg-paper">
      {/* ── Editorial header ── */}
      <div className="border-b border-hairline px-4 pt-6 pb-5 md:px-8 md:pt-8 md:pb-6">
        <div className="flex items-end justify-between">
          <div>
            <div className="font-display text-5xl md:text-7xl leading-none text-ink">PALPITA</div>
            <div className="flex items-baseline gap-3">
              <span className="font-serif-it text-3xl md:text-5xl text-green-deep leading-none">tudo,</span>
              <span className="font-mono text-[10px] tracking-eyebrow text-ink-3 self-end mb-1">jogador.</span>
            </div>
          </div>
          <div className="text-right hidden md:block">
            <div className="font-display text-3xl text-ink">{totalDone}</div>
            <div className="font-mono text-[9px] text-ink-3">de {totalMatches} jogos</div>
          </div>
        </div>
      </div>

      {/* ── Tabs + Chave link ── */}
      <div className="border-b border-hairline flex sticky top-0 lg:top-14 bg-paper z-20">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={[
              'flex-1 py-3 font-mono text-[10px] font-bold tracking-eyebrow border-b-2 transition-colors',
              tab === t.id ? 'border-ink text-ink' : 'border-transparent text-ink-3 hover:text-ink',
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
        <button
          onClick={() => navigate('/bracket')}
          className="px-4 py-3 font-mono text-[10px] font-bold tracking-eyebrow text-ink-4 hover:text-ink border-b-2 border-transparent transition-colors border-l border-hairline flex-shrink-0"
        >
          MINHA CHAVE ↗
        </button>
      </div>

      {/* ── Content ── */}
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
                <DesktopGroupView
                  selectedGroup={selectedGroup}
                  predictions={predMap}
                />
              </div>
            ) : (
              <GroupsTab />
            )}
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
