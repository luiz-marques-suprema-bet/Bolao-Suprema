import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Flag } from '@/components/shared/Flag'
import { useAuthStore } from '@/stores/auth.store'
import { usePredictionStore } from '@/stores/prediction.store'
import { useBracketStore } from '@/stores/bracket.store'
import { useMatchesWithStatus } from '@/hooks/useMatchWithStatus'
import { isBetOpen } from '@/lib/markets'
import { isPlaceholderMatch } from '@/lib/matchGuards'
import { calculateKoPoints } from '@/lib/scoring'
import { clinchedPositions } from '@/lib/clinched'
import { matchCodeToSlotId } from '@/lib/bracket2026'
import { WC2026_MATCHES, WC2026_GROUPS } from '@/data/wc2026'
import { TEAMS } from '@/data/teams'
import { formatMatchDate, formatMatchTime } from '@/lib/matchTime'
import { cn } from '@/lib/utils'
import type { Match, MatchStage, Team } from '@/types'

function koNum(id: string): number {
  const m = id.match(/(\d+)$/)
  return m ? parseInt(m[1], 10) : 0
}

const TABS: { key: string; label: string; stages: MatchStage[] }[] = [
  { key: 'r32', label: '16 AVOS', stages: ['round_of_32'] },
  { key: 'r16', label: 'OITAVAS', stages: ['round_of_16'] },
  { key: 'qf', label: 'QUARTAS', stages: ['quarter_final'] },
  { key: 'sf', label: 'SEMIS', stages: ['semi_final'] },
  { key: 'fin', label: 'FINAL · 3º', stages: ['final', 'third_place'] },
]

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

// Rótulo curto de "quem alimenta o slot" quando o time ainda não saiu.
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

// Resolve um feeder de grupo (1º/2º) para o time real SÓ quando a vaga está
// cravada por pontos (ver @/lib/clinched). Senão, fica o rótulo.
type Clinched = Record<string, { first: string | null; second: string | null }>

function resolveFeeder(name: string, clinched: Clinched): Team | null {
  let mm = name.match(/^Vencedor Grupo (\w)$/i)
  if (mm) { const c = clinched[mm[1].toUpperCase()]?.first; return c ? (TEAMS[c] ?? null) : null }
  mm = name.match(/^2o Grupo (\w)$/i)
  if (mm) { const c = clinched[mm[1].toUpperCase()]?.second; return c ? (TEAMS[c] ?? null) : null }
  return null
}

// Resolve um feeder de MATA-MATA ("Venc. 16-avos N", "Venc. Oitavas N"…) para o
// time real assim que o jogo de origem termina — mostra o classificado avançando
// (aguardando o adversário) mesmo antes do confronto se materializar.
function resolveKoFeeder(name: string, byId: Map<string, Match>): Team | null {
  const take = (code: string, kind: 'winner' | 'loser'): Team | null => {
    const m = byId.get(code)
    if (!m || m.status !== 'finished' || !m.winner) return null
    const w = m.winner as string
    if (w === 'draw') return null
    if (kind === 'winner') return TEAMS[w] ?? null
    const loser = w === m.home.code ? m.away.code : m.home.code
    return loser && loser !== 'TBD' ? (TEAMS[loser] ?? null) : null
  }
  let mm = name.match(/^Vencedor Fase de 32 (\d+)$/i); if (mm) return take(`ko-r32-${mm[1]}`, 'winner')
  mm = name.match(/^Vencedor Oitavas (\d+)$/i);          if (mm) return take(`ko-r16-${mm[1]}`, 'winner')
  mm = name.match(/^Vencedor Quartas (\d+)$/i);          if (mm) return take(`ko-qf-${mm[1]}`, 'winner')
  mm = name.match(/^Vencedor Semifinal (\d+)$/i);        if (mm) return take(`ko-sf-${mm[1]}`, 'winner')
  mm = name.match(/^Perdedor Semifinal (\d+)$/i);        if (mm) return take(`ko-sf-${mm[1]}`, 'loser')
  return null
}

