import { useState, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Flag } from '@/components/shared/Flag'
import { usePredictionStore } from '@/stores/prediction.store'
import { useIsDesktop } from '@/hooks/useBreakpoint'
import { WC2026_MATCHES, WC2026_GROUPS } from '@/data/wc2026'
import { TEAMS } from '@/data/teams'
import { clamp } from '@/lib/utils'
import type { Match } from '@/types'

type PredTab = 'groups' | 'champion'

const GROUP_LABELS = ['A','B','C','D','E','F','G','H','I','J','K','L'] as const

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

function MatchRow({ match }: { match: Match }) {
  const { predictions, drafts, confirmPrediction, setDraft } = usePredictionStore()
  const existing = predictions[match.id]
  const draft = drafts[match.id]

  const [expanded, setExpanded] = useState(false)
  const [home, setHome] = useState(draft?.home ?? existing?.homeScore ?? 0)
  const [away, setAway] = useState(draft?.away ?? existing?.awayScore ?? 0)

  const isPickable = match.status === 'open' || match.status === 'scheduled'
  const isLive = match.status === 'live'
  const isDone = match.status === 'finished'
  const hasPick = !!existing

  const handleConfirm = () => {
    confirmPrediction({
      id: `pred-${match.id}`,
      userId: 'me',
      matchId: match.id,
      homeScore: home,
      awayScore: away,
      submittedAt: new Date().toISOString(),
    })
    setExpanded(false)
  }

  const handleSaveDraft = () => {
    setDraft(match.id, home, away)
    setExpanded(false)
  }

  const toggle = () => { if (isPickable) setExpanded(v => !v) }

  return (
    <div className="border-b border-hairline last:border-0">
      {/* ── collapsed row ── */}
      <button
        onClick={toggle}
        className={[
          'w-full px-4 py-3 flex items-center gap-2 text-left transition-colors',
          isPickable ? 'hover:bg-hairline cursor-pointer' : 'cursor-default',
          hasPick ? 'bg-green/5' : '',
        ].join(' ')}
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
          {!isLive && !isDone && hasPick && (
            <div className="flex items-center gap-1">
              <span className="font-display text-base leading-none text-green">{existing.homeScore}</span>
              <span className="font-mono text-[10px] text-ink-4">-</span>
              <span className="font-display text-base leading-none text-green">{existing.awayScore}</span>
              <span className="font-mono text-[9px] text-green ml-0.5">✓</span>
            </div>
          )}
          {!isLive && !isDone && !hasPick && (
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
              <p className="font-mono text-[9px] tracking-eyebrow text-ink-3 mb-4 text-center">
                {match.venue}
              </p>
              <div className="flex items-center justify-center gap-5">
                <div className="flex flex-col items-center gap-2 min-w-0">
                  <Flag team={match.home} size={40} />
                  <span className="font-mono text-[10px] font-bold">{match.home.name.split(' ')[0].toUpperCase()}</span>
                </div>
                <div className="flex items-center gap-3">
                  <ScoreControl value={home} onChange={setHome} />
                  <span className="font-serif-it text-2xl text-ink-3">×</span>
                  <ScoreControl value={away} onChange={setAway} />
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

// ─── Groups tab ───────────────────────────────────────────────────────────────

function GroupsTab() {
  const [selectedGroup, setSelectedGroup] = useState<string>('C')
  const { predictions } = usePredictionStore()

  const countPerGroup = useMemo(() => {
    const map: Record<string, number> = {}
    for (const g of GROUP_LABELS) {
      map[g] = WC2026_MATCHES.filter(m => m.group === g && predictions[m.id]).length
    }
    return map
  }, [predictions])

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

  return (
    <div className="pb-24">
      {/* Group pill selector */}
      <div className="px-3 py-3 border-b border-hairline bg-paper sticky top-[104px] z-10 overflow-x-auto">
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
            {matches.map(m => <MatchRow key={m.id} match={m} />)}
          </div>
        )
      })}

      {/* Progress bar */}
      {doneInGroup > 0 && (
        <div className="mx-4 mt-4">
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
    </div>
  )
}

// ─── Champion tab ─────────────────────────────────────────────────────────────

function ChampionTab() {
  const { championPick, setChampionPick } = usePredictionStore()
  const [confirmed, setConfirmed] = useState(false)

  const handlePick = useCallback((code: string) => {
    setChampionPick(code)
    setConfirmed(false)
  }, [setChampionPick])

  return (
    <div className="px-4 py-6 pb-24">
      {/* Editorial heading */}
      <div className="mb-6">
        <div className="font-display text-4xl leading-none text-ink">CAMPEÃO</div>
        <div className="font-serif-it text-2xl text-green-deep leading-snug">
          quem vai ganhar a Copa?
        </div>
        <p className="font-mono text-[10px] text-ink-3 mt-1.5">
          Vale 50 pontos se acertar · só pode mudar até o apito inicial
        </p>
      </div>

      {/* Current pick */}
      <AnimatePresence>
        {championPick && (
          <motion.div
            key={championPick}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 flex items-center gap-3 p-3 border-2 border-ink bg-yellow"
          >
            <Flag team={TEAMS[championPick]} size={36} />
            <div className="flex-1">
              <p className="font-mono text-[9px] tracking-eyebrow text-ink-3">SUA ESCOLHA</p>
              <p className="font-display text-lg leading-none">{TEAMS[championPick]?.name.toUpperCase()}</p>
            </div>
            {!confirmed ? (
              <button
                onClick={() => setConfirmed(true)}
                className="btn-ink text-[10px] px-4 py-2"
              >
                CONFIRMAR ✓
              </button>
            ) : (
              <span className="font-mono text-[10px] text-green font-bold">SALVO ✓</span>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Team grid by group */}
      <div className="space-y-5">
        {WC2026_GROUPS.map(group => (
          <div key={group.id}>
            <p className="font-mono text-[9px] tracking-eyebrow text-ink-3 mb-2">
              GRUPO {group.id}
            </p>
            <div className="grid grid-cols-4 gap-2">
              {group.teams.map(code => {
                const team = TEAMS[code]
                if (!team) return null
                const selected = championPick === code
                return (
                  <motion.button
                    key={code}
                    onClick={() => handlePick(code)}
                    whileTap={{ scale: 0.96 }}
                    className={[
                      'flex flex-col items-center gap-1.5 p-3 border-2 transition-colors',
                      selected
                        ? 'border-ink bg-yellow'
                        : 'border-hairline hover:border-ink',
                    ].join(' ')}
                  >
                    <Flag team={team} size={28} />
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

// ─── Desktop sidebar list ─────────────────────────────────────────────────────

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
  const [tab, setTab] = useState<PredTab>('groups')
  const [selectedGroup, setSelectedGroup] = useState('C')
  const { predictions } = usePredictionStore()
  const navigate = useNavigate()
  const isDesktop = useIsDesktop()

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
    { id: 'groups' as const, label: 'GRUPOS' },
    { id: 'champion' as const, label: 'CAMPEÃO' },
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
            <button
              onClick={() => navigate('/bracket')}
              className="mt-2 font-mono text-[10px] font-bold text-ink-3 hover:text-ink border border-hairline hover:border-ink px-3 py-1.5 transition-colors"
            >
              MATA-MATA ↗
            </button>
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="border-b border-hairline flex sticky top-0 md:top-14 bg-paper z-20">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={[
              'flex-1 py-3 font-mono text-[11px] font-bold tracking-eyebrow border-b-2 transition-colors',
              tab === t.id ? 'border-ink text-ink' : 'border-transparent text-ink-3 hover:text-ink',
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
        <button
          onClick={() => navigate('/bracket')}
          className="flex-1 py-3 font-mono text-[11px] font-bold tracking-eyebrow border-b-2 border-transparent text-ink-3 hover:text-ink transition-colors md:hidden"
        >
          MATA-MATA ↗
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
                <div className="border-2 border-ink">
                  {/* Desktop group header */}
                  <div className="px-5 py-4 border-b border-hairline flex items-center gap-3">
                    <span className="font-display text-xl">GRUPO {selectedGroup}</span>
                    <div className="flex gap-1">
                      {WC2026_GROUPS.find(g => g.id === selectedGroup)?.teams.map(code => (
                        <Flag key={code} team={TEAMS[code]} size={20} />
                      ))}
                    </div>
                    <span className="ml-auto font-mono text-[10px] text-ink-3">
                      {countPerGroup[selectedGroup] ?? 0}/6 palpites
                    </span>
                  </div>
                  {/* Matchdays */}
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
                        {matches.map(m => <MatchRow key={m.id} match={m} />)}
                      </div>
                    )
                  })}
                </div>
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
