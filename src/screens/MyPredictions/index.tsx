import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Flag } from '@/components/shared/Flag'
import { usePredictionStore } from '@/stores/prediction.store'
import { useMatchesWithStatus } from '@/hooks/useMatchWithStatus'
import { WC2026_MATCHES } from '@/data/wc2026'
import { formatMatchDateTime } from '@/lib/matchTime'
import { getEffectiveMarketStatus, getMarketStatusLabel } from '@/lib/markets'
import { cn, fmtPts } from '@/lib/utils'

export function MyPredictionsScreen() {
  const navigate = useNavigate()
  const { predictions, championPick, vicePick, scorerPick } = usePredictionStore()
  const matches = useMatchesWithStatus(WC2026_MATCHES)

  const rows = useMemo(() => matches.map(match => {
    const prediction = predictions[match.id]
    const market = getEffectiveMarketStatus(match)
    return { match, prediction, market }
  }), [matches, predictions])

  const pending = rows.filter(row => !row.prediction && row.market === 'open').length
  const done = rows.filter(row => !!row.prediction).length
  const closed = rows.filter(row => !row.prediction && row.market !== 'open').length

  return (
    <div className="min-h-dvh bg-paper px-4 py-6 md:px-8">
      <div className="app-shell space-y-5">
        <header className="ui-card p-5">
          <p className="font-mono text-[10px] tracking-eyebrow text-ink-3">MEU PAINEL</p>
          <div className="font-display text-5xl md:text-7xl leading-none text-ink">PALPITES</div>
          <div className="flex items-baseline gap-3 mb-1">
            <span className="font-serif-it text-3xl md:text-5xl text-green-deep leading-none">seus,</span>
            <span className="font-mono text-[10px] tracking-eyebrow text-ink-3 self-end mb-1">jogador.</span>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-4">
            <Metric label="feitos" value={done} />
            <Metric label="pendentes" value={pending} />
            <Metric label="fechados sem palpite" value={closed} />
          </div>
        </header>

        <section className="ui-card p-4">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-display text-2xl">APOSTAS ESPECIAIS</h2>
            <button onClick={() => navigate('/prediction', { state: { tab: 'champion' } })} className="font-mono text-[10px] text-ink-3 hover:text-ink">EDITAR</button>
          </div>
          <div className="grid md:grid-cols-3 gap-2 mt-3">
            <General label="Campeao" value={championPick} />
            <General label="Vice" value={vicePick} />
            <General label="Artilheiro" value={scorerPick} />
          </div>
        </section>

        <section className="ui-panel">
          <div className="ui-panel-header">
            <h2 className="font-display text-xl">PARTIDAS</h2>
          </div>
          <div className="divide-y divide-hairline">
            {rows.map(({ match, prediction, market }) => (
              <button
                key={match.id}
                onClick={() => navigate(`/prediction/${match.id}`)}
                className="w-full px-4 py-3 flex flex-col md:flex-row md:items-center gap-2 hover:bg-surface-hover text-left"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Flag team={match.home} size={22} />
                  <span className="font-mono text-[11px] font-bold">{match.home.code}</span>
                  <span className="font-mono text-[10px] text-ink-4">x</span>
                  <span className="font-mono text-[11px] font-bold">{match.away.code}</span>
                  <Flag team={match.away} size={22} />
                </div>
                <div className="font-mono text-[10px] text-ink-3 md:w-56">{formatMatchDateTime(match)}</div>
                <div className={cn('font-mono text-[10px] md:w-32', market === 'open' ? 'text-green' : 'text-ink-4')}>{getMarketStatusLabel(market)}</div>
                <div className="font-mono text-[11px] md:w-36">
                  {prediction ? `${prediction.homeScore}-${prediction.awayScore} · ${fmtPts(prediction.pointsEarned ?? 0)}` : 'SEM PALPITE'}
                </div>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="border border-hairline p-3"><div className="font-display text-3xl">{value}</div><div className="font-mono text-[9px] text-ink-3">{label.toUpperCase()}</div></div>
}

function General({ label, value }: { label: string; value: string | null }) {
  return <div className="border border-hairline p-3"><div className="font-mono text-[9px] text-ink-3">{label.toUpperCase()}</div><div className="font-display text-xl">{value || 'PENDENTE'}</div></div>
}
