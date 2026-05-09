import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Flag } from '@/components/shared/Flag'
import { usePredictionStore } from '@/stores/prediction.store'
import { useIsDesktop } from '@/hooks/useBreakpoint'
import { MOCK_UPCOMING } from '@/data/mock'
import { clamp } from '@/lib/utils'
import type { Match } from '@/types'

const QUICK_CHIPS: { label: string; home: number; away: number }[] = [
  { label: '1–0 · vitória magra', home: 1, away: 0 },
  { label: '2–1 · clássico', home: 2, away: 1 },
  { label: '2–0 · goleada leve', home: 2, away: 0 },
  { label: '1–1 · empate honesto', home: 1, away: 1 },
  { label: '0–1 · zebra', home: 0, away: 1 },
  { label: '3–1 · goleada', home: 3, away: 1 },
]

export function PredictionScreen() {
  const { matchId } = useParams()
  const initialIndex = matchId ? MOCK_UPCOMING.findIndex(m => m.id === matchId) : 0
  const [idx, setIdx] = useState(Math.max(0, initialIndex))
  const isDesktop = useIsDesktop()

  const match = MOCK_UPCOMING[idx]
  if (!match) return null

  return isDesktop ? (
    <PredictionDesktop idx={idx} setIdx={setIdx} />
  ) : (
    <PredictionMobile idx={idx} setIdx={setIdx} />
  )
}

// ─── Score control ────────────────────────────────────────────────────────────

function ScoreControl({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        onClick={() => onChange(clamp(value + 1, 0, 9))}
        className="w-10 h-10 flex items-center justify-center border-2 border-ink font-mono text-sm font-bold hover:bg-yellow transition-colors"
      >+</button>
      <div className="score-cell active">{value}</div>
      <button
        onClick={() => onChange(clamp(value - 1, 0, 9))}
        className="w-10 h-10 flex items-center justify-center border-2 border-ink font-mono text-sm font-bold hover:bg-yellow transition-colors disabled:opacity-30"
        disabled={value === 0}
      >–</button>
    </div>
  )
}

// ─── Pool bar ─────────────────────────────────────────────────────────────────

function PoolBar({ match }: { match: Match }) {
  const home = 42, draw = 18, away = 40
  return (
    <div className="space-y-2">
      <p className="font-mono text-[10px] tracking-eyebrow text-ink-3">A FIRMA OPINA</p>
      {[
        { label: match.home.code, pct: home, color: match.home.color },
        { label: 'EMP', pct: draw, color: '#A9A89F' },
        { label: match.away.code, pct: away, color: match.away.color },
      ].map(item => (
        <div key={item.label} className="flex items-center gap-2">
          <span className="font-mono text-[10px] font-bold w-8">{item.label}</span>
          <div className="flex-1 h-2 bg-paper-deep overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${item.pct}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className="h-full"
              style={{ background: item.color }}
            />
          </div>
          <span className="font-mono text-[10px] text-ink-3 w-8 text-right">{item.pct}%</span>
        </div>
      ))}
    </div>
  )
}

// ─── Match card ───────────────────────────────────────────────────────────────

interface MatchCardProps {
  match: Match
  home: number
  away: number
  setHome: (n: number) => void
  setAway: (n: number) => void
}

function MatchCard({ match, home, away, setHome, setAway }: MatchCardProps) {
  return (
    <div className="flex items-center gap-4">
      {/* Home */}
      <div className="flex flex-col items-center gap-3 flex-1">
        <Flag team={match.home} size={56} />
        <span className="font-mono text-[11px] font-bold text-center">{match.home.name.toUpperCase()}</span>
        <ScoreControl value={home} onChange={setHome} />
      </div>

      {/* VS */}
      <div className="flex flex-col items-center gap-1 flex-shrink-0">
        <span className="font-serif-it text-ink-3 text-2xl">×</span>
        <span className="font-mono text-[9px] text-ink-4">{match.time}</span>
      </div>

      {/* Away */}
      <div className="flex flex-col items-center gap-3 flex-1">
        <Flag team={match.away} size={56} />
        <span className="font-mono text-[11px] font-bold text-center">{match.away.name.toUpperCase()}</span>
        <ScoreControl value={away} onChange={setAway} />
      </div>
    </div>
  )
}

