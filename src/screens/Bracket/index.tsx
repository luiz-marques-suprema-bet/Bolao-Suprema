import { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Flag } from '@/components/shared/Flag'
import { useAuthStore } from '@/stores/auth.store'
import { usePredictionStore } from '@/stores/prediction.store'
import { useBracketStore } from '@/stores/bracket.store'
import { useMatchesWithStatus } from '@/hooks/useMatchWithStatus'
import { isBetOpen } from '@/lib/markets'
import { isPlaceholderMatch } from '@/lib/matchGuards'
import { calculateKoPoints } from '@/lib/scoring'
import { WC2026_MATCHES } from '@/data/wc2026'
import { formatMatchDate, formatMatchTime } from '@/lib/matchTime'
import { cn } from '@/lib/utils'
import type { Match, MatchStage } from '@/types'

function koNum(id: string): number {
  const m = id.match(/(\d+)$/)
  return m ? parseInt(m[1], 10) : 0
}

function matchCodeToSlotId(code: string): string | null {
  if (/^ko-r32-\d+$/.test(code)) return code.replace('ko-r32-', 'r32_')
  if (/^ko-r16-\d+$/.test(code)) return code.replace('ko-r16-', 'r16_')
  if (/^ko-qf-\d+$/.test(code)) return code.replace('ko-qf-', 'qf_')
  if (/^ko-sf-\d+$/.test(code)) return code.replace('ko-sf-', 'sf_')
  if (code === 'ko-third-1') return 'third_1'
  if (code === 'ko-final-1') return 'final_1'
  return null
}

const COLUMNS: { key: string; label: string; stages: MatchStage[] }[] = [
  { key: 'r32', label: '16 AVOS DE FINAL', stages: ['round_of_32'] },
  { key: 'r16', label: 'OITAVAS DE FINAL', stages: ['round_of_16'] },
  { key: 'qf', label: 'QUARTAS DE FINAL', stages: ['quarter_final'] },
  { key: 'sf', label: 'SEMIFINAIS', stages: ['semi_final'] },
  { key: 'fin', label: '3º LUGAR E FINAL', stages: ['final', 'third_place'] },
]

// Numeração no estilo ESPN (fase de grupos = 72 jogos → mata-mata começa em 73).
function partidaLabel(m: Match): string {
  const n = koNum(m.id)
  switch (m.stage) {
    case 'round_of_32': return `Partida ${72 + n}`
    case 'round_of_16': return `Partida ${88 + n}`
    case 'quarter_final': return `Partida ${96 + n}`
    case 'semi_final': return `Partida ${100 + n}`
    case 'final': return 'FINAL'
    case 'third_place': return '3º LUGAR'
    default: return ''
  }
}

// Encurta os rótulos de "quem alimenta o slot" pra caber no card.
function feederLabel(name: string): string {
  return name
    .replace(/^Vencedor Grupo (\w)$/i, '1º $1')
    .replace(/^2o Grupo (\w)$/i, '2º $1')
    .replace(/^3o /i, '3º ')
    .replace(/^Vencedor Fase de 32 (\d+)$/i, 'Venc. 16-avos $1')
    .replace(/^Vencedor Oitavas (\d+)$/i, 'Venc. Oitavas $1')
    .replace(/^Vencedor Quartas (\d+)$/i, 'Venc. Quartas $1')
    .replace(/^Vencedor Semifinal (\d+)$/i, 'Venc. Semi $1')
    .replace(/^Perdedor Semifinal (\d+)$/i, 'Perd. Semi $1')
}

const BRACKET_CSS = `
.bkt-col{display:flex;flex-direction:column;justify-content:space-around;gap:10px;flex:1}
.bkt-card{position:relative}
.bkt-has-next .bkt-card::after{content:'';position:absolute;left:100%;top:50%;width:18px;height:1px;background:rgb(var(--color-ink) / 0.18)}
.bkt-has-prev .bkt-card::before{content:'';position:absolute;right:100%;top:50%;width:18px;height:1px;background:rgb(var(--color-ink) / 0.18)}
`

