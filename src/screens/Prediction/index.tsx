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

function computeGroupTop2(
  groupCode: string,
  predictions: Record<string, { homeScore: number; awayScore: number }>,
  allMatches: Match[]
): [string | null, string | null] {
  const sorted = computeStandings(groupCode, predictions, allMatches)
  return [sorted[0]?.code ?? null, sorted[1]?.code ?? null]
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

  const isPickable = isBetOpen(match)
  const isLocked = match.status === 'locked' || (!isPickable && (match.status === 'open' || match.status === 'scheduled'))
  const isLive = match.status === 'live'
  const isDone = match.status === 'finished'
  const hasPick = !!existing

  const handleHomeChange = (v: number) => { setHome(v); onScoreChange?.() }
  const handleAwayChange = (v: number) => { setAway(v); onScoreChange?.() }

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
      <button
        onClick={toggle}
        className={cn(
          'w-full px-4 py-3 flex items-center gap-2 text-left transition-colors',
          isPickable ? 'hover:bg-hairline cursor-pointer' : 'cursor-default',
          hasPick ? 'bg-green/5' : '',
        )}
      >
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <Flag team={match.home} size={20} />
          <span className="font-mono text-[11px] font-bold truncate">{match.home.code}</span>
        </div>

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
              {formatMatchDate(match)} · {match.time} BRT
            </span>
          )}
        </div>

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
              <p className="font-mono text-[8px] text-ink-4 mb-1 text-center">{match.venue}</p>
              <p className="font-mono text-[8px] text-ink-4 mb-4 text-center">{formatMatchDateTime(match)}</p>
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