// ─── Mobile ───────────────────────────────────────────────────────────────────

function PredictionMobile({ idx, setIdx }: { idx: number; setIdx: (i: number) => void }) {
  const navigate = useNavigate()
  const match = MOCK_UPCOMING[idx]
  const { setDraft, getDraft, confirmPrediction } = usePredictionStore()

  const draft = getDraft(match.id)
  const [home, setHome] = useState(draft?.home ?? 0)
  const [away, setAway] = useState(draft?.away ?? 0)

  const handleChip = (h: number, a: number) => { setHome(h); setAway(a) }
  const handleDraft = () => { setDraft(match.id, home, away) }
  const handleConfirm = () => {
    confirmPrediction({ id: `pred-${match.id}`, userId: 'me', matchId: match.id, homeScore: home, awayScore: away, submittedAt: new Date().toISOString() })
    if (idx < MOCK_UPCOMING.length - 1) setIdx(idx + 1)
    else navigate('/home')
  }

  return (
    <div className="min-h-dvh bg-paper pb-24 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-hairline sticky top-0 bg-paper z-10">
        <button onClick={() => navigate(-1)} className="font-mono text-[11px] font-bold tracking-eyebrow">← VOLTAR</button>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-ink-3 tracking-eyebrow">{match.stageLabel}</span>
          <span className="font-mono text-[10px] font-bold">{idx + 1}/{MOCK_UPCOMING.length}</span>
        </div>
      </div>

      <div className="flex-1 px-4 py-6 space-y-6">
        {/* Editorial heading */}
        <div>
          <div className="font-display text-6xl leading-none text-ink">PALPITA</div>
          <div className="flex items-baseline gap-3">
            <span className="font-serif-it text-4xl text-green-deep leading-none">aí,</span>
            <span className="font-mono text-[11px] tracking-eyebrow text-ink-3 self-end mb-1">jogador.</span>
          </div>
          <p className="font-mono text-[10px] text-ink-3 mt-2">{match.date} · {match.time} · {match.venue.split('·')[0].trim()}</p>
        </div>

        {/* Match card */}
        <AnimatePresence mode="wait">
          <motion.div key={idx} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.15 }}>
            <MatchCard match={match} home={home} away={away} setHome={setHome} setAway={setAway} />
          </motion.div>
        </AnimatePresence>

        {/* Quick chips */}
        <div>
          <p className="font-mono text-[10px] tracking-eyebrow text-ink-3 mb-2">PALPITES RÁPIDOS</p>
          <div className="flex flex-wrap gap-2">
            {QUICK_CHIPS.map(c => (
              <button key={c.label} onClick={() => handleChip(c.home, c.away)}
                className={`px-3 py-1.5 font-mono text-[10px] font-bold border-2 transition-colors ${home === c.home && away === c.away ? 'bg-yellow border-ink' : 'border-hairline hover:border-ink'}`}>
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Pool */}
        <PoolBar match={match} />
      </div>

      {/* Actions */}
      <div className="fixed bottom-20 left-0 right-0 flex gap-2 px-4 py-3 bg-paper border-t border-hairline">
        <button onClick={handleDraft} className="btn-ghost flex-1">RASCUNHO</button>
        <button onClick={handleConfirm} className="btn-yellow" style={{ flex: 2 }}>
          {idx < MOCK_UPCOMING.length - 1 ? 'CONFIRMAR · PRÓXIMO →' : 'CONFIRMAR · FEITO ✓'}
        </button>
      </div>
    </div>
  )
}

// ─── Desktop ──────────────────────────────────────────────────────────────────

