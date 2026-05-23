import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Flag } from '@/components/shared/Flag'
import { useBracketStore } from '@/stores/bracket.store'
import { usePredictionStore } from '@/stores/prediction.store'
import { WC2026_BRACKET_SLOTS } from '@/lib/bracket2026'
import { computeGroupStandings, rankBestThirds } from '@/lib/groupStandings'
import { WC2026_GROUPS, WC2026_MATCHES } from '@/data/wc2026'
import { TEAMS } from '@/data/teams'
import { useIsDesktop } from '@/hooks/useBreakpoint'
import { cn } from '@/lib/utils'
import type { BracketSlot, BracketRound, TeamCode } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

type BracketView = 'mine' | 'live'

const ROUNDS: { id: BracketRound; label: string; shortLabel: string }[] = [
  { id: 'r32',   label: 'FASE DE 32',  shortLabel: 'F32' },
  { id: 'r16',   label: 'OITAVAS DE FINAL', shortLabel: 'OITAVAS' },
  { id: 'qf',    label: 'QUARTAS DE FINAL', shortLabel: 'QUARTAS' },
  { id: 'sf',    label: 'SEMIFINAIS',        shortLabel: 'SEMI'    },
  { id: 'third', label: '3° LUGAR',          shortLabel: '3° LUG'  },
  { id: 'final', label: 'FINAL',             shortLabel: 'FINAL'   },
]

// ─── Standings engine (mirrors Prediction screen) ────────────────────────────

// ─── R32 slot mapping (WC2026 format) ────────────────────────────────────────
// 16 matches, 32 teams.
// --- 48-team WC2026 actually has 12 groups → 32 qualifiers (8 group winners, 8 runners-up, 8 3rd-place extras)
// Simplified for now: qualifiers feed into 16 R32 matches.

interface R32SlotDef {
  slotId: string
  home: QualifierRef
  away: QualifierRef
  label: string
}

type QualifierRef =
  | { kind: 'rank'; group: string; rank: 1 | 2 }
  | { kind: 'bestThird'; index: number }

// WC2026 48-team bracket: 12 groups -> 16 Fase de 32 matches.
// 8 group winners + 8 runners-up + 8 best 3rd place = 32 teams
// Simplified pairing (FIFA TBD — using reasonable pairs for UX)
const R32_SLOT_DEFS: R32SlotDef[] = [
  { slotId: 'r32_1',  home: { kind: 'rank', group: 'A', rank: 1 }, away: { kind: 'bestThird', index: 0 }, label: 'M1' },
  { slotId: 'r32_2',  home: { kind: 'rank', group: 'B', rank: 1 }, away: { kind: 'bestThird', index: 1 }, label: 'M2' },
  { slotId: 'r32_3',  home: { kind: 'rank', group: 'C', rank: 1 }, away: { kind: 'bestThird', index: 2 }, label: 'M3' },
  { slotId: 'r32_4',  home: { kind: 'rank', group: 'D', rank: 1 }, away: { kind: 'bestThird', index: 3 }, label: 'M4' },
  { slotId: 'r32_5',  home: { kind: 'rank', group: 'E', rank: 1 }, away: { kind: 'bestThird', index: 4 }, label: 'M5' },
  { slotId: 'r32_6',  home: { kind: 'rank', group: 'F', rank: 1 }, away: { kind: 'bestThird', index: 5 }, label: 'M6' },
  { slotId: 'r32_7',  home: { kind: 'rank', group: 'G', rank: 1 }, away: { kind: 'bestThird', index: 6 }, label: 'M7' },
  { slotId: 'r32_8',  home: { kind: 'rank', group: 'H', rank: 1 }, away: { kind: 'bestThird', index: 7 }, label: 'M8' },
  { slotId: 'r32_9',  home: { kind: 'rank', group: 'I', rank: 1 }, away: { kind: 'rank', group: 'A', rank: 2 }, label: 'M9' },
  { slotId: 'r32_10', home: { kind: 'rank', group: 'J', rank: 1 }, away: { kind: 'rank', group: 'B', rank: 2 }, label: 'M10' },
  { slotId: 'r32_11', home: { kind: 'rank', group: 'K', rank: 1 }, away: { kind: 'rank', group: 'C', rank: 2 }, label: 'M11' },
  { slotId: 'r32_12', home: { kind: 'rank', group: 'L', rank: 1 }, away: { kind: 'rank', group: 'D', rank: 2 }, label: 'M12' },
  // 3rd-place wild cards — TBD from group results
  { slotId: 'r32_13', home: { kind: 'rank', group: 'E', rank: 2 }, away: { kind: 'rank', group: 'F', rank: 2 }, label: 'M13' },
  { slotId: 'r32_14', home: { kind: 'rank', group: 'G', rank: 2 }, away: { kind: 'rank', group: 'H', rank: 2 }, label: 'M14' },
  { slotId: 'r32_15', home: { kind: 'rank', group: 'I', rank: 2 }, away: { kind: 'rank', group: 'J', rank: 2 }, label: 'M15' },
  { slotId: 'r32_16', home: { kind: 'rank', group: 'K', rank: 2 }, away: { kind: 'rank', group: 'L', rank: 2 }, label: 'M16' },
]

