import { useState, useMemo, useCallback } from 'react'
import { useParams, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Flag } from '@/components/shared/Flag'
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
      <span className="inline-flex items-center gap-1 font-mono text-[8px] font-bold tracking-eyebrow text-red">
        <span className="w-1.5 h-1.5 rounded-full bg-red animate-pulse-live" />
        {match.liveMinute ? `${match.liveMinute}'` : 'AO VIVO'}
      </span>
    )
  }
  if (match.status === 'finished') {
    return <span className="font-mono text-[8px] tracking-eyebrow text-ink-4">ENCERRADO</span>
  }
  if (match.status === 'locked') {
    return <span className="font-mono text-[8px] tracking-eyebrow text-ink-4">■ BLOQUEADO</span>
  }
  return <span className="font-mono text-[8px] tracking-eyebrow text-green font-bold">ABERTO</span>
}

// ─── Match row ────────────────────────────────────────────────────────────────

function MatchRow({ match }: { match: Match }) {
  const { predictions, confirmPrediction } = usePredictionStore()
  const userId = useAuthStore(s => s.user?.id ?? 'me')
  const existing = predictions[match.id]

  const [expanded, setExpanded] = useState(false)
  const [home, setHome] = useState(existing?.homeScore ?? 0)
  const [away, setAway] = useState(existing?.awayScore ?? 0)

  const isPickable = isBetOpen(match)
  const isLocked = match.status === 'locked' || (!isPickable && (match.status === 'open' || match.status === 'scheduled'))
  const isLive = match.status === 'live'
  const isDone = match.status === 'finished'
  const hasPick = !!existing

  const handleConfirm = () => {
    const result = confirmPrediction({
      id: `pred-${match.id}`,
      userId,
      matchId: match.id,
      homeScore: home,
      awayScore: away,
      submittedAt: new Date().toISOString(),
    })
    if (!result.ok) return
    setExpanded(false)
  }

  const toggle = () => {
    if (!isPickable) return
    if (!expanded && existing) {
      setHome(existing.homeScore)
      setAway(existing.awayScore)
    }
    setExpanded(v => !v)
  }

  return (
    <div className={cn(
      'border-b border-hairline last:border-0 transition-colors',
      hasPick && isPickable ? 'bg-green/[0.04]' : '',
    )}>
      {/* Collapsed row */}
      <button
        onClick={toggle}
        className={cn(
          'w-full px-4 py-3.5 flex items-center gap-3 text-left',
          isPickable ? 'cursor-pointer hover:bg-paper-deep' : 'cursor-default',
        )}
      >
        {/* Home */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Flag team={match.home} size={32} />
          <div className="min-w-0">
            <div className="font-mono text-[11px] font-bold leading-tight">{match.home.code}</div>
            <div className="font-mono text-[9px] text-ink-4 truncate leading-tight">
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
              : <span className="font-mono text-[9px] text-ink-4">sem palpite</span>
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
              <span className="font-mono text-[8px] text-ink-4">{match.time} BRT</span>
            </div>
          )}
          <StatusChip match={match} />
        </div>

        {/* Away */}
        <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
          <div className="min-w-0 text-right">
            <div className="font-mono text-[11px] font-bold leading-tight">{match.away.code}</div>
            <div className="font-mono text-[9px] text-ink-4 truncate leading-tight">
              {match.away.name}
            </div>
          </div>
          <Flag team={match.away} size={32} />
        </div>

        {isPickable && (
          <span className="font-mono text-[9px] text-ink-4 flex-shrink-0 w-3 text-center">
            {expanded ? '▲' : '▼'}
          </span>
        )}
      </button>

      {/* Score picker */}
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
            <div className="px-4 pt-5 pb-5 bg-paper-deep border-t border-hairline">
              <p className="font-mono text-[9px] tracking-eyebrow text-ink-3 text-center mb-1">
                QUAL VAI SER O PLACAR?
              </p>
              <p className="font-mono text-[8px] text-ink-4 text-center mb-5">
                {match.venue} · {formatMatchDateTime(match)}
              </p>

              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-col items-center gap-2 flex-1">
                  <Flag team={match.home} size={44} />
                  <span className="font-mono text-[9px] font-bold text-center leading-tight">
                    {match.home.name.toUpperCase()}
                  </span>
                  <ScoreInput value={home} onChange={setHome} />
                </div>

                <span className="font-serif-it text-3xl text-ink-3 flex-shrink-0 mb-6">×</span>

                <div className="flex flex-col items-center gap-2 flex-1">
                  <Flag team={match.away} size={44} />
                  <span className="font-mono text-[9px] font-bold text-center leading-tight">
                    {match.away.name.toUpperCase()}
                  </span>
                  <ScoreInput value={away} onChange={setAway} />
                </div>
              </div>

              <button
                onClick={handleConfirm}
                className="btn-yellow w-full text-[11px] py-3 mt-5 tracking-eyebrow font-bold"
              >
                {hasPick ? 'ATUALIZAR PALPITE ✓' : 'CONFIRMAR PALPITE ✓'}
              </button>
            </div>
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
  const eliminated = standings.slice(2)

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="mx-4 mb-4 border-2 border-ink overflow-hidden"
    >
      <div className="px-3 py-2 bg-ink flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[9px] tracking-eyebrow text-paper/70">QUEM PASSA?</span>
          <span className="font-mono text-[8px] text-paper/40">seus palpites</span>
        </div>
        <span className="font-mono text-[8px] text-yellow font-bold">
          {filledMatches === totalMatches ? '✓ COMPLETO' : `${filledMatches}/${totalMatches} jogos`}
        </span>
      </div>

      {/* Header */}
      <div className="grid grid-cols-[1fr_36px_28px_36px] px-3 py-1.5 border-b border-hairline bg-paper-deep">
        <span className="font-mono text-[8px] text-ink-4">SELEÇÃO</span>
        <span className="font-mono text-[8px] text-ink-4 text-center">PTS</span>
        <span className="font-mono text-[8px] text-ink-4 text-center">J</span>
        <span className="font-mono text-[8px] text-ink-4 text-center">SALDO</span>
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

      <div className="px-3 py-1 flex items-center gap-2">
        <div className="flex-1 h-px bg-hairline" />
        <span className="font-mono text-[7px] text-ink-4 tracking-eyebrow">eliminados</span>
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

// ─── Groups tab ───────────────────────────────────────────────────────────────

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
      <div className="px-3 py-3 border-b border-hairline bg-paper sticky top-[44px] z-10 overflow-x-auto">
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
                  'flex flex-col items-center px-2.5 py-2 border-2 transition-colors min-w-[52px] gap-1',
                  active ? 'bg-ink border-ink text-paper' :
                  done  ? 'border-green text-green bg-green/5' :
                          'border-hairline text-ink-3 hover:border-ink hover:text-ink',
                )}
              >
                <span className="font-display text-sm leading-none">GRP {g}</span>
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
            {matches.map(m => <MatchRow key={m.id} match={m} />)}
          </div>
        )
      })}

      {/* Standings */}
      <div className="mt-4">
        <MiniStandings
          standings={standings}
          totalMatches={totalInGroup}
          filledMatches={filledMatches}
        />
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

