import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Flag } from '@/components/shared/Flag'
import { useAuthStore } from '@/stores/auth.store'
import { usePredictionStore } from '@/stores/prediction.store'
import { useBracketStore } from '@/stores/bracket.store'
import { useMatchesWithStatus } from '@/hooks/useMatchWithStatus'
import { WC2026_MATCHES } from '@/data/wc2026'
import { formatMatchDate, formatMatchTime } from '@/lib/matchTime'
import { cn } from '@/lib/utils'
import type { Match, MatchStage } from '@/types'

// Espelha o match_slot_id do banco (igual ao Prediction) p/ casar o palpite de
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

  const allTbd = matches.length > 0 && matches.every(m => m.home.code === 'TBD' && m.away.code === 'TBD')

  return (
    <div className="min-h-dvh bg-paper pb-24 md:pb-10">
      <div className="app-shell py-6 md:py-8">
        <header className="mb-5 flex items-end justify-between">
          <div>
            <div className="font-display text-5xl md:text-6xl leading-none">CHAVEAMENTO</div>
            <p className="font-serif-it text-green-deep text-lg mt-1">o mata-mata, fase a fase</p>
          </div>
          <button onClick={() => navigate('/prediction', { state: { tab: 'knockout' } })}
            className="font-mono text-[10px] tracking-eyebrow text-ink-3 hover:text-ink border border-hairline px-3 py-1.5 transition-colors">
            PALPITAR →
          </button>
        </header>

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
            return <BracketCard key={m.id} m={m} pick={slotId ? picks[slotId] : undefined} pred={predictions[m.id]} />
          })}
        </div>

        {allTbd && (
          <p className="font-mono text-[11px] text-ink-3 text-center mt-6 leading-relaxed">
            Os confrontos aparecem aqui quando os times se classificarem.<br />
            Seu palpite de “quem avança” já fica guardado.
          </p>
        )}
      </div>
    </div>
  )
}

function BracketCard({ m, pick, pred }: {
  m: Match
  pick?: string
  pred?: { homeScore: number; awayScore: number }
}) {
  const finished = m.status === 'finished'
  const live = m.status === 'live'
  const placeholder = m.home.code === 'TBD' || m.away.code === 'TBD'
  const showScore = finished || live
  const correctAdvancer = finished && pick && m.winner && m.winner !== 'draw' ? pick === m.winner : null

  const header = live ? 'AO VIVO'
    : finished ? 'ENCERRADO'
    : placeholder ? 'A DEFINIR'
    : `${formatMatchDate(m)} · ${formatMatchTime(m)}`

  return (
    <div className={cn('ui-card overflow-hidden', live && 'ring-1 ring-red')}>
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-hairline">
        <span className={cn('font-mono text-[9px] tracking-eyebrow', live ? 'text-red font-bold' : 'text-ink-4')}>{header}</span>
        {pick && (
          <span className={cn('font-mono text-[9px] font-bold px-1.5 py-0.5',
            correctAdvancer === true ? 'bg-green text-white'
              : correctAdvancer === false ? 'bg-ink/10 text-ink-4'
              : 'bg-yellow text-[#0D0D0D]')}>
            VOCÊ ▸ {pick}
          </span>
        )}
      </div>

      <div className="px-3 py-2.5 space-y-2">
        <TeamRow team={m.home} score={showScore ? m.homeScore : null} winner={m.winner === m.home.code} />
        <TeamRow team={m.away} score={showScore ? m.awayScore : null} winner={m.winner === m.away.code} />
      </div>

      {pred && (
        <div className="px-3 pb-2 border-t border-hairline pt-1.5">
          <span className="font-mono text-[9px] text-ink-4">
            seu palpite: <span className="text-ink-2 font-bold">{pred.homeScore}×{pred.awayScore}</span>
          </span>
        </div>
      )}
    </div>
  )
}

function TeamRow({ team, score, winner }: { team: Match['home']; score: number | null; winner: boolean }) {
  const tbd = team.code === 'TBD'
  return (
    <div className="flex items-center gap-2.5">
      <Flag team={team} size={24} />
      <span className={cn('font-mono text-[12px] flex-1 truncate', winner ? 'font-bold text-ink' : tbd ? 'text-ink-4' : 'text-ink-2')}>
        {tbd ? 'A definir' : team.name}
      </span>
      <span className={cn('font-display text-xl leading-none w-6 text-right', winner ? 'text-ink' : 'text-ink-3')}>
        {score ?? '–'}
      </span>
    </div>
  )
}
