import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Flag } from '@/components/shared/Flag'
import { useAuthStore } from '@/stores/auth.store'
import { usePredictionStore } from '@/stores/prediction.store'
import { useBracketStore } from '@/stores/bracket.store'
import { useMatchesWithStatus } from '@/hooks/useMatchWithStatus'
import { isPlaceholderMatch } from '@/lib/matchGuards'
import { isBetOpen } from '@/lib/markets'
import { calculateKoPoints } from '@/lib/scoring'
import { WC2026_MATCHES } from '@/data/wc2026'
import { formatMatchDate, formatMatchTime } from '@/lib/matchTime'
import { cn } from '@/lib/utils'
import type { Match, MatchStage } from '@/types'

// Espelha o match_slot_id do banco (igual ao Palpitar) p/ casar o palpite de
// "quem avança" (bracket_picks) com cada jogo de mata-mata.
function matchCodeToSlotId(code: string): string | null {
  if (/^ko-r32-\d+$/.test(code)) return code.replace('ko-r32-', 'r32_')
  if (/^ko-r16-\d+$/.test(code)) return code.replace('ko-r16-', 'r16_')
  if (/^ko-qf-\d+$/.test(code)) return code.replace('ko-qf-', 'qf_')
  if (/^ko-sf-\d+$/.test(code)) return code.replace('ko-sf-', 'sf_')
  if (code === 'ko-third-1') return 'third_1'
  if (code === 'ko-final-1') return 'final_1'
  return null
}

const TABS: Array<{ key: MatchStage; label: string }> = [
  { key: 'round_of_32', label: 'FASE DE 32' },
  { key: 'round_of_16', label: 'OITAVAS' },
  { key: 'quarter_final', label: 'QUARTAS' },
  { key: 'semi_final', label: 'SEMI' },
  { key: 'final', label: 'FINAL' },
]

const STAGE_ORDER: Record<string, number> = {
  round_of_32: 0, round_of_16: 1, quarter_final: 2, semi_final: 3, final: 4, third_place: 5,
}

function koNum(id: string): number {
  const m = id.match(/(\d+)$/)
  return m ? parseInt(m[1], 10) : 0
}

export function BracketScreen() {
  const navigate = useNavigate()
  const me = useAuthStore(s => s.user)
  const predictions = usePredictionStore(s => s.predictions)
  const picks = useBracketStore(s => s.picks)
  const syncBracket = useBracketStore(s => s.syncFromSupabase)
  const allMatches = useMatchesWithStatus(WC2026_MATCHES)
  const [tab, setTab] = useState<MatchStage>('round_of_32')

  useEffect(() => { if (me?.id) void syncBracket(me.id) }, [me?.id, syncBracket])

  const matches = useMemo(() =>
    allMatches
      .filter(m => m.stage === tab || (tab === 'final' && m.stage === 'third_place'))
      .sort((a, b) => (STAGE_ORDER[a.stage] - STAGE_ORDER[b.stage]) || (koNum(a.id) - koNum(b.id))),
    [allMatches, tab],
  )

  const defined = matches.filter(m => m.home.code !== 'TBD' && m.away.code !== 'TBD').length

  return (
    <div className="min-h-dvh bg-paper pb-24 md:pb-10">
      <div className="app-shell py-6 md:py-8">
        <header className="mb-1">
          <p className="font-mono text-[10px] tracking-eyebrow text-ink-3">MATA-MATA · COPA 2026</p>
          <div className="font-display text-5xl md:text-7xl leading-none">CHAVEAMENTO</div>
          <div className="flex items-baseline gap-3">
            <span className="font-serif-it text-3xl md:text-5xl text-green-deep leading-none">a chave,</span>
            <span className="font-mono text-[10px] tracking-eyebrow text-ink-3 self-end mb-1">fase a fase.</span>
          </div>
        </header>

        <div className="mt-3 mb-4 border-l-2 border-green bg-green/5 px-3 py-1.5 inline-block">
          <span className="font-mono text-[9px] text-ink-2 leading-snug">
            Toque num jogo aberto pra palpitar · <strong>quem passa manda</strong>: o classificado vale mais que o placar.
          </span>
        </div>

        {/* Abas por fase */}
        <div className="flex gap-1 overflow-x-auto no-scrollbar border-b border-hairline mb-4">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={cn('whitespace-nowrap px-3 py-2 font-mono text-[11px] font-bold tracking-eyebrow transition-colors',
                tab === t.key ? 'text-ink border-b-2 border-ink' : 'text-ink-4 hover:text-ink')}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          {matches.map(m => {
            const slotId = matchCodeToSlotId(m.id)
            return (
              <BracketCard
                key={m.id}
                m={m}
                pick={slotId ? picks[slotId] : undefined}
                pred={predictions[m.id]}
                onPalpitar={() => navigate(`/prediction/${m.id}`)}
              />
            )
          })}
        </div>

        {defined === 0 && (
          <p className="font-mono text-[11px] text-ink-3 text-center mt-6 leading-relaxed">
            Os confrontos aparecem aqui assim que os times se classificarem.<br />
            Seu palpite de placar e de “quem passa” já fica guardado.
          </p>
        )}
      </div>
    </div>
  )
}