type KoRound = 'r32' | 'r16' | 'qf' | 'sf' | 'final'

const KO_ROUNDS: { id: KoRound; label: string; short: string; matchCount: number }[] = [
  { id: 'r32',   label: 'RODADA DE 32',     short: '32',      matchCount: 16 },
  { id: 'r16',   label: 'OITAVAS DE FINAL', short: 'OITAVAS', matchCount: 8  },
  { id: 'qf',    label: 'QUARTAS DE FINAL', short: 'QUARTAS', matchCount: 4  },
  { id: 'sf',    label: 'SEMIFINAIS',       short: 'SEMI',    matchCount: 2  },
  { id: 'final', label: 'FINAL',            short: 'FINAL',   matchCount: 1  },
]

interface KoR32Def {
  slotId: string
  homeGroup: string
  homeRank: 1 | 2
  awayGroup: string
  awayRank: 1 | 2
  label: string
}

const KO_R32_DEFS: KoR32Def[] = [
  { slotId: 'ko-r32-1',  homeGroup: 'A', homeRank: 1, awayGroup: 'B', awayRank: 2, label: 'J1'  },
  { slotId: 'ko-r32-2',  homeGroup: 'C', homeRank: 1, awayGroup: 'D', awayRank: 2, label: 'J2'  },
  { slotId: 'ko-r32-3',  homeGroup: 'E', homeRank: 1, awayGroup: 'F', awayRank: 2, label: 'J3'  },
  { slotId: 'ko-r32-4',  homeGroup: 'G', homeRank: 1, awayGroup: 'H', awayRank: 2, label: 'J4'  },
  { slotId: 'ko-r32-5',  homeGroup: 'I', homeRank: 1, awayGroup: 'J', awayRank: 2, label: 'J5'  },
  { slotId: 'ko-r32-6',  homeGroup: 'K', homeRank: 1, awayGroup: 'L', awayRank: 2, label: 'J6'  },
  { slotId: 'ko-r32-7',  homeGroup: 'B', homeRank: 1, awayGroup: 'A', awayRank: 2, label: 'J7'  },
  { slotId: 'ko-r32-8',  homeGroup: 'D', homeRank: 1, awayGroup: 'C', awayRank: 2, label: 'J8'  },
  { slotId: 'ko-r32-9',  homeGroup: 'F', homeRank: 1, awayGroup: 'E', awayRank: 2, label: 'J9'  },
  { slotId: 'ko-r32-10', homeGroup: 'H', homeRank: 1, awayGroup: 'G', awayRank: 2, label: 'J10' },
  { slotId: 'ko-r32-11', homeGroup: 'J', homeRank: 1, awayGroup: 'I', awayRank: 2, label: 'J11' },
  { slotId: 'ko-r32-12', homeGroup: 'L', homeRank: 1, awayGroup: 'K', awayRank: 2, label: 'J12' },
  { slotId: 'ko-r32-13', homeGroup: 'A', homeRank: 2, awayGroup: 'C', awayRank: 2, label: 'J13' },
  { slotId: 'ko-r32-14', homeGroup: 'B', homeRank: 2, awayGroup: 'D', awayRank: 2, label: 'J14' },
  { slotId: 'ko-r32-15', homeGroup: 'E', homeRank: 2, awayGroup: 'G', awayRank: 2, label: 'J15' },
  { slotId: 'ko-r32-16', homeGroup: 'I', homeRank: 2, awayGroup: 'K', awayRank: 2, label: 'J16' },
]