// ─── Derive "Minha Chave" R32 teams from group predictions ───────────────────

function useMyR32Picks(
  predMap: Record<string, { homeScore: number; awayScore: number }>
): Record<string, { home: string | null; away: string | null }> {
  return useMemo(() => {
    const standingsByGroup: Record<string, ReturnType<typeof computeGroupStandings>> = {}
    for (const group of WC2026_GROUPS) {
      standingsByGroup[group.id] = computeGroupStandings(group, WC2026_MATCHES, predMap)
    }
    const bestThirds = rankBestThirds(standingsByGroup).slice(0, 8)

    const resolve = (ref: QualifierRef) => {
      if (ref.kind === 'bestThird') return bestThirds[ref.index]?.code ?? null
      return standingsByGroup[ref.group]?.[ref.rank - 1]?.code ?? null
    }

    const result: Record<string, { home: string | null; away: string | null }> = {}
    for (const def of R32_SLOT_DEFS) {
      result[def.slotId] = {
        home: resolve(def.home),
        away: resolve(def.away),
      }
    }
    return result
  }, [predMap])
}

// ─── Slot card — "Minha Chave" variant ───────────────────────────────────────

interface MySlotCardProps {
  slotId: string
  label: string
  home: string | null
  away: string | null
  myPick: string | undefined     // which team I picked to win
  realWinner: string | null      // actual winner (if known)
  onPick: (slotId: string, winner: TeamCode) => void
  isLocked: boolean
  compact?: boolean
  fromGroups?: boolean           // if true: teams derived from group preds
}