export function BracketScreen() {
  const navigate = useNavigate()
  const me = useAuthStore(s => s.user)
  const predictions = usePredictionStore(s => s.predictions)
  const picks = useBracketStore(s => s.picks)
  const syncBracket = useBracketStore(s => s.syncFromSupabase)
  const allMatches = useMatchesWithStatus(WC2026_MATCHES)

  useEffect(() => { if (me?.id) void syncBracket(me.id) }, [me?.id, syncBracket])

  const byCol = useMemo(() =>
    COLUMNS.map(col => ({
      ...col,
      matches: allMatches
        .filter(m => col.stages.includes(m.stage))
        .sort((a, b) => (col.stages.indexOf(a.stage) - col.stages.indexOf(b.stage)) || (koNum(a.id) - koNum(b.id))),
    })),
    [allMatches],
  )

  return (
    <div className="min-h-dvh bg-paper pb-24 md:pb-10">
      <style>{BRACKET_CSS}</style>
      <div className="app-shell py-6 md:py-8">
        <header className="mb-2">
          <p className="font-mono text-[10px] tracking-eyebrow text-ink-3">MATA-MATA · COPA 2026</p>
          <div className="font-display text-5xl md:text-7xl leading-none">CHAVEAMENTO</div>
        </header>
        <div className="mb-4 border-l-2 border-green bg-green/5 px-3 py-1.5 inline-block">
          <span className="font-mono text-[9px] text-ink-2 leading-snug">
            Arrasta pro lado pra ver as fases · toque num jogo aberto pra palpitar · <strong>quem passa manda</strong>.
          </span>
        </div>

        <div className="overflow-x-auto -mx-4 px-4 pb-4">
          <div className="flex items-stretch min-w-max">
            {byCol.map((col, ci) => (
              <div key={col.key} className="flex flex-col w-[208px] flex-shrink-0 px-2">
                <div className="font-mono text-[9px] tracking-eyebrow text-ink-3 text-center pb-2 mb-2 border-b border-hairline">
                  {col.label}
                </div>
                <div className={cn('bkt-col', ci < byCol.length - 1 && 'bkt-has-next', ci > 0 && 'bkt-has-prev')}>
                  {col.matches.map(m => {
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
              </div>
            ))}
          </div>
        </div>
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

  const Wrapper: 'button' | 'div' = bettable ? 'button' : 'div'

  return (
    <Wrapper
      {...(bettable ? { type: 'button' as const, onClick: onPalpitar } : {})}
      className={cn('bkt-card ui-card overflow-hidden w-full text-left',
        live && 'ring-1 ring-red',
        bettable && 'cursor-pointer transition-colors hover:bg-surface-hover')}
    >
      <div className="flex items-center justify-between px-2 py-1 border-b border-hairline bg-card-muted/40">
        <span className="font-mono text-[8px] tracking-eyebrow text-ink-4">{partidaLabel(m)}</span>
        {pick && <span className="font-mono text-[8px] font-bold text-ink-3">passa ▸ {pick}</span>}
      </div>

      <div className="px-2 py-1.5 space-y-1">
        <BracketTeam team={m.home} score={showScore ? m.homeScore : null} winner={m.winner === m.home.code} />
        <BracketTeam team={m.away} score={showScore ? m.awayScore : null} winner={m.winner === m.away.code} />
      </div>

      <div className="flex items-center justify-between border-t border-hairline px-2 py-1">
        <span className="font-mono text-[8px] text-ink-4">
          {live ? 'AO VIVO' : finished ? 'fim' : `${formatMatchDate(m)} · ${formatMatchTime(m)}`}
        </span>
        {finished && points != null
          ? <span className={cn('font-mono text-[9px] font-bold', points > 0 ? 'text-green' : 'text-ink-4')}>+{points}</span>
          : bettable && <span className="font-mono text-[8px] font-bold tracking-eyebrow text-green-deep">{pred ? 'EDITAR' : 'PALPITAR'}</span>}
      </div>
    </Wrapper>
  )
}

function BracketTeam({ team, score, winner }: { team: Match['home']; score: number | null; winner: boolean }) {
  const tbd = team.code === 'TBD'
  return (
    <div className="flex items-center gap-1.5">
      <Flag team={team} size={18} />
      <span className={cn('font-mono text-[10px] flex-1 truncate leading-tight', winner ? 'font-bold text-ink' : tbd ? 'text-ink-4' : 'text-ink-2')}>
        {tbd ? feederLabel(team.name) : team.name}
      </span>
      <span className={cn('font-display text-sm leading-none w-3.5 text-right', winner ? 'text-ink' : 'text-ink-3')}>
        {score ?? ''}
      </span>
    </div>
  )
}