interface KoNextDef { slotId: string; slot1: string; slot2: string; label: string }

const KO_R16_DEFS: KoNextDef[] = [
  { slotId: 'ko-r16-1', slot1: 'ko-r32-1',  slot2: 'ko-r32-2',  label: 'J17' },
  { slotId: 'ko-r16-2', slot1: 'ko-r32-3',  slot2: 'ko-r32-4',  label: 'J18' },
  { slotId: 'ko-r16-3', slot1: 'ko-r32-5',  slot2: 'ko-r32-6',  label: 'J19' },
  { slotId: 'ko-r16-4', slot1: 'ko-r32-7',  slot2: 'ko-r32-8',  label: 'J20' },
  { slotId: 'ko-r16-5', slot1: 'ko-r32-9',  slot2: 'ko-r32-10', label: 'J21' },
  { slotId: 'ko-r16-6', slot1: 'ko-r32-11', slot2: 'ko-r32-12', label: 'J22' },
  { slotId: 'ko-r16-7', slot1: 'ko-r32-13', slot2: 'ko-r32-14', label: 'J23' },
  { slotId: 'ko-r16-8', slot1: 'ko-r32-15', slot2: 'ko-r32-16', label: 'J24' },
]

const KO_QF_DEFS: KoNextDef[] = [
  { slotId: 'ko-qf-1', slot1: 'ko-r16-1', slot2: 'ko-r16-2', label: 'J25' },
  { slotId: 'ko-qf-2', slot1: 'ko-r16-3', slot2: 'ko-r16-4', label: 'J26' },
  { slotId: 'ko-qf-3', slot1: 'ko-r16-5', slot2: 'ko-r16-6', label: 'J27' },
  { slotId: 'ko-qf-4', slot1: 'ko-r16-7', slot2: 'ko-r16-8', label: 'J28' },
]

const KO_SF_DEFS: KoNextDef[] = [
  { slotId: 'ko-sf-1', slot1: 'ko-qf-1', slot2: 'ko-qf-2', label: 'J29' },
  { slotId: 'ko-sf-2', slot1: 'ko-qf-3', slot2: 'ko-qf-4', label: 'J30' },
]

const KO_3RD_DEF   = { slotId: 'ko-3rd-1',   slot1: 'ko-sf-1', slot2: 'ko-sf-2', label: '3° LUGAR' }
const KO_FINAL_DEF = { slotId: 'ko-final-1', slot1: 'ko-sf-1', slot2: 'ko-sf-2', label: 'FINAL'    }

// ─── Knockout team resolution ─────────────────────────────────────────────────

interface KoTeams { home: string | null; away: string | null }