function MySlotCard({
  slotId, label, home, away, myPick, realWinner, onPick, isLocked, compact = false, fromGroups = false,
}: MySlotCardProps) {
  const homeTeam = home ? TEAMS[home] : null
  const awayTeam = away ? TEAMS[away] : null
  const isResolved = !!realWinner
  const isTBD = !home && !away

  const pickTeam = (code: string) => {
    if (isLocked || isResolved) return
    onPick(slotId, code as TeamCode)
  }

  const myPickWrong   = realWinner && myPick && myPick !== realWinner

  // Show big VS card when both teams known and not yet resolved, not compact
  const showVsCard = !compact && !isTBD && !isResolved && homeTeam && awayTeam

  return (
    <div className={cn(
      'border-2 bg-paper transition-all duration-150',
      isResolved ? 'border-green' : isTBD ? 'border-hairline' : 'border-ink',
      compact ? 'min-w-[155px]' : 'min-w-[200px]'
    )}>
      {/* Status bar */}
      <div className={cn(
        'px-2 py-1 flex items-center justify-between border-b border-hairline',
        isTBD ? 'bg-paper-deep' : fromGroups ? 'bg-paper-deep' : 'bg-ink'
      )}>
        <span className={cn('font-mono text-[8px]', !isTBD && !fromGroups && !isResolved ? 'text-paper/50' : 'text-ink-4')}>{label}</span>
        {isResolved && <span className="font-mono text-[8px] text-green font-bold">✓ DEF.</span>}
        {!isResolved && isTBD && <span className="font-mono text-[8px] text-ink-4">TBD</span>}
        {!isResolved && !isTBD && !fromGroups && <span className="font-mono text-[8px] text-yellow font-bold tracking-eyebrow">QUEM VENCE?</span>}
        {!isResolved && !isTBD && fromGroups && <span className="font-mono text-[7px] text-ink-4">MEU PALPITE</span>}
      </div>

      {/* VS display — big flags when both teams known and awaiting pick */}
      {showVsCard && (
        <div className="flex items-stretch border-b border-hairline">
          {/* Home */}
          <button
            onClick={() => pickTeam(home!)}
            className={cn(
              'flex-1 flex flex-col items-center justify-center gap-1.5 py-3 transition-all duration-100',
              myPick === home ? 'bg-yellow' : 'hover:bg-yellow/20'
            )}
          >
            <Flag team={homeTeam} size={32} className="rounded-sm" />
            <span className="font-mono text-[9px] font-bold">{home}</span>
            {myPick === home && <span className="font-mono text-[7px] text-ink">★ MINHA PICK</span>}
          </button>
          {/* VS divider */}
          <div className="flex items-center justify-center px-2 border-x border-hairline">
            <span className="font-display text-sm text-ink-3">VS</span>
          </div>
          {/* Away */}
          <button
            onClick={() => pickTeam(away!)}
            className={cn(
              'flex-1 flex flex-col items-center justify-center gap-1.5 py-3 transition-all duration-100',
              myPick === away ? 'bg-yellow' : 'hover:bg-yellow/20'
            )}
          >
            <Flag team={awayTeam} size={32} className="rounded-sm" />
            <span className="font-mono text-[9px] font-bold">{away}</span>
            {myPick === away && <span className="font-mono text-[7px] text-ink">★ MINHA PICK</span>}
          </button>
        </div>
      )}

      {/* Teams */}
      {[
        { code: home, team: homeTeam },
        { code: away, team: awayTeam },
      ].map(({ code, team }, i) => {
        if (!team || !code) {
          return (
            <div key={i} className={cn(
              'flex items-center gap-2 border-hairline',
              i === 0 ? 'border-b' : '',
              compact ? 'px-2 py-2' : 'px-3 py-2.5'
            )}>
              <div className={cn('rounded-full bg-hairline flex-shrink-0', compact ? 'w-5 h-5' : 'w-6 h-6')} />
              <span className="font-mono text-ink-4" style={{ fontSize: compact ? 9 : 10 }}>TBD</span>
            </div>
          )
        }

        const isPicked     = myPick === code
        const isRealWinner = realWinner === code
        const isLoser      = isResolved && !isRealWinner
        const canPick      = !isLocked && !isResolved && !!home && !!away

        return (
          <button
            key={i}
            onClick={() => canPick && pickTeam(code)}
            disabled={!canPick}
            className={cn(
              'w-full flex items-center gap-2 transition-all duration-100 relative',
              i === 0 ? 'border-b border-hairline' : '',
              compact ? 'px-2 py-2' : 'px-3 py-2.5',
              canPick && 'hover:bg-yellow/20 cursor-pointer',
              isPicked && !isResolved && 'bg-yellow',
              // picked + won = green
              isPicked && isRealWinner && 'bg-green text-paper',
              // picked + lost = red tint
              isPicked && myPickWrong && code === myPick && 'bg-red/10',
              // real winner (not my pick) = subtle green
              isRealWinner && !isPicked && 'bg-green/10',
              isLoser && !isPicked && 'opacity-40',
            )}
          >
            <Flag team={team} size={compact ? 18 : 20} />
            <span className={cn(
              'font-mono font-bold flex-1 text-left truncate',
              compact ? 'text-[10px]' : 'text-[11px]',
              isPicked && isRealWinner ? 'text-paper' : ''
            )}>
              {compact ? code : team.name}
            </span>
            {/* My pick indicator */}
            {isPicked && !isResolved && (
              <span className="font-mono text-[8px] font-bold text-ink">★</span>
            )}
            {/* Correct pick */}
            {isPicked && isRealWinner && (
              <span className="font-mono text-[8px] font-bold text-paper">✓</span>
            )}
            {/* Wrong pick badge */}
            {isPicked && myPickWrong && code === myPick && (
              <span className="font-mono text-[8px] text-red font-bold">✗</span>
            )}
            {/* Real winner but not my pick */}
            {isRealWinner && !isPicked && (
              <span className="font-mono text-[8px] text-green">→</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ─── Slot card — "Chave ao Vivo" variant ─────────────────────────────────────

interface LiveSlotCardProps {
  slot: BracketSlot
  compact?: boolean
}

function LiveSlotCard({ slot, compact = false }: LiveSlotCardProps) {
  const { homeTeam, awayTeam, homeScore, awayScore, status, winner, liveMinute } = slot
  const isLive    = status === 'live'
  const isDone    = status === 'done' || status === 'pens'
  const isWait    = status === 'wait' || (!homeTeam && !awayTeam)

  const statusLabel = isLive  ? `● ${liveMinute ?? ''}` :
                      isDone  ? '✓ FIM' :
                      isWait  ? '◎ TBD' : '○ PROGRAMADO'
  const statusColor = isLive  ? 'text-red' :
                      isDone  ? 'text-green' : 'text-ink-4'

  return (
    <div className={cn(
      'border-2 bg-paper transition-all duration-150',
      isLive ? 'border-red shadow-[0_0_0_2px_rgba(220,38,38,0.2)]' :
      isDone ? 'border-green' : 'border-hairline',
      compact ? 'min-w-[155px]' : 'min-w-[200px]'
    )}>
      {/* Status bar */}
      <div className="px-2 py-1 flex items-center justify-between border-b border-hairline">
        <span className={cn('font-mono font-bold', compact ? 'text-[8px]' : 'text-[9px]', statusColor)}>
          {statusLabel}
        </span>
        {isLive && <span className="w-1.5 h-1.5 rounded-full bg-red animate-pulse" />}
      </div>

      {/* Teams */}
      {[homeTeam, awayTeam].map((team, i) => {
        if (!team) {
          return (
            <div key={i} className={cn(
              'flex items-center gap-2 border-hairline',
              i === 0 ? 'border-b' : '',
              compact ? 'px-2 py-2' : 'px-3 py-2.5'
            )}>
              <div className={cn('rounded-full bg-hairline flex-shrink-0', compact ? 'w-5 h-5' : 'w-6 h-6')} />
              <span className="font-mono text-ink-4" style={{ fontSize: compact ? 9 : 10 }}>TBD</span>
            </div>
          )
        }

        const score     = i === 0 ? homeScore : awayScore
        const isWinner  = winner === team.code
        const isLoser   = isDone && !isWinner

        return (
          <div
            key={i}
            className={cn(
              'flex items-center gap-2',
              i === 0 ? 'border-b border-hairline' : '',
              compact ? 'px-2 py-2' : 'px-3 py-2.5',
              isWinner && isDone && 'bg-green text-paper',
              isLoser && 'opacity-50',
            )}
          >
            <Flag team={team} size={compact ? 18 : 20} />
            <span className={cn(
              'font-mono font-bold flex-1 text-left truncate',
              compact ? 'text-[10px]' : 'text-[11px]',
              isWinner && isDone ? 'text-paper' : ''
            )}>
              {compact ? team.code : team.name}
            </span>
            {score !== null && (
              <span className={cn(
                'font-display',
                compact ? 'text-lg' : 'text-xl',
                isWinner && isDone ? 'text-paper' : 'text-ink'
              )}>
                {score}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── "Minha Chave" legend ─────────────────────────────────────────────────────

function MyBracketLegend() {
  return (
    <div className="flex flex-wrap gap-3 text-[8px] font-mono text-ink-4">
      <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 bg-yellow border border-ink" /> Meu palpite</span>
      <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 bg-green border border-green" /> Acertou!</span>
      <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 bg-red/10 border border-red/30" /> Errou</span>
      <span className="flex items-center gap-1"><span className="font-bold text-green">→</span> Vencedor real</span>
    </div>
  )
}

// ─── View badge / switcher ────────────────────────────────────────────────────

function ViewSwitcher({ view, onChange }: { view: BracketView; onChange: (v: BracketView) => void }) {
  return (
    <div className="flex border-2 border-ink overflow-hidden">
      <button
        onClick={() => onChange('mine')}
        className={cn(
          'flex-1 py-2.5 px-4 font-mono text-[10px] font-bold tracking-eyebrow transition-colors flex flex-col items-center gap-0.5',
          view === 'mine' ? 'bg-ink text-paper' : 'bg-paper text-ink-3 hover:bg-hairline'
        )}
      >
        <span>MINHA CHAVE</span>
        <span className={cn('text-[7px] font-normal', view === 'mine' ? 'text-paper/60' : 'text-ink-4')}>
          seus palpites
        </span>
      </button>
      <div className="w-px bg-hairline" />
      <button
        onClick={() => onChange('live')}
        className={cn(
          'flex-1 py-2.5 px-4 font-mono text-[10px] font-bold tracking-eyebrow transition-colors flex flex-col items-center gap-0.5 relative',
          view === 'live' ? 'bg-ink text-paper' : 'bg-paper text-ink-3 hover:bg-hairline'
        )}
      >
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-red animate-pulse" />
          CHAVE AO VIVO
        </span>
        <span className={cn('text-[7px] font-normal', view === 'live' ? 'text-paper/60' : 'text-ink-4')}>
          resultado real
        </span>
      </button>
    </div>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function BracketScreen() {
  const isDesktop = useIsDesktop()
  return isDesktop ? <BracketDesktop /> : <BracketMobile />
}

// ─── Shared hook: build predMap from store ────────────────────────────────────

function usePredMap() {
  const { predictions } = usePredictionStore()
  return useMemo(() => {
    const m: Record<string, { homeScore: number; awayScore: number }> = {}
    for (const [matchId, pred] of Object.entries(predictions)) {
      m[matchId] = { homeScore: pred.homeScore, awayScore: pred.awayScore }
    }
    return m
  }, [predictions])
}

// ─── Mobile bracket ───────────────────────────────────────────────────────────

function BracketMobile() {
  const [view, setView] = useState<BracketView>('mine')
  const [activeRound, setActiveRound] = useState<BracketRound>('r32')
  const { picks, setPick, isRoundLocked, resolveSlotTeams } = useBracketStore()
  const predMap = usePredMap()
  const myR32Picks = useMyR32Picks(predMap)

  const allSlots = WC2026_BRACKET_SLOTS

  // For "Minha Chave" — resolve what teams appear in each round from picks
  const resolveMySlot = (slot: BracketSlot) => {
    if (slot.slotId.startsWith('r32_')) {
      const derived = myR32Picks[slot.slotId]
      return {
        home: derived?.home ?? null,
        away: derived?.away ?? null,
      }
    }
    const { home, away } = resolveSlotTeams(slot.slotId, allSlots)
    return { home, away }
  }

  const currentSlots = allSlots.filter(s => s.round === activeRound)

  const championCode = view === 'mine'
    ? (picks['final_1'] ?? null)
    : (allSlots.find(s => s.slotId === 'final_1')?.winner ?? null)
  const champion = championCode ? TEAMS[championCode] : null

  const hasGroupPreds = Object.keys(predMap).length > 0
  const r32HasTeams   = Object.values(myR32Picks).some(v => v.home !== null || v.away !== null)

  return (
    <div className="min-h-dvh bg-paper pb-28">
      {/* ── Header Copa 2026 ── */}
      <div className="relative overflow-hidden border-b-2 border-ink px-4 pt-5 pb-4">
        <div className="absolute inset-0 bg-gradient-to-br from-ink via-ink/95 to-ink/80" />
        {/* USA / CAN / MEX host colors stripe */}
        <div className="absolute bottom-0 left-0 right-0 h-0.5 flex">
          <div className="flex-1 bg-[#BF0A30]" />
          <div className="flex-1 bg-[#FF0000]" />
          <div className="flex-1 bg-[#009A44]" />
        </div>
        <div className="relative flex items-end justify-between">
          <div>
            <div className="font-mono text-[9px] tracking-eyebrow text-paper/40 mb-1">FIFA WORLD CUP · 2026</div>
            <div className="font-display text-5xl leading-none text-paper">CHAVE</div>
            <div className="font-serif-it text-xl text-yellow mt-0.5">USA · Canada · México</div>
          </div>
          <div className="flex flex-col items-end gap-0.5 pb-1">
            <span className="font-display text-3xl text-paper/20">◆</span>
            <span className="font-mono text-[8px] text-paper/30 tracking-eyebrow">JUN–JUL 2026</span>
          </div>
        </div>
      </div>

      {/* ── View switcher ── */}
      <div className="px-4 py-4 border-b border-hairline">
        <ViewSwitcher view={view} onChange={setView} />
        {view === 'mine' && (
          <p className="font-mono text-[9px] text-ink-4 mt-2">
            {!hasGroupPreds
              ? 'Palpite nos grupos para ver sua fase de 32 se montar automaticamente'
              : !r32HasTeams
              ? 'Continue palpitando nos grupos para preencher a chave'
              : 'Classificados baseados nos seus palpites de grupo'}
          </p>
        )}
        {view === 'live' && (
          <p className="font-mono text-[9px] text-ink-4 mt-2">
            Resultado oficial · atualiza quando admin ou sync registra mudanças
          </p>
        )}
      </div>

      {/* ── Round selector ── */}
      <div className="sticky top-0 z-10 bg-paper border-b border-hairline grid grid-cols-5">
        {ROUNDS.map(r => (
          <button
            key={r.id}
            onClick={() => setActiveRound(r.id)}
            className={cn(
              'py-3 font-mono text-[9px] font-bold tracking-eyebrow border-r last:border-r-0 border-hairline transition-colors',
              activeRound === r.id ? 'bg-ink text-paper' : 'text-ink-3 hover:bg-hairline'
            )}
          >
            {r.shortLabel}
          </button>
        ))}
      </div>

      {/* ── Content ── */}
      <div className="px-4 py-5 space-y-3">
        <AnimatePresence mode="wait">
          <motion.div
            key={`${view}-${activeRound}`}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.15 }}
            className="space-y-3"
          >
            {view === 'mine' && (
              <>
                {activeRound === 'r32' && (
                  <div className="mb-3">
                    <MyBracketLegend />
                  </div>
                )}
                {currentSlots.map(slot => {
                  const { home, away } = resolveMySlot(slot)
                  const def = R32_SLOT_DEFS.find(d => d.slotId === slot.slotId)
                  const slotLabel = def ? def.label : slot.slotId.toUpperCase().replace('_', ' ')
                  return (
                    <MySlotCard
                      key={slot.slotId}
                      slotId={slot.slotId}
                      label={slotLabel}
                      home={home}
                      away={away}
                      myPick={picks[slot.slotId]}
                      realWinner={slot.winner}
                      onPick={setPick}
                      isLocked={isRoundLocked(activeRound)}
                      fromGroups={slot.slotId.startsWith('r32_')}
                    />
                  )
                })}

                {/* Lock / status */}
                {!isRoundLocked(activeRound) && (
                  <button
                    onClick={() => lockRound(activeRound)}
                    className="btn-yellow w-full justify-center mt-4"
                  >
                    CONFIRMAR {ROUNDS.find(r => r.id === activeRound)?.shortLabel} →
                  </button>
                )}
                {isRoundLocked(activeRound) && (
                  <div className="flex items-center justify-center gap-2 py-3 border border-green text-green">
                    <span className="font-mono text-[11px] font-bold tracking-eyebrow">
                      ✓ {ROUNDS.find(r => r.id === activeRound)?.shortLabel} CONFIRMADAS
                    </span>
                  </div>
                )}
              </>
            )}

            {view === 'live' && currentSlots.map(slot => (
              <LiveSlotCard key={slot.slotId} slot={slot} />
            ))}
          </motion.div>
        </AnimatePresence>

        {/* Champion banner */}
        {activeRound === 'final' && champion && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-ink text-paper p-5 flex items-center gap-4 border-2 border-ink shadow-[0_4px_0_0_#FFCB05]"
          >
            <Flag team={champion} size={52} ring />
            <div>
              <div className="font-mono text-[10px] text-paper/50 tracking-eyebrow">
                {view === 'mine' ? 'NO MEU PALPITE…' : 'CAMPEÃO OFICIAL…'}
              </div>
              <div className="font-display text-3xl text-yellow">{champion.name.toUpperCase()}</div>
              {view === 'mine' && (
                <div className="font-mono text-[10px] text-paper/50 mt-1">+25 PTS se acertar</div>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}

// ─── Desktop bracket ──────────────────────────────────────────────────────────

function BracketDesktop() {
  const [view, setView] = useState<BracketView>('mine')
  const { picks, setPick, isRoundLocked, resolveSlotTeams } = useBracketStore()
  const predMap = usePredMap()
  const myR32Picks = useMyR32Picks(predMap)

  const allSlots = WC2026_BRACKET_SLOTS

  const r32   = allSlots.filter(s => s.round === 'r32')
  const qf    = allSlots.filter(s => s.round === 'qf')
  const sf    = allSlots.filter(s => s.round === 'sf')
  const third = allSlots.filter(s => s.round === 'third')
  const final = allSlots.filter(s => s.round === 'final')

  const resolveMySlot = (slot: BracketSlot) => {
    if (slot.slotId.startsWith('r32_')) {
      const derived = myR32Picks[slot.slotId]
      return {
        home: derived?.home ?? null,
        away: derived?.away ?? null,
      }
    }
    const { home, away } = resolveSlotTeams(slot.slotId, allSlots)
    return { home, away }
  }

  const championCode = view === 'mine'
    ? (picks['final_1'] ?? null)
    : (allSlots.find(s => s.slotId === 'final_1')?.winner ?? null)
  const champion = championCode ? TEAMS[championCode] : null

  // Split R32 into two halves for left/right bracket display
  const r32Left  = r32.slice(0, 8)
  const r32Right = r32.slice(8)
  const qfLeft   = qf.slice(0, 4)  // qf_1..qf_4 → feed sf_1, sf_2
  const qfRight  = qf.slice(4)     // qf_5..qf_8 → feed sf_3, sf_4
  const sfLeft   = sf.slice(0, 2)  // sf_1, sf_2 → feed FINAL
  const sfRight  = sf.slice(2)     // sf_3, sf_4 → feed 3° LUGAR

  const renderMyColumn = (slots: BracketSlot[], compact = true) =>
    slots.map(slot => {
      const { home, away } = resolveMySlot(slot)
      const def = R32_SLOT_DEFS.find(d => d.slotId === slot.slotId)
      const label = def ? def.label : slot.slotId.toUpperCase().replace('_', ' ')
      return (
        <MySlotCard
          key={slot.slotId}
          slotId={slot.slotId}
          label={label}
          home={home}
          away={away}
          myPick={picks[slot.slotId]}
          realWinner={slot.winner}
          onPick={setPick}
          isLocked={isRoundLocked(slot.round)}
          compact={compact}
          fromGroups={slot.slotId.startsWith('r32_')}
        />
      )
    })

  const renderLiveColumn = (slots: BracketSlot[], compact = true) =>
    slots.map(slot => (
      <LiveSlotCard key={slot.slotId} slot={slot} compact={compact} />
    ))

  return (
    <div className="min-h-dvh bg-paper overflow-x-auto">
      <div className="min-w-[1200px] px-6 py-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-6 gap-6">
          <div>
            <div className="font-display text-6xl leading-none text-ink">CHAVE</div>
            <div className="font-serif-it text-2xl text-green-deep mt-0.5">Copa do Mundo 2026</div>
          </div>
          <div className="flex-shrink-0 w-96">
            <ViewSwitcher view={view} onChange={setView} />
            <p className="font-mono text-[9px] text-ink-4 mt-2 text-center">
              {view === 'mine'
                ? 'Baseado nos seus palpites de grupo · clique para escolher vencedor'
                : 'Resultado oficial do torneio · admin/sync'}
            </p>
          </div>
        </div>

        {/* Legend for My Bracket */}
        {view === 'mine' && (
          <div className="mb-4">
            <MyBracketLegend />
          </div>
        )}

        {/* Bracket tree — symmetric left/right */}
        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="flex gap-3 items-start justify-center"
          >
            {/* LEFT HALF: R32 (1-8) -> QF (1-2) -> SF (1) */}
            <div className="flex gap-3 items-center">
              {/* R32 left */}
              <div className="flex-shrink-0">
                <p className="font-mono text-[9px] tracking-eyebrow text-ink-3 mb-2">FASE DE 32</p>
                <div className="flex flex-col gap-2">
                  {view === 'mine' ? renderMyColumn(r32Left) : renderLiveColumn(r32Left)}
                </div>
              </div>

              {/* Connectors L1 */}
              <div className="flex-shrink-0 flex flex-col gap-2 self-stretch py-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex-1 border-r-2 border-t-2 border-b-2 border-hairline"
                    style={{ borderRadius: '0 6px 6px 0', minHeight: 70 }}
                  />
                ))}
              </div>

              {/* QF left */}
              <div className="flex-shrink-0">
                <p className="font-mono text-[9px] tracking-eyebrow text-ink-3 mb-2">QUARTAS</p>
                <div className="flex flex-col gap-5 mt-6">
                  {view === 'mine' ? renderMyColumn(qfLeft) : renderLiveColumn(qfLeft)}
                </div>
              </div>

              {/* Connectors L2 */}
              <div className="flex-shrink-0 flex flex-col gap-2 self-stretch py-12">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex-1 border-r-2 border-t-2 border-b-2 border-hairline"
                    style={{ borderRadius: '0 6px 6px 0', minHeight: 110 }}
                  />
                ))}
              </div>

              {/* SF left */}
              <div className="flex-shrink-0">
                <p className="font-mono text-[9px] tracking-eyebrow text-ink-3 mb-2">SEMI</p>
                <div className="flex flex-col gap-12 mt-20">
                  {view === 'mine' ? renderMyColumn(sfLeft) : renderLiveColumn(sfLeft)}
                </div>
              </div>

              {/* Connector to Final */}
              <div className="flex-shrink-0 flex flex-col justify-center self-stretch">
                <div
                  className="border-r-2 border-t-2 border-b-2 border-hairline"
                  style={{ borderRadius: '0 6px 6px 0', height: 120 }}
                />
              </div>
            </div>

            {/* CENTER: Final + 3° Lugar + Champion */}
            <div className="flex-shrink-0 flex flex-col items-center gap-4 mt-36">
              <p className="font-mono text-[9px] tracking-eyebrow text-ink-3">FINAL</p>
              {view === 'mine' ? (
                final.map(slot => {
                  const { home, away } = resolveMySlot(slot)
                  return (
                    <MySlotCard
                      key={slot.slotId}
                      slotId={slot.slotId}
                      label="FINAL"
                      home={home}
                      away={away}
                      myPick={picks[slot.slotId]}
                      realWinner={slot.winner}
                      onPick={setPick}
                      isLocked={isRoundLocked('final')}
                      compact={false}
                    />
                  )
                })
              ) : (
                final.map(slot => (
                  <LiveSlotCard key={slot.slotId} slot={slot} compact={false} />
                ))
              )}

              {champion && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-ink text-paper p-4 border-2 border-ink shadow-[0_4px_0_0_#FFCB05] flex items-center gap-3 w-full"
                >
                  <Flag team={champion} size={36} ring />
                  <div>
                    <div className="font-mono text-[8px] text-paper/50 tracking-eyebrow">
                      {view === 'mine' ? 'NO MEU PALPITE…' : 'CAMPEÃO'}
                    </div>
                    <div className="font-display text-2xl text-yellow">{champion.name.toUpperCase()}</div>
                  </div>
                  <span className="font-display text-4xl ml-auto">◆</span>
                </motion.div>
              )}

              {/* 3° Lugar */}
              {third.length > 0 && (
                <div className="mt-4 w-full">
                  <p className="font-mono text-[9px] tracking-eyebrow text-ink-3 mb-2 text-center">3° LUGAR</p>
                  {view === 'mine' ? (
                    third.map(slot => {
                      const { home, away } = resolveMySlot(slot)
                      return (
                        <MySlotCard
                          key={slot.slotId}
                          slotId={slot.slotId}
                          label="3° LUGAR"
                          home={home}
                          away={away}
                          myPick={picks[slot.slotId]}
                          realWinner={slot.winner}
                          onPick={setPick}
                          isLocked={isRoundLocked('third')}
                          compact={false}
                        />
                      )
                    })
                  ) : (
                    third.map(slot => (
                      <LiveSlotCard key={slot.slotId} slot={slot} compact={false} />
                    ))
                  )}
                </div>
              )}
            </div>

            {/* RIGHT HALF: SF (2) -> QF (3-4) -> R32 (9-16) */}
            <div className="flex gap-3 items-center">
              {/* Connector from Final */}
              <div className="flex-shrink-0 flex flex-col justify-center self-stretch">
                <div
                  className="border-l-2 border-t-2 border-b-2 border-hairline"
                  style={{ borderRadius: '6px 0 0 6px', height: 120 }}
                />
              </div>

              {/* SF right */}
              <div className="flex-shrink-0">
                <p className="font-mono text-[9px] tracking-eyebrow text-ink-3 mb-2">SEMI</p>
                <div className="flex flex-col gap-12 mt-20">
                  {view === 'mine' ? renderMyColumn(sfRight) : renderLiveColumn(sfRight)}
                </div>
              </div>

              {/* Connectors R2 */}
              <div className="flex-shrink-0 flex flex-col gap-2 self-stretch py-12">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex-1 border-l-2 border-t-2 border-b-2 border-hairline"
                    style={{ borderRadius: '6px 0 0 6px', minHeight: 110 }}
                  />
                ))}
              </div>

              {/* QF right */}
              <div className="flex-shrink-0">
                <p className="font-mono text-[9px] tracking-eyebrow text-ink-3 mb-2">QUARTAS</p>
                <div className="flex flex-col gap-5 mt-6">
                  {view === 'mine' ? renderMyColumn(qfRight) : renderLiveColumn(qfRight)}
                </div>
              </div>

              {/* Connectors R1 */}
              <div className="flex-shrink-0 flex flex-col gap-2 self-stretch py-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex-1 border-l-2 border-t-2 border-b-2 border-hairline"
                    style={{ borderRadius: '6px 0 0 6px', minHeight: 70 }}
                  />
                ))}
              </div>

              {/* R32 right */}
              <div className="flex-shrink-0">
                <p className="font-mono text-[9px] tracking-eyebrow text-ink-3 mb-2">FASE DE 32</p>
                <div className="flex flex-col gap-2">
                  {view === 'mine' ? renderMyColumn(r32Right) : renderLiveColumn(r32Right)}
                </div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Points legend */}
        {view === 'mine' && (
          <div className="mt-8 pt-6 border-t border-hairline grid grid-cols-4 gap-4">
            {[
              { pts: '+2',  label: 'Classificado acertado',        icon: '→' },
              { pts: '+5',  label: 'Resultado certo (mata-mata)',  icon: '○' },
              { pts: '+12', label: 'Placar exato (mata-mata)',     icon: '★' },
              { pts: '+25', label: 'Campeão correto',              icon: '◆' },
            ].map(rule => (
              <div key={rule.label} className="flex items-center gap-3 border border-hairline p-3">
                <div className="font-display text-2xl text-green">{rule.pts}</div>
                <div>
                  <div className="font-mono text-[10px] font-bold">{rule.icon} {rule.label}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