function PredictionDesktop({ idx, setIdx }: { idx: number; setIdx: (i: number) => void }) {
  const match = MOCK_UPCOMING[idx]
  const { setDraft, getDraft, confirmPrediction } = usePredictionStore()

  const draft = getDraft(match.id)
  const [home, setHome] = useState(draft?.home ?? 0)
  const [away, setAway] = useState(draft?.away ?? 0)

  const handleChip = (h: number, a: number) => { setHome(h); setAway(a) }
  const handleConfirm = () => {
    confirmPrediction({ id: `pred-${match.id}`, userId: 'me', matchId: match.id, homeScore: home, awayScore: away, submittedAt: new Date().toISOString() })
    if (idx < MOCK_UPCOMING.length - 1) setIdx(idx + 1)
  }

  return (
    <div className="min-h-dvh bg-paper">
      <div className="max-w-screen-xl mx-auto px-6 py-8">
        <div className="grid grid-cols-[280px_1fr_300px] gap-6">
          {/* Left — match list */}
          <div className="border-2 border-ink">
            <div className="px-4 py-3 border-b border-hairline">
              <span className="font-mono text-[10px] tracking-eyebrow text-ink-3">JOGOS</span>
            </div>
            <div className="divide-y divide-hairline">
              {MOCK_UPCOMING.map((m, i) => (
                <button key={m.id} onClick={() => setIdx(i)}
                  className={`w-full px-4 py-3 text-left transition-colors flex items-center gap-3 ${i === idx ? 'bg-yellow' : 'hover:bg-hairline'}`}>
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-[11px] font-bold truncate">
                      {m.home.code} × {m.away.code}
                    </div>
                    <div className="font-mono text-[10px] text-ink-3">{m.date} · {m.time}</div>
                  </div>
                  {i === idx && <span className="font-mono text-[10px] font-bold">→</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Center — main */}
          <div className="flex flex-col gap-6">
            <div>
              <div className="font-display text-7xl leading-none text-ink">PALPITA</div>
              <div className="flex items-baseline gap-4">
                <span className="font-serif-it text-5xl text-green-deep leading-none">aí,</span>
                <span className="font-mono text-[11px] tracking-eyebrow text-ink-3 self-end mb-1">jogador.</span>
              </div>
              <p className="font-mono text-[11px] text-ink-3 mt-2">{match.date} · {match.time} · {match.venue}</p>
            </div>

            <div className="border-2 border-ink p-6">
              <AnimatePresence mode="wait">
                <motion.div key={idx} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }}>
                  <MatchCard match={match} home={home} away={away} setHome={setHome} setAway={setAway} />
                </motion.div>
              </AnimatePresence>
            </div>

            <div>
              <p className="font-mono text-[10px] tracking-eyebrow text-ink-3 mb-2">PALPITES RÁPIDOS</p>
              <div className="flex flex-wrap gap-2">
                {QUICK_CHIPS.map(c => (
                  <button key={c.label} onClick={() => handleChip(c.home, c.away)}
                    className={`px-3 py-2 font-mono text-[10px] font-bold border-2 transition-colors ${home === c.home && away === c.away ? 'bg-yellow border-ink' : 'border-hairline hover:border-ink'}`}>
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setDraft(match.id, home, away)} className="btn-ghost flex-1">SALVAR RASCUNHO</button>
              <button onClick={handleConfirm} className="btn-yellow" style={{ flex: 2 }}>
                {idx < MOCK_UPCOMING.length - 1 ? 'CONFIRMAR · PRÓXIMO →' : 'CONFIRMAR ✓'}
              </button>
            </div>
          </div>

          {/* Right — stats */}
          <div className="space-y-4">
            <PoolBar match={match} />

            <div>
              <p className="font-mono text-[10px] tracking-eyebrow text-ink-3 mb-2">SISTEMA DE PONTOS</p>
              <div className="space-y-1.5">
                {[
                  { pts: '+3', label: 'Acerto vencedor' },
                  { pts: '+5', label: 'Placar exato' },
                  { pts: '+10', label: 'Progressão bracket' },
                  { pts: '+50', label: 'Campeão' },
                ].map(r => (
                  <div key={r.label} className="flex items-center gap-3 border border-hairline px-3 py-2">
                    <span className="font-display text-2xl text-green">{r.pts}</span>
                    <span className="font-mono text-[11px]">{r.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