function BracketCard({ m, pick, pred, onPalpitar }: {
  m: Match
  pick?: string
  pred?: { homeScore: number; awayScore: number }
  onPalpitar: () => void
}) {
  const finished = m.status === 'finished'
  const live = m.status === 'live'
  const placeholder = isPlaceholderMatch(m) || m.home.code === 'TBD' || m.away.code === 'TBD'
  const bettable = isBetOpen(m) && !placeholder
  const showScore = finished || live

  const header = live ? 'AO VIVO'
    : finished ? 'ENCERRADO'
    : placeholder ? 'A DEFINIR'
    : `${formatMatchDate(m)} · ${formatMatchTime(m)}`

  // Pontos do palpite quando o jogo encerra (mesma regra do servidor).
  const points = useMemo(() => {
    if (!finished || !pred) return null
    const predAdv = pick === m.home.code ? 'home' : pick === m.away.code ? 'away' : null
    const realAdv = m.winner === m.home.code ? 'home' : m.winner === m.away.code ? 'away' : null
    return calculateKoPoints(
      { homeScore: pred.homeScore, awayScore: pred.awayScore },
      { homeScore: m.homeScore ?? 0, awayScore: m.awayScore ?? 0 },
      predAdv, realAdv,
    )
  }, [finished, pred, pick, m])

  const clickable = bettable
  const Wrapper: 'button' | 'div' = clickable ? 'button' : 'div'

  return (
    <Wrapper
      {...(clickable ? { type: 'button' as const, onClick: onPalpitar } : {})}
      className={cn('ui-card overflow-hidden text-left w-full',
        live && 'ring-1 ring-red',
        clickable && 'cursor-pointer transition-colors hover:bg-surface-hover')}
    >
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-hairline">
        <span className={cn('font-mono text-[9px] tracking-eyebrow', live ? 'text-red font-bold' : 'text-ink-4')}>{header}</span>
        {pick && (
          <span className="font-mono text-[9px] font-bold px-1.5 py-0.5 bg-yellow text-[#0D0D0D]">PASSA ▸ {pick}</span>
        )}
      </div>

      <div className="px-3 py-2.5 space-y-2">
        <TeamRow team={m.home} score={showScore ? m.homeScore : null} winner={m.winner === m.home.code} myPick={pick === m.home.code} />
        <TeamRow team={m.away} score={showScore ? m.awayScore : null} winner={m.winner === m.away.code} myPick={pick === m.away.code} />
      </div>

      <div className="flex items-center justify-between border-t border-hairline px-3 py-1.5">
        {pred ? (
          <span className="font-mono text-[9px] text-ink-4">
            seu palpite: <span className="text-ink-2 font-bold">{pred.homeScore}×{pred.awayScore}</span>
          </span>
        ) : (
          <span className="font-mono text-[9px] text-ink-4">{placeholder ? 'aguardando os times' : bettable ? 'sem palpite ainda' : '—'}</span>
        )}
        {finished && points != null
          ? <span className={cn('font-mono text-[10px] font-bold', points > 0 ? 'text-green' : 'text-ink-4')}>+{points} pts</span>
          : bettable && <span className="font-mono text-[9px] font-bold tracking-eyebrow text-green-deep">{pred ? 'EDITAR →' : 'PALPITAR →'}</span>}
      </div>
    </Wrapper>
  )
}

function TeamRow({ team, score, winner, myPick }: { team: Match['home']; score: number | null; winner: boolean; myPick: boolean }) {
  const tbd = team.code === 'TBD'
  return (
    <div className="flex items-center gap-2.5">
      <Flag team={team} size={24} />
      <span className={cn('font-mono text-[12px] flex-1 truncate', winner ? 'font-bold text-ink' : tbd ? 'text-ink-4' : 'text-ink-2')}>
        {tbd ? 'A definir' : team.name}
        {myPick && !tbd && <span className="ml-1.5 font-mono text-[8px] text-ink-4">· seu</span>}
      </span>
      <span className={cn('font-display text-xl leading-none w-6 text-right', winner ? 'text-ink' : 'text-ink-3')}>
        {score ?? '–'}
      </span>
    </div>
  )
}