function resolveKoTeams(
  groupPredMap: Record<string, { homeScore: number; awayScore: number }>,
  koPredictions: Record<string, { homeScore: number; awayScore: number }>,
  allMatches: Match[]
): Record<string, KoTeams> {
  const result: Record<string, KoTeams> = {}

  const groupTop2: Record<string, [string | null, string | null]> = {}
  for (const g of GROUP_LABELS) {
    groupTop2[g] = computeGroupTop2(g, groupPredMap, allMatches)
  }

  for (const def of KO_R32_DEFS) {
    const [h1, h2] = groupTop2[def.homeGroup] ?? [null, null]
    const [a1, a2] = groupTop2[def.awayGroup] ?? [null, null]
    result[def.slotId] = {
      home: def.homeRank === 1 ? h1 : h2,
      away: def.awayRank === 1 ? a1 : a2,
    }
  }

  const getWinner = (slotId: string): string | null => {
    const teams = result[slotId]
    if (!teams?.home || !teams?.away) return null
    const pred = koPredictions[slotId]
    if (!pred) return null
    if (pred.homeScore > pred.awayScore) return teams.home
    if (pred.awayScore > pred.homeScore) return teams.away
    return null
  }

  const getLoser = (slotId: string): string | null => {
    const teams = result[slotId]
    if (!teams?.home || !teams?.away) return null
    const pred = koPredictions[slotId]
    if (!pred) return null
    if (pred.homeScore > pred.awayScore) return teams.away
    if (pred.awayScore > pred.homeScore) return teams.home
    return null
  }

  for (const def of KO_R16_DEFS) {
    result[def.slotId] = { home: getWinner(def.slot1), away: getWinner(def.slot2) }
  }
  for (const def of KO_QF_DEFS) {
    result[def.slotId] = { home: getWinner(def.slot1), away: getWinner(def.slot2) }
  }
  for (const def of KO_SF_DEFS) {
    result[def.slotId] = { home: getWinner(def.slot1), away: getWinner(def.slot2) }
  }

  result[KO_3RD_DEF.slotId] = {
    home: getLoser(KO_3RD_DEF.slot1),
    away: getLoser(KO_3RD_DEF.slot2),
  }
  result[KO_FINAL_DEF.slotId] = {
    home: getWinner(KO_FINAL_DEF.slot1),
    away: getWinner(KO_FINAL_DEF.slot2),
  }

  return result
}

// ─── Knockout match row ───────────────────────────────────────────────────────