// ─── Mini-standings table ─────────────────────────────────────────────────────

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
          <span className="font-mono text-[8px] text-yellow font-bold">
            {filledMatches === totalMatches ? 'GRUPO COMPLETO' : `${filledMatches}/${totalMatches} jogos`}
          </span>
        </div>
        <span className="font-mono text-[8px] text-paper/40">baseado nos seus palpites</span>
      </div>

      <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-0 px-3 py-1.5 border-b border-hairline bg-paper-deep">
        <span className="font-mono text-[8px] text-ink-4">SELEÇÃO</span>
        <span className="font-mono text-[8px] text-ink-4 w-6 text-center">PTS</span>
        <span className="font-mono text-[8px] text-ink-4 w-6 text-center">GF</span>
        <span className="font-mono text-[8px] text-ink-4 w-6 text-center">GC</span>
        <span className="font-mono text-[8px] text-ink-4 w-8 text-center">SG</span>
      </div>

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

      <div className="px-3 py-1 bg-hairline flex items-center gap-2">
        <div className="flex-1 h-px bg-ink-4/30" />
        <span className="font-mono text-[7px] text-ink-4 tracking-eyebrow">ELIMINADOS</span>
        <div className="flex-1 h-px bg-ink-4/30" />
      </div>

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
  const { predictions, lastError, clearError } = usePredictionStore()
  const [tick, setTick] = useState(0)
  const allMatches = useMatchesWithStatus(WC2026_MATCHES)

  const countPerGroup = useMemo(() => {
    const map: Record<string, number> = {}
    for (const g of GROUP_LABELS) {
      map[g] = allMatches.filter(m => m.group === g && predictions[m.id]).length
    }
    return map
  }, [allMatches, predictions, tick])

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
  }, [selectedGroup, predictions, allMatches, tick])

  const filledMatches = groupMatches.filter(m => {
    if (m.status === 'finished' || m.status === 'live') return true
    return !!predictions[m.id]
  }).length

  const handleScoreChange = useCallback(() => setTick(t => t + 1), [])

  const openMatchCount = groupMatches.filter(m => m.status === 'open' || m.status === 'scheduled').length

  return (
    <div className="pb-24">
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

      {lastError && (
        <div className="mx-4 mt-4 border border-red/30 bg-red/5 px-3 py-2 flex items-center justify-between gap-3">
          <p className="font-mono text-[10px] text-red">{lastError}</p>
          <button onClick={clearError} className="font-mono text-[10px] text-red underline">
            OK
          </button>
        </div>
      )}

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

      <MiniStandings
        standings={standings}
        totalMatches={totalInGroup}
        filledMatches={filledMatches}
      />

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

// ─── Knockout tab — Copa 2026 mata-mata com palpites de placar ────────────────

type KoRound = 'r32' | 'r16' | 'qf' | 'sf' | 'final'

const KO_ROUNDS: { id: KoRound; label: string; short: string; matchCount: number }[] = [
  { id: 'r32',   label: 'RODADA DE 32',    short: '32',     matchCount: 16 },
  { id: 'r16',   label: 'OITAVAS DE FINAL',short: 'OITAVAS',matchCount: 8  },
  { id: 'qf',    label: 'QUARTAS DE FINAL',short: 'QUARTAS', matchCount: 4  },
  { id: 'sf',    label: 'SEMIFINAIS',      short: 'SEMI',   matchCount: 2  },
  { id: 'final', label: 'FINAL',           short: 'FINAL',  matchCount: 1  },
]

// Copa 2026: 12 grupos → 32 seleções → 16 jogos na primeira fase
// 1° e 2° de cada grupo + 8 melhores 3°s = 32 seleções
// Pairings provisórios baseados no formato FIFA 2026
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
  // 8 melhores 3°s (pairings provisórios)
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

// sf losers → 3° lugar, sf winners → final
const KO_3RD_DEF  = { slotId: 'ko-3rd-1',   slot1: 'ko-sf-1', slot2: 'ko-sf-2', label: '3° LUGAR' }
const KO_FINAL_DEF = { slotId: 'ko-final-1', slot1: 'ko-sf-1', slot2: 'ko-sf-2', label: 'FINAL'    }

// ─── Knockout team resolution ─────────────────────────────────────────────────

interface KoTeams { home: string | null; away: string | null }

function resolveKoTeams(
  groupPredMap: Record<string, { homeScore: number; awayScore: number }>,
  koPredictions: Record<string, { homeScore: number; awayScore: number }>,
  allMatches: Match[]
): Record<string, KoTeams> {
  const result: Record<string, KoTeams> = {}

  // Group top2 for all groups
  const groupTop2: Record<string, [string | null, string | null]> = {}
  for (const g of GROUP_LABELS) {
    groupTop2[g] = computeGroupTop2(g, groupPredMap, allMatches)
  }

  // R32: from group standings
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
    return null // draw → penas — não resolve
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

  // 3° lugar: perdedores das semis
  result[KO_3RD_DEF.slotId] = {
    home: getLoser(KO_3RD_DEF.slot1),
    away: getLoser(KO_3RD_DEF.slot2),
  }

  // Final: vencedores das semis
  result[KO_FINAL_DEF.slotId] = {
    home: getWinner(KO_FINAL_DEF.slot1),
    away: getWinner(KO_FINAL_DEF.slot2),
  }

  return result
}

// ─── Knockout match row with score picker ────────────────────────────────────

function KoMatchRow({
  slotId, label, home, away,
}: {
  slotId: string
  label: string
  home: string | null
  away: string | null
}) {
  const { predictions, drafts, confirmPrediction, setDraft } = usePredictionStore()
  const userId = useAuthStore(s => s.user?.id ?? 'me')
  const existing = predictions[slotId]
  const draft = drafts[slotId]

  const [expanded, setExpanded] = useState(false)
  const [homeScore, setHomeScore] = useState(draft?.home ?? existing?.homeScore ?? 0)
  const [awayScore, setAwayScore] = useState(draft?.away ?? existing?.awayScore ?? 0)

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

  const handleSaveDraft = () => {
    setDraft(slotId, homeScore, awayScore)
    setExpanded(false)
  }

  return (
    <div className="border-b border-hairline last:border-0">
      <button
        onClick={() => !isTBD && setExpanded(v => !v)}
        className={cn(
          'w-full px-4 py-3 flex items-center gap-2 text-left transition-colors',
          !isTBD ? 'hover:bg-hairline cursor-pointer' : 'cursor-default opacity-50',
          hasPick ? 'bg-green/5' : '',
        )}
      >
        {/* home */}
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          {homeTeam
            ? <Flag team={homeTeam} size={20} />
            : <span className="w-5 h-5 rounded-full bg-hairline flex-shrink-0" />
          }
          <span className="font-mono text-[11px] font-bold truncate">{home ?? 'TBD'}</span>
        </div>

        {/* centre */}
        <div className="flex flex-col items-center flex-shrink-0 min-w-[56px]">
          <span className="font-mono text-[8px] text-ink-4 mb-0.5">{label}</span>
          {hasPick ? (
            <div className="flex items-center gap-1">
              <span className="font-display text-base text-green">{existing.homeScore}</span>
              <span className="font-mono text-[10px] text-ink-4">–</span>
              <span className="font-display text-base text-green">{existing.awayScore}</span>
              <span className="font-mono text-[9px] text-green ml-0.5">✓</span>
            </div>
          ) : (
            <span className="font-mono text-[9px] text-ink-3">{isTBD ? 'TBD' : 'PALPITAR'}</span>
          )}
        </div>

        {/* away */}
        <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
          <span className="font-mono text-[11px] font-bold truncate">{away ?? 'TBD'}</span>
          {awayTeam
            ? <Flag team={awayTeam} size={20} />
            : <span className="w-5 h-5 rounded-full bg-hairline flex-shrink-0" />
          }
        </div>

        {!isTBD && (
          <span className="font-mono text-[9px] text-ink-4 ml-2 flex-shrink-0">
            {expanded ? '▲' : hasPick ? '✎' : '▼'}
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
            <div className="px-4 py-5 bg-paper-deep border-t border-hairline">
              <p className="font-mono text-[9px] tracking-eyebrow text-ink-3 mb-1 text-center">
                PALPITE · PLACAR EXATO · {label}
              </p>
              <p className="font-mono text-[8px] text-ink-4 mb-4 text-center">
                Empate → define-se nas prorrogações / pênaltis
              </p>
              <div className="flex items-center justify-center gap-5">
                <div className="flex flex-col items-center gap-2">
                  {homeTeam && <Flag team={homeTeam} size={40} />}
                  <span className="font-mono text-[10px] font-bold">{home}</span>
                </div>
                <div className="flex items-center gap-3">
                  <ScoreControl value={homeScore} onChange={setHomeScore} />
                  <span className="font-serif-it text-2xl text-ink-3">×</span>
                  <ScoreControl value={awayScore} onChange={setAwayScore} />
                </div>
                <div className="flex flex-col items-center gap-2">
                  {awayTeam && <Flag team={awayTeam} size={40} />}
                  <span className="font-mono text-[10px] font-bold">{away}</span>
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

  // Count picked for each round
  const countPicked = useMemo(() => {
    const counts: Record<KoRound, number> = { r32: 0, r16: 0, qf: 0, sf: 0, final: 0 }
    for (const [key] of Object.entries(koPredMap)) {
      if (key.startsWith('ko-r32-'))   counts.r32++
      else if (key.startsWith('ko-r16-')) counts.r16++
      else if (key.startsWith('ko-qf-'))  counts.qf++
      else if (key.startsWith('ko-sf-'))  counts.sf++
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

  const roundMaxCount = { r32: 16, r16: 8, qf: 4, sf: 3, final: 1 }

  const finalSlot = koTeams['ko-final-1']
  const finalPred = koPredMap['ko-final-1']
  const champion = finalPred && finalSlot?.home && finalSlot?.away
    ? (finalPred.homeScore > finalPred.awayScore ? finalSlot.home : finalPred.awayScore > finalPred.homeScore ? finalSlot.away : null)
    : null

  return (
    <div className="pb-24">
      {/* Info banner if no group predictions */}
      {!hasGroupPreds && (
        <div className="mx-4 mt-4 p-3 border border-yellow/50 bg-yellow/5">
          <p className="font-mono text-[10px] text-ink-3">
            Faça seus palpites nos grupos primeiro para ver as seleções classificadas aqui automaticamente.
            Você já pode palpitar os placares dos jogos do mata-mata — as seleções serão preenchidas à medida que você avança.
          </p>
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
                {picked}/{max} {done ? '✓' : ''}
              </span>
            </button>
          )
        })}
      </div>

      {/* Round label */}
      <div className="px-4 pt-4 pb-2 flex items-center justify-between border-b border-hairline">
        <span className="font-display text-xl">{KO_ROUNDS.find(r => r.id === activeRound)?.label}</span>
        {activeRound === 'r32' && (
          <span className="font-mono text-[9px] text-ink-3">32 seleções · 16 jogos</span>
        )}
        {activeRound === 'sf' && (
          <span className="font-mono text-[9px] text-ink-3">inclui 3° lugar</span>
        )}
      </div>

      {/* Matches */}
      {lastError && (
        <div className="mx-4 mt-4 md:mx-8 border border-red/30 bg-red/5 px-3 py-2 flex items-center justify-between gap-3">
          <p className="font-mono text-[10px] text-red">{lastError}</p>
          <button onClick={clearError} className="font-mono text-[10px] text-red underline">
            OK
          </button>
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
          <Flag team={TEAMS[champion]} size={48} ring />
          <div>
            <div className="font-mono text-[9px] text-paper/40 tracking-eyebrow">NO MEU PALPITE</div>
            <div className="font-display text-2xl text-yellow">{TEAMS[champion]?.name.toUpperCase()}</div>
            <div className="font-mono text-[9px] text-paper/40 mt-0.5">CAMPEÃO COPA 2026</div>
          </div>
          <span className="font-display text-4xl ml-auto opacity-20">◆</span>
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
            <span className="font-mono text-[10px]">{rule.label}</span>
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
    return { valid: false, error: `Campeão e vice não podem ser do mesmo grupo (Grupo ${cGroup}). Escolha seleções de grupos diferentes.` }
  return { valid: true, error: null }
}

// ─── Team picker grid ─────────────────────────────────────────────────────────

function TeamPickerGrid({
  label, pts, pick, onPick, disabledCodes = [], disabledReason,
}: {
  label: string
  pts: number
  pick: string | null
  onPick: (code: string) => void
  disabledCodes?: string[]
  disabledReason?: string
}) {
  return (
    <div>
      <div className="flex items-baseline gap-2 mb-3">
        <span className="font-display text-2xl leading-none">{label}</span>
        <span className="font-mono text-[9px] text-ink-3">+{pts} pontos</span>
      </div>
      {disabledReason && (
        <div className="mb-3 px-3 py-2 border border-yellow/40 bg-yellow/5">
          <p className="font-mono text-[9px] text-ink-3 leading-relaxed">{disabledReason}</p>
        </div>
      )}
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
                const blocked = !selected && disabledCodes.includes(code)
                return (
                  <motion.button
                    key={code}
                    onClick={() => !blocked && onPick(code)}
                    whileTap={blocked ? {} : { scale: 0.95 }}
                    disabled={blocked}
                    title={blocked ? disabledReason : undefined}
                    className={[
                      'flex flex-col items-center gap-1 py-2 px-1 border-2 transition-colors',
                      selected ? 'border-ink bg-yellow' :
                      blocked  ? 'border-hairline opacity-30 cursor-not-allowed' :
                                 'border-hairline hover:border-ink',
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

// ─── Champion tab ─────────────────────────────────────────────────────────────

const GENERAL_DEADLINE = getBettingDeadline(WC2026_MATCHES[0])

function ChampionTab() {
  const { championPick, vicePick, scorerPick, setChampionPick, setVicePick, setScorerPick, lastError, clearError } = usePredictionStore()
  const [scorerInput, setScorerInput] = useState(scorerPick ?? '')
  const [section, setSection] = useState<'champion' | 'vice' | 'scorer'>('champion')

  // Groups blocked for vice (same group as champion) — and vice-versa
  const championGroup = championPick ? getGroupOfTeam(championPick) : null
  const viceGroup     = vicePick     ? getGroupOfTeam(vicePick)     : null

  const viceDisabledCodes = championPick
    ? WC2026_GROUPS.find(g => g.id === championGroup)?.teams ?? []
    : []
  const championDisabledCodes = vicePick
    ? WC2026_GROUPS.find(g => g.id === viceGroup)?.teams ?? []
    : []

  function handleChampionPick(code: string) {
    // If vice is from the same group, clear it
    if (vicePick && getGroupOfTeam(vicePick) === getGroupOfTeam(code)) {
      setVicePick('')
    }
    setChampionPick(code)
  }

  function handleVicePick(code: string) {
    // If champion is from the same group, prevent pick
    if (championPick && getGroupOfTeam(championPick) === getGroupOfTeam(code)) return
    setVicePick(code)
  }

  const now = new Date()
  const isDeadlinePassed = now >= GENERAL_DEADLINE
  const allSet = championPick && vicePick && scorerPick

  const deadlineStr = formatMatchDateTime(WC2026_MATCHES[0])

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

      {lastError && (
        <div className="mb-5 border border-red/30 bg-red/5 px-3 py-2 flex items-center justify-between gap-3">
          <p className="font-mono text-[10px] text-red">{lastError}</p>
          <button onClick={clearError} className="font-mono text-[10px] text-red underline">
            OK
          </button>
        </div>
      )}

      {!isDeadlinePassed && section === 'champion' && (
        <TeamPickerGrid
          label="CAMPEÃO" pts={25} pick={championPick} onPick={handleChampionPick}
          disabledCodes={championDisabledCodes}
          disabledReason={vicePick ? `Times do mesmo grupo que o vice (Grupo ${viceGroup}) estão bloqueados.` : undefined}
        />
      )}
      {!isDeadlinePassed && section === 'vice' && (
        <TeamPickerGrid
          label="VICE-CAMPEÃO" pts={15} pick={vicePick} onPick={handleVicePick}
          disabledCodes={viceDisabledCodes}
          disabledReason={championPick ? `Campeão e vice não podem ser do mesmo grupo. Times do Grupo ${championGroup} estão bloqueados.` : undefined}
        />
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

// ─── Desktop sidebar / group views (unchanged) ────────────────────────────────

function DesktopGroupView({
  selectedGroup,
  predictions,
}: {
  selectedGroup: string
  predictions: Record<string, { homeScore: number; awayScore: number }>
}) {
  const [tick, setTick] = useState(0)
  const handleScoreChange = useCallback(() => setTick(t => t + 1), [])
  const allMatches = useMatchesWithStatus(WC2026_MATCHES)

  const groupMatches = useMemo(
    () => allMatches.filter(m => m.group === selectedGroup),
    [allMatches, selectedGroup]
  )

  const standings = useMemo(
    () => computeStandings(selectedGroup, predictions, allMatches),
    [selectedGroup, predictions, allMatches, tick]
  )

  const filledMatches = groupMatches.filter(m => {
    if (m.status === 'finished' || m.status === 'live') return true
    return !!predictions[m.id]
  }).length

  const countPerGroup = useMemo(() => {
    return allMatches.filter(m => m.group === selectedGroup && predictions[m.id]).length
  }, [allMatches, selectedGroup, predictions, tick])

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
        const matches = allMatches.filter(
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

  const totalDone = Object.values(predictions).filter(p => !p.matchId?.startsWith('ko-')).length
  const totalMatches = allMatches.length

  const tabs = [
    { id: 'groups'   as const, label: 'GRUPOS'        },
    { id: 'knockout' as const, label: 'MATA-MATA'      },
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
            <div className="font-mono text-[9px] text-ink-3">de {totalMatches} grupos</div>
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
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