export function BracketScreen() {
  const navigate = useNavigate()
  const me = useAuthStore(s => s.user)
  const predictions = usePredictionStore(s => s.predictions)
  const picks = useBracketStore(s => s.picks)
  const syncBracket = useBracketStore(s => s.syncFromSupabase)
  const allMatches = useMatchesWithStatus(WC2026_MATCHES)
  const [tab, setTab] = useState('r32')

  useEffect(() => { if (me?.id) void syncBracket(me.id) }, [me?.id, syncBracket])

  // Vagas cravadas por pontos (1º/2º garantidos) — resolvem os feeders com segurança.
  const clinched = useMemo<Clinched>(() => {
    const map: Clinched = {}
    for (const g of WC2026_GROUPS) map[g.id] = clinchedPositions(g, allMatches)
    return map
  }, [allMatches])

  // Lookup por código — resolve os feeders de mata-mata (vencedor/perdedor) já jogados.
  const byId = useMemo(() => new Map(allMatches.map(m => [m.id, m])), [allMatches])

  const col = TABS.find(t => t.key === tab) ?? TABS[0]
  const matches = useMemo(() =>
    allMatches
      .filter(m => col.stages.includes(m.stage))
      .sort((a, b) => (col.stages.indexOf(a.stage) - col.stages.indexOf(b.stage)) || (koNum(a.id) - koNum(b.id))),
    [allMatches, col],
  )

  return (
    <div className="min-h-dvh bg-paper pb-24 md:pb-10">
      <div className="app-shell py-6 md:py-8">
        <header className="mb-2">
          <p className="font-mono text-[10px] tracking-eyebrow text-ink-3">MATA-MATA · COPA 2026</p>
          <div className="font-display text-5xl md:text-7xl leading-none">CHAVEAMENTO</div>
        </header>
        <div className="mb-4 border-l-2 border-green bg-green/5 px-3 py-1.5 inline-block">
          <span className="font-mono text-[9px] text-ink-2 leading-snug">
            Toque numa fase pra filtrar · num jogo aberto pra palpitar · <strong>quem passa manda</strong>.
          </span>
        </div>

        {/* Abas que filtram a fase (estilo ESPN) */}
        <div className="flex flex-wrap gap-2 mb-5">
          {TABS.map(t => (
            <button key={t.key} type="button" onClick={() => setTab(t.key)}
              className={cn('px-3.5 py-1.5 font-mono text-[11px] font-bold tracking-eyebrow border-2 transition-colors',
                tab === t.key ? 'bg-ink text-paper border-ink' : 'border-line-strong text-ink-3 hover:text-ink hover:bg-surface-hover')}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Grid responsivo — aproveita a largura no mobile e no desktop */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {matches.map(m => {
            const slotId = matchCodeToSlotId(m.id)
            return (
              <BracketCard
                key={m.id}
                m={m}
                pick={slotId ? picks[slotId] : undefined}
                pred={predictions[m.id]}
                clinched={clinched}
                byId={byId}
                onPalpitar={() => navigate(`/prediction/${m.id}`)}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}

function BracketCard({ m, pick, pred, clinched, byId, onPalpitar }: {
  m: Match
  pick?: string
  pred?: { homeScore: number; awayScore: number }
  clinched: Clinched
  byId: Map<string, Match>
  onPalpitar: () => void
}) {
  const finished = m.status === 'finished'
  const live = m.status === 'live'
  const placeholder = isPlaceholderMatch(m) || m.home.code === 'TBD' || m.away.code === 'TBD'
  const bettable = isBetOpen(m) && !placeholder
  const showScore = finished || live

  const points = useMemo(() => {
    if (!finished || !pred) return null
    // "Quem passa" = palpite explícito OU, na falta dele, o vencedor do placar
    // cravado (placar decisivo já indica quem passa) — espelha o cálculo do banco.
    const predAdv: 'home' | 'away' | null =
      pick === m.home.code ? 'home'
      : pick === m.away.code ? 'away'
      : pred.homeScore > pred.awayScore ? 'home'
      : pred.homeScore < pred.awayScore ? 'away'
      : null
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
      className={cn('ui-card overflow-hidden w-full text-left',
        live && 'ring-1 ring-red',
        bettable && 'cursor-pointer transition-colors hover:bg-surface-hover')}
    >
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-hairline bg-card-muted/40">
        <span className="font-mono text-[9px] tracking-eyebrow text-ink-4">{partidaLabel(m)}</span>
        {pick && <span className="font-mono text-[9px] font-bold text-ink-3">passa ▸ {pick}</span>}
      </div>

      <div className="px-3 py-2.5 space-y-2">
        <BracketTeam team={m.home} score={showScore ? m.homeScore : null} winner={m.winner === m.home.code} clinched={clinched} byId={byId} />
        <BracketTeam team={m.away} score={showScore ? m.awayScore : null} winner={m.winner === m.away.code} clinched={clinched} byId={byId} />
      </div>

      <div className="flex items-center justify-between border-t border-hairline px-3 py-1.5">
        <span className="font-mono text-[9px] text-ink-4">
          {live ? 'AO VIVO' : finished ? 'encerrado' : `${formatMatchDate(m)} · ${formatMatchTime(m)}`}
        </span>
        {finished && points != null
          ? <span className={cn('font-mono text-[10px] font-bold', points > 0 ? 'text-green' : 'text-ink-4')}>+{points} pts</span>
          : bettable && <span className="font-mono text-[9px] font-bold tracking-eyebrow text-green-deep">{pred ? 'EDITAR →' : 'PALPITAR →'}</span>}
      </div>
    </Wrapper>
  )
}

function BracketTeam({ team, score, winner, clinched, byId }: {
  team: Match['home']
  score: number | null
  winner: boolean
  clinched: Clinched
  byId: Map<string, Match>
}) {
  const resolved = team.code === 'TBD' ? (resolveFeeder(team.name, clinched) ?? resolveKoFeeder(team.name, byId)) : team
  const isReal = !!resolved && resolved.code !== 'TBD'
  const label = isReal ? resolved!.name : feederLabel(team.name)
  return (
    <div className="flex items-center gap-2.5">
      <Flag team={isReal ? resolved : null} placeholderLabel={feederLabel(team.name)} size={22} />
      <span className={cn('font-mono text-[12px] flex-1 truncate', winner ? 'font-bold text-ink' : isReal ? 'text-ink-2' : 'text-ink-4')}>
        {label}
      </span>
      <span className={cn('font-display text-lg leading-none w-5 text-right', winner ? 'text-ink' : 'text-ink-3')}>
        {score ?? ''}
      </span>
    </div>
  )
}