function KoMatchRow({ slotId, label, home, away }: {
  slotId: string
  label: string
  home: string | null
  away: string | null
}) {
  const { predictions, confirmPrediction } = usePredictionStore()
  const userId = useAuthStore(s => s.user?.id ?? 'me')
  const existing = predictions[slotId]

  const [expanded, setExpanded] = useState(false)
  const [homeScore, setHomeScore] = useState(existing?.homeScore ?? 0)
  const [awayScore, setAwayScore] = useState(existing?.awayScore ?? 0)

  const homeTeam = home ? TEAMS[home] : null
  const awayTeam = away ? TEAMS[away] : null
  const isTBD = !home || !away
  const hasPick = !!existing && !isTBD

  const handleConfirm = () => {
    const result = confirmPrediction({
      id: `pred-${slotId}`,
      userId,
      matchId: slotId,
      homeScore,
      awayScore,
      submittedAt: new Date().toISOString(),
    })
    if (!result.ok) return
    setExpanded(false)
  }

  const toggle = () => {
    if (isTBD) return
    if (!expanded && existing) {
      setHomeScore(existing.homeScore)
      setAwayScore(existing.awayScore)
    }
    setExpanded(v => !v)
  }

  return (
    <div className="border-b border-hairline last:border-0">
      <button
        onClick={toggle}
        className={cn(
          'w-full px-4 py-3.5 flex items-center gap-3 text-left transition-colors',
          !isTBD ? 'hover:bg-paper-deep cursor-pointer' : 'cursor-default opacity-50',
          hasPick ? 'bg-green/[0.04]' : '',
        )}
      >
        {/* Home */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {homeTeam
            ? <Flag team={homeTeam} size={32} />
            : <div className="w-8 h-8 rounded-full bg-hairline border border-ink/10 flex-shrink-0 flex items-center justify-center">
                <span className="font-mono text-[7px] text-ink-4">?</span>
              </div>
          }
          <div className="min-w-0">
            <div className="font-mono text-[11px] font-bold leading-tight">{home ?? 'A DEFINIR'}</div>
            {homeTeam && (
              <div className="font-mono text-[9px] text-ink-4 truncate leading-tight">{homeTeam.name}</div>
            )}
          </div>
        </div>

        {/* Center */}
        <div className="flex flex-col items-center gap-0.5 flex-shrink-0 min-w-[72px]">
          <span className="font-mono text-[8px] text-ink-4 mb-0.5">{label}</span>
          {hasPick ? (
            <div className="flex items-center gap-1">
              <span className="font-display text-xl text-green">{existing.homeScore}–{existing.awayScore}</span>
              <span className="font-mono text-[9px] text-green">✓</span>
            </div>
          ) : (
            <span className="font-mono text-[9px] text-ink-3">
              {isTBD ? 'aguardando' : 'palpitar'}
            </span>
          )}
        </div>

        {/* Away */}
        <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
          <div className="min-w-0 text-right">
            <div className="font-mono text-[11px] font-bold leading-tight">{away ?? 'A DEFINIR'}</div>
            {awayTeam && (
              <div className="font-mono text-[9px] text-ink-4 truncate leading-tight">{awayTeam.name}</div>
            )}
          </div>
          {awayTeam
            ? <Flag team={awayTeam} size={32} />
            : <div className="w-8 h-8 rounded-full bg-hairline border border-ink/10 flex-shrink-0 flex items-center justify-center">
                <span className="font-mono text-[7px] text-ink-4">?</span>
              </div>
          }
        </div>

        {!isTBD && (
          <span className="font-mono text-[9px] text-ink-4 flex-shrink-0 w-3 text-center">
            {expanded ? '▲' : '▼'}
          </span>
        )}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            key="ko-picker"
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            transition={{ type: 'spring', damping: 32, stiffness: 400 }}
            className="overflow-hidden"
          >
            <div className="px-4 pt-5 pb-5 bg-paper-deep border-t border-hairline">
              <p className="font-mono text-[9px] tracking-eyebrow text-ink-3 text-center mb-1">
                QUAL VAI SER O PLACAR? · {label}
              </p>
              <p className="font-mono text-[8px] text-ink-4 text-center mb-5">
                Empate → prorrogação / pênaltis (não avança no seu palpite)
              </p>

              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-col items-center gap-2 flex-1">
                  {homeTeam && <Flag team={homeTeam} size={44} />}
                  <span className="font-mono text-[9px] font-bold text-center leading-tight">
                    {home}
                  </span>
                  <ScoreInput value={homeScore} onChange={setHomeScore} />
                </div>

                <span className="font-serif-it text-3xl text-ink-3 flex-shrink-0 mb-6">×</span>

                <div className="flex flex-col items-center gap-2 flex-1">
                  {awayTeam && <Flag team={awayTeam} size={44} />}
                  <span className="font-mono text-[9px] font-bold text-center leading-tight">
                    {away}
                  </span>
                  <ScoreInput value={awayScore} onChange={setAwayScore} />
                </div>
              </div>

              <button onClick={handleConfirm} className="btn-yellow w-full text-[11px] py-3 mt-5 tracking-eyebrow font-bold">
                {hasPick ? 'ATUALIZAR PALPITE ✓' : 'CONFIRMAR PALPITE ✓'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Knockout tab ─────────────────────────────────────────────────────────────

function KnockoutTab() {
  const [activeRound, setActiveRound] = useState<KoRound>('r32')
  const { predictions, lastError, clearError } = usePredictionStore()
  const allMatches = useMatchesWithStatus(WC2026_MATCHES)

  const groupPredMap = useMemo(() => {
    const m: Record<string, { homeScore: number; awayScore: number }> = {}
    for (const [matchId, pred] of Object.entries(predictions)) {
      if (!matchId.startsWith('ko-')) {
        m[matchId] = { homeScore: pred.homeScore, awayScore: pred.awayScore }
      }
    }
    return m
  }, [predictions])

  const koPredMap = useMemo(() => {
    const m: Record<string, { homeScore: number; awayScore: number }> = {}
    for (const [matchId, pred] of Object.entries(predictions)) {
      if (matchId.startsWith('ko-')) {
        m[matchId] = { homeScore: pred.homeScore, awayScore: pred.awayScore }
      }
    }
    return m
  }, [predictions])

  const koTeams = useMemo(
    () => resolveKoTeams(groupPredMap, koPredMap, allMatches),
    [groupPredMap, koPredMap, allMatches]
  )

  const hasGroupPreds = Object.keys(groupPredMap).length > 0

  const countPicked = useMemo(() => {
    const counts: Record<KoRound, number> = { r32: 0, r16: 0, qf: 0, sf: 0, final: 0 }
    for (const [key] of Object.entries(koPredMap)) {
      if (key.startsWith('ko-r32-'))        counts.r32++
      else if (key.startsWith('ko-r16-'))   counts.r16++
      else if (key.startsWith('ko-qf-'))    counts.qf++
      else if (key.startsWith('ko-sf-'))    counts.sf++
      else if (key.startsWith('ko-final-') || key.startsWith('ko-3rd-')) counts.final++
    }
    return counts
  }, [koPredMap])

  const getRoundSlots = (round: KoRound) => {
    switch (round) {
      case 'r32':   return KO_R32_DEFS.map(d => ({ slotId: d.slotId, label: d.label }))
      case 'r16':   return KO_R16_DEFS.map(d => ({ slotId: d.slotId, label: d.label }))
      case 'qf':    return KO_QF_DEFS.map(d => ({ slotId: d.slotId, label: d.label }))
      case 'sf':    return [...KO_SF_DEFS, KO_3RD_DEF].map(d => ({ slotId: d.slotId, label: d.label }))
      case 'final': return [KO_FINAL_DEF].map(d => ({ slotId: d.slotId, label: d.label }))
    }
  }

  const roundMaxCount: Record<KoRound, number> = { r32: 16, r16: 8, qf: 4, sf: 3, final: 1 }

  const finalSlot = koTeams['ko-final-1']
  const finalPred = koPredMap['ko-final-1']
  const champion = finalPred && finalSlot?.home && finalSlot?.away
    ? (finalPred.homeScore > finalPred.awayScore ? finalSlot.home
      : finalPred.awayScore > finalPred.homeScore ? finalSlot.away : null)
    : null

  return (
    <div className="pb-24">
      {/* Info banner */}
      {!hasGroupPreds && (
        <div className="mx-4 mt-4 p-4 border-2 border-yellow/60 bg-yellow/5 flex gap-3">
          <span className="font-display text-2xl text-yellow/80 flex-shrink-0">!</span>
          <div>
            <p className="font-mono text-[10px] font-bold text-ink-3 mb-1">COMPLETE OS GRUPOS PRIMEIRO</p>
            <p className="font-mono text-[10px] text-ink-4 leading-relaxed">
              Faça seus palpites nos grupos para ver as seleções classificadas aqui automaticamente.
              Você já pode palpitar os placares — os times aparecerão conforme você avança.
            </p>
          </div>
        </div>
      )}

      {/* Round selector */}
      <div className="sticky top-[44px] z-10 bg-paper border-b border-hairline flex overflow-x-auto">
        {KO_ROUNDS.map(r => {
          const picked = countPicked[r.id]
          const max = roundMaxCount[r.id]
          const done = picked === max
          const active = activeRound === r.id
          return (
            <button
              key={r.id}
              onClick={() => setActiveRound(r.id)}
              className={cn(
                'flex flex-col items-center px-3 py-2.5 flex-1 min-w-[56px] border-r last:border-r-0 border-hairline transition-colors border-b-2',
                active ? 'border-b-ink text-ink bg-paper' : 'border-b-transparent text-ink-3 hover:text-ink',
              )}
            >
              <span className="font-mono text-[9px] font-bold tracking-eyebrow whitespace-nowrap">{r.short}</span>
              <span className={cn('font-mono text-[7px] mt-0.5', done ? 'text-green' : 'text-ink-4')}>
                {picked}/{max}{done ? ' ✓' : ''}
              </span>
            </button>
          )
        })}
      </div>

      {/* Round header */}
      <div className="px-4 pt-4 pb-2 flex items-center justify-between border-b border-hairline">
        <span className="font-display text-xl">{KO_ROUNDS.find(r => r.id === activeRound)?.label}</span>
        {activeRound === 'sf' && (
          <span className="font-mono text-[9px] text-ink-3">inclui 3° lugar</span>
        )}
      </div>

      {lastError && (
        <div className="mx-4 mt-4 border border-red/30 bg-red/5 px-3 py-2 flex items-center justify-between gap-3">
          <p className="font-mono text-[10px] text-red">{lastError}</p>
          <button onClick={clearError} className="font-mono text-[10px] text-red underline">OK</button>
        </div>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={activeRound}
          initial={{ opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -8 }}
          transition={{ duration: 0.15 }}
        >
          {getRoundSlots(activeRound).map(({ slotId, label }) => {
            const teams = koTeams[slotId] ?? { home: null, away: null }
            return (
              <KoMatchRow
                key={slotId}
                slotId={slotId}
                label={label}
                home={teams.home}
                away={teams.away}
              />
            )
          })}
        </motion.div>
      </AnimatePresence>

      {/* Champion banner */}
      {champion && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-4 mt-6 bg-ink text-paper p-4 border-2 border-ink shadow-[0_4px_0_0_#FFCB05] flex items-center gap-4"
        >
          <Flag team={TEAMS[champion]} size={52} ring />
          <div>
            <div className="font-mono text-[9px] text-paper/40 tracking-eyebrow">NO MEU PALPITE</div>
            <div className="font-display text-2xl text-yellow leading-tight">{TEAMS[champion]?.name.toUpperCase()}</div>
            <div className="font-mono text-[9px] text-paper/40 mt-0.5">CAMPEÃO COPA 2026</div>
          </div>
          <span className="font-display text-5xl ml-auto opacity-10">◆</span>
        </motion.div>
      )}

      {/* Points guide */}
      <div className="mx-4 mt-5 border border-hairline">
        <div className="px-3 py-2 border-b border-hairline">
          <span className="font-mono text-[9px] tracking-eyebrow text-ink-3">PONTUAÇÃO MATA-MATA</span>
        </div>
        {[
          { pts: '+2',  label: 'Classificado acertado' },
          { pts: '+5',  label: 'Resultado certo (vitória/derrota)' },
          { pts: '+12', label: 'Placar exato acertado' },
          { pts: '+25', label: 'Campeão correto' },
        ].map(rule => (
          <div key={rule.pts} className="flex items-center gap-3 px-3 py-2 border-b border-hairline last:border-0">
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
  return (
    <div>
      {pick && (
        <div className="mb-4 flex items-center gap-3 p-3 border-2 border-green bg-green/5">
          <Flag team={TEAMS[pick]} size={32} />
          <div className="flex-1">
            <p className="font-mono text-[8px] tracking-eyebrow text-ink-4">ESCOLHIDO</p>
            <p className="font-display text-lg leading-none">{TEAMS[pick]?.name.toUpperCase()}</p>
          </div>
          <span className="font-mono text-[11px] text-green font-bold">✓</span>
        </div>
      )}

      {disabledReason && (
        <div className="mb-4 px-3 py-2 border border-yellow/40 bg-yellow/5">
          <p className="font-mono text-[9px] text-ink-3 leading-relaxed">{disabledReason}</p>
        </div>
      )}

      <div className="space-y-4">
        {WC2026_GROUPS.map(group => (
          <div key={group.id}>
            <p className="font-mono text-[8px] tracking-eyebrow text-ink-4 mb-2">GRUPO {group.id}</p>
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
                      'flex flex-col items-center gap-1.5 py-2.5 px-1 border-2 transition-colors',
                      selected ? 'border-green bg-green/10' :
                      blocked  ? 'border-hairline opacity-25 cursor-not-allowed' :
                                 'border-hairline hover:border-ink',
                    )}
                  >
                    <Flag team={team} size={26} />
                    <span className="font-mono text-[8px] font-bold">{code}</span>
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

// ─── Champion tab (accordion de etapas) ──────────────────────────────────────

const GENERAL_DEADLINE = getBettingDeadline(WC2026_MATCHES[0])

type GeneralSection = 'champion' | 'vice' | 'scorer'

function ChampionTab() {
  const {
    championPick, vicePick, scorerPick,
    setChampionPick, setVicePick, setScorerPick,
    lastError, clearError,
  } = usePredictionStore()

  const [scorerInput, setScorerInput] = useState(scorerPick ?? '')
  const [openSection, setOpenSection] = useState<GeneralSection | null>(
    !championPick ? 'champion' : !vicePick ? 'vice' : !scorerPick ? 'scorer' : null
  )

  const championGroup = championPick ? getGroupOfTeam(championPick) : null
  const viceGroup     = vicePick     ? getGroupOfTeam(vicePick)     : null

  const viceDisabledCodes    = championPick ? WC2026_GROUPS.find(g => g.id === championGroup)?.teams ?? [] : []
  const championDisabledCodes = vicePick    ? WC2026_GROUPS.find(g => g.id === viceGroup)?.teams    ?? [] : []

  function handleChampionPick(code: string) {
    if (vicePick && getGroupOfTeam(vicePick) === getGroupOfTeam(code)) setVicePick('')
    setChampionPick(code)
    setOpenSection(!vicePick ? 'vice' : !scorerPick ? 'scorer' : null)
  }

  function handleVicePick(code: string) {
    if (championPick && getGroupOfTeam(championPick) === getGroupOfTeam(code)) return
    setVicePick(code)
    setOpenSection(!scorerPick ? 'scorer' : null)
  }

  const now = new Date()
  const isDeadlinePassed = now >= GENERAL_DEADLINE
  const allSet = championPick && vicePick && scorerPick
  const deadlineStr = formatMatchDateTime(WC2026_MATCHES[0])

  const toggleSection = (s: GeneralSection) => {
    if (isDeadlinePassed) return
    setOpenSection(openSection === s ? null : s)
  }

  const steps: { id: GeneralSection; label: string; pts: number; done: boolean; pick: string | null }[] = [
    { id: 'champion', label: 'CAMPEÃO',    pts: 25, done: !!championPick, pick: championPick },
    { id: 'vice',     label: 'VICE',       pts: 15, done: !!vicePick,     pick: vicePick     },
    { id: 'scorer',   label: 'ARTILHEIRO', pts: 10, done: !!scorerPick,   pick: scorerPick   },
  ]

  return (
    <div className="px-4 py-6 pb-24">
      {/* Header */}
      <div className="mb-6">
        <div className="font-display text-4xl leading-none text-ink">APOSTAS GERAIS</div>
        <div className="font-serif-it text-xl text-green-deep leading-snug mt-0.5">
          obrigatórias antes da primeira partida
        </div>
        <div className={cn(
          'mt-3 inline-flex items-center gap-2 px-3 py-1.5 border font-mono text-[10px]',
          isDeadlinePassed
            ? 'border-red/40 bg-red/5 text-red'
            : 'border-yellow/50 bg-yellow/5 text-ink-3'
        )}>
          {isDeadlinePassed ? '■ ENCERRADO' : '⏱ PRAZO:'} {deadlineStr}
        </div>
      </div>

      {lastError && (
        <div className="mb-5 border border-red/30 bg-red/5 px-3 py-2 flex items-center justify-between gap-3">
          <p className="font-mono text-[10px] text-red">{lastError}</p>
          <button onClick={clearError} className="font-mono text-[10px] text-red underline">OK</button>
        </div>
      )}

      {/* Leitura pós-prazo */}
      {isDeadlinePassed ? (
        <div className="space-y-3">
          <div className="mb-4 border border-red/30 bg-red/5 px-3 py-2">
            <p className="font-mono text-[10px] text-red">Apostas gerais encerradas. Registradas no início da competição.</p>
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
        /* Accordion de etapas */
        <div className="space-y-2">
          {steps.map((step, idx) => (
            <div key={step.id} className="border-2 border-ink overflow-hidden">
              {/* Step header */}
              <button
                onClick={() => toggleSection(step.id)}
                className="w-full px-4 py-3.5 flex items-center gap-3 hover:bg-paper-deep transition-colors"
              >
                <div className={cn(
                  'w-6 h-6 flex-shrink-0 flex items-center justify-center border-2 font-mono text-[10px] font-bold',
                  step.done ? 'border-green bg-green text-paper' : 'border-ink text-ink',
                )}>
                  {step.done ? '✓' : idx + 1}
                </div>

                <div className="flex-1 text-left">
                  <div className="flex items-baseline gap-2">
                    <span className="font-display text-xl leading-none">{step.label}</span>
                    <span className="font-mono text-[9px] text-ink-4">+{step.pts} pts</span>
                  </div>
                  {step.done && step.pick && (
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {step.id !== 'scorer' && TEAMS[step.pick] && (
                        <Flag team={TEAMS[step.pick]} size={14} />
                      )}
                      <span className="font-mono text-[9px] text-green font-bold">
                        {step.id === 'scorer' ? step.pick : TEAMS[step.pick]?.name}
                      </span>
                    </div>
                  )}
                  {!step.done && (
                    <span className="font-mono text-[9px] text-ink-4">toque para escolher</span>
                  )}
                </div>

                <span className="font-mono text-[9px] text-ink-4 flex-shrink-0">
                  {openSection === step.id ? '▲' : '▼'}
                </span>
              </button>

              {/* Step content */}
              <AnimatePresence>
                {openSection === step.id && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: 'auto' }}
                    exit={{ height: 0 }}
                    transition={{ type: 'spring', damping: 32, stiffness: 400 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4 pt-3 border-t border-hairline">
                      {step.id === 'champion' && (
                        <TeamPickerGrid
                          pick={championPick}
                          onPick={handleChampionPick}
                          disabledCodes={championDisabledCodes}
                          disabledReason={vicePick ? `Times do Grupo ${viceGroup} bloqueados — mesmo grupo que o vice.` : undefined}
                        />
                      )}
                      {step.id === 'vice' && (
                        <TeamPickerGrid
                          pick={vicePick}
                          onPick={handleVicePick}
                          disabledCodes={viceDisabledCodes}
                          disabledReason={championPick ? `Times do Grupo ${championGroup} bloqueados — mesmo grupo que o campeão.` : undefined}
                        />
                      )}
                      {step.id === 'scorer' && (
                        <div>
                          <p className="font-mono text-[10px] text-ink-3 mb-4 leading-relaxed">
                            Quem vai ser o artilheiro da Copa 2026? Esse palpite é critério de desempate no ranking.
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
                              onClick={() => {
                                if (scorerInput.trim()) {
                                  setScorerPick(scorerInput.trim())
                                  setOpenSection(null)
                                }
                              }}
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
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      )}

      {/* All set banner */}
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
    <div className="border-2 border-ink flex flex-col">
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
            <div className="px-5 py-2.5 border-b border-hairline bg-paper-deep">
              <span className="font-mono text-[9px] tracking-eyebrow text-ink-3">RODADA {md}</span>
            </div>
            {matches.map(m => <MatchRow key={m.id} match={m} />)}
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
              className={cn(
                'w-full px-4 py-3 flex items-center justify-between transition-colors',
                active ? 'bg-yellow' : 'hover:bg-hairline',
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
    { id: 'champion' as const, label: 'APOSTAS GERAIS' },
  ]

  return (
    <div className="min-h-dvh bg-paper">
      {/* Header editorial */}
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
            <div className="font-display text-4xl text-ink">{totalGroupPreds}</div>
            <div className="font-mono text-[9px] text-ink-3">de {totalGroupMatches} jogos</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-hairline flex sticky top-0 lg:top-14 bg-paper z-20">
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
