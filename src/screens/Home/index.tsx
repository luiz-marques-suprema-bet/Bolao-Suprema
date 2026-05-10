import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Flag } from '@/components/shared/Flag'
import { Avatar } from '@/components/shared/Avatar'
import { useIsDesktop } from '@/hooks/useBreakpoint'
import { useAuthStore } from '@/stores/auth.store'
import { usePredictionStore } from '@/stores/prediction.store'
import { useChatStore } from '@/stores/chat.store'
import { MOCK_UPCOMING, MOCK_RANKING } from '@/data/mock'
import { WC2026_MATCHES } from '@/data/wc2026'
import { TEAMS } from '@/data/teams'
import { fmtPts, asset, cn } from '@/lib/utils'

// ─── Rotating hero background ─────────────────────────────────────────────────

const HERO_THEMES = [
  { code: 'BRA', label: 'BRASIL',     c1: '#009C3B', c2: '#002776' },
  { code: 'ARG', label: 'ARGENTINA',  c1: '#74ACDF', c2: '#FFFFFF' },
  { code: 'FRA', label: 'FRANCE',     c1: '#003087', c2: '#EF4135' },
  { code: 'GER', label: 'ALEMANHA',   c1: '#1a1a1a', c2: '#FFCC00' },
  { code: 'ESP', label: 'ESPANHA',    c1: '#AA151B', c2: '#F1BF00' },
  { code: 'POR', label: 'PORTUGAL',   c1: '#006600', c2: '#FF0000' },
  { code: 'USA', label: 'USA',        c1: '#002868', c2: '#BF0A30' },
  { code: 'ENG', label: 'ENGLAND',    c1: '#003087', c2: '#CF081F' },
  { code: 'NED', label: 'HOLANDA',    c1: '#FF4F00', c2: '#1D2671' },
  { code: 'MEX', label: 'MÉXICO',     c1: '#006847', c2: '#CE1126' },
]

function RotatingHero({ days, children }: { days: number; children?: React.ReactNode }) {
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setIdx(i => (i + 1) % HERO_THEMES.length), 4500)
    return () => clearInterval(id)
  }, [])

  const theme = HERO_THEMES[idx]
  const team = TEAMS[theme.code]

  return (
    <section className="relative overflow-hidden" style={{ height: 280 }}>
      {/* Static photo base */}
      <img
        src={asset('assets/hero-jogadores.webp')}
        alt=""
        className="absolute inset-0 w-full h-full object-cover object-top"
      />

      {/* Animated color overlay */}
      <AnimatePresence mode="wait">
        <motion.div
          key={idx}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.2 }}
          className="absolute inset-0"
          style={{
            background: `linear-gradient(135deg, ${theme.c1}CC 0%, ${theme.c2}99 100%)`,
          }}
        />
      </AnimatePresence>

      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-ink/80" />

      {/* Team badge pill */}
      <AnimatePresence mode="wait">
        {team && (
          <motion.div
            key={`badge-${idx}`}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.5 }}
            className="absolute top-4 right-4 flex items-center gap-2 bg-ink/50 backdrop-blur-sm px-3 py-1.5"
          >
            <Flag team={team} size={18} className="rounded-none" />
            <span className="font-mono text-[10px] text-paper tracking-eyebrow font-bold">{theme.label}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Countdown */}
      <div className="absolute inset-0 flex flex-col items-center justify-end pb-6 px-4 text-center">
        <div className="font-mono text-[10px] tracking-eyebrow text-paper/60 mb-1">
          COPA DO MUNDO 2026 · FASE DE GRUPOS
        </div>
        <div className="font-display text-[80px] leading-none text-paper">{days}</div>
        <div className="font-display text-2xl text-paper/70 -mt-1">DIAS</div>
        <div className="font-serif-it text-sm text-yellow mt-1">para a bola rolar · 11 Jun · 16:00</div>
      </div>

      {children}
    </section>
  )
}

const TOURNAMENT_START = new Date('2026-06-11T19:00:00Z') // 16:00 BRT = 19:00 UTC

function daysUntil(target: Date): number {
  const now = new Date()
  return Math.max(0, Math.ceil((target.getTime() - now.getTime()) / 86_400_000))
}

export function HomeScreen() {
  const isDesktop = useIsDesktop()
  return isDesktop ? <HomeDesktop /> : <HomeMobile />
}

// ─── Desktop rotating hero card ──────────────────────────────────────────────

function RotatingHeroDesktop({ days, onCta }: { days: number; onCta: () => void }) {
  const [idx, setIdx] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setIdx(i => (i + 1) % HERO_THEMES.length), 4500)
    return () => clearInterval(id)
  }, [])
  const theme = HERO_THEMES[idx]
  const team = TEAMS[theme.code]

  return (
    <div className="relative overflow-hidden min-h-[340px] border-2 border-ink">
      <img src={asset('assets/hero-jogadores.webp')} alt="" className="absolute inset-0 w-full h-full object-cover object-top" />
      <AnimatePresence mode="wait">
        <motion.div
          key={idx}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.2 }}
          className="absolute inset-0"
          style={{ background: `linear-gradient(135deg, ${theme.c1}CC 0%, ${theme.c2}88 100%)` }}
        />
      </AnimatePresence>
      <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/20 to-transparent" />

      {/* Team pill top-right */}
      <AnimatePresence mode="wait">
        {team && (
          <motion.div
            key={`d-badge-${idx}`}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.4 }}
            className="absolute top-4 right-4 flex items-center gap-2 bg-ink/60 backdrop-blur-sm px-3 py-1.5"
          >
            <Flag team={team} size={20} className="rounded-none" />
            <span className="font-mono text-[10px] text-paper tracking-eyebrow font-bold">{theme.label}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative h-full flex flex-col justify-end p-6">
        <div className="font-mono text-[10px] font-bold tracking-eyebrow text-paper/60 mb-2">
          COPA DO MUNDO 2026 · USA / CAN / MEX
        </div>
        <div className="flex items-end gap-4 mb-3">
          <div>
            <div className="font-display text-[110px] leading-none text-paper">{days}</div>
            <div className="font-display text-3xl text-paper/60 -mt-2">DIAS</div>
          </div>
          <div className="pb-2">
            <div className="font-serif-it text-xl text-yellow">para a bola rolar</div>
            <div className="font-mono text-[11px] text-paper/50 mt-1">Fase de grupos · 11 Jun · 16:00</div>
          </div>
        </div>
        <button onClick={onCta} className="btn-yellow w-fit">FAZER PALPITES AGORA →</button>
      </div>
    </div>
  )
}

// ─── Prediction progress bar ──────────────────────────────────────────────────

function PredProgress({ done, total, label }: { done: number; total: number; label: string }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="font-mono text-[10px] text-ink-3 tracking-eyebrow">{label}</span>
        <span className="font-mono text-[10px] font-bold text-ink">{done}/{total}</span>
      </div>
      <div className="h-1 bg-hairline overflow-hidden">
        <div className="h-full bg-green transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

// ─── Mobile ───────────────────────────────────────────────────────────────────

function HomeMobile() {
  const navigate = useNavigate()
  const user = useAuthStore(s => s.user)
  const { predictions, championPick, vicePick, scorerPick } = usePredictionStore()
  const upcoming = MOCK_UPCOMING
  const days = daysUntil(TOURNAMENT_START)

  const totalMatches = WC2026_MATCHES.length
  const totalPredictions = Object.keys(predictions).length
  const apostasFeitas = [championPick, vicePick, scorerPick].filter(Boolean).length
  const top3 = MOCK_RANKING.slice(0, 3)
  const myRank = MOCK_RANKING.find(r => r.isYou)

  return (
    <div className="min-h-dvh bg-paper pb-24">

      {/* ── Hero — countdown ── */}
      <RotatingHero days={days} />

      <div className="px-4 space-y-3 pt-4">

        {/* ── Progresso do usuário ── */}
        <div className="border-2 border-ink p-4 space-y-3">
          <div className="flex items-baseline gap-2 mb-1">
            <span className="font-display text-lg">OLÁ{user?.firstName ? `, ${user.firstName.toUpperCase()}` : ''}!</span>
            <span className="font-serif-it text-sm text-ink-3">veja seu progresso</span>
          </div>
          <PredProgress done={totalPredictions} total={totalMatches} label="PALPITES DA FASE DE GRUPOS" />
          <PredProgress done={apostasFeitas} total={3} label="APOSTAS GERAIS" />
          {(totalPredictions === 0 && apostasFeitas === 0) && (
            <p className="font-mono text-[10px] text-ink-3">Nenhum palpite feito ainda. Comece agora!</p>
          )}
          <button onClick={() => navigate('/prediction')} className="btn-yellow w-full justify-center text-[11px] mt-1">
            {totalPredictions === 0 ? 'COMEÇAR A PALPITAR →' : 'CONTINUAR PALPITANDO →'}
          </button>
        </div>

        {/* ── Upcoming matches ── */}
        <div>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="font-display text-lg text-ink">PRÓXIMOS</span>
            <span className="font-serif-it text-sm text-ink-3">jogos</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {upcoming.slice(0, 4).map(match => {
              const hasPick = !!predictions[match.id]
              return (
                <button
                  key={match.id}
                  onClick={() => navigate('/prediction')}
                  className={cn(
                    'border-2 p-3 flex items-center gap-2 hover:-translate-y-px transition-transform text-left',
                    hasPick ? 'border-green bg-green/5' : 'border-ink'
                  )}
                >
                  <Flag team={match.home} size={22} />
                  <span className="font-mono text-[10px] font-bold">{match.home.code}</span>
                  <span className="font-mono text-[9px] text-ink-4 mx-0.5">×</span>
                  <span className="font-mono text-[10px] font-bold">{match.away.code}</span>
                  <Flag team={match.away} size={22} />
                  {hasPick && <span className="font-mono text-[8px] text-green ml-auto">✓</span>}
                </button>
              )
            })}
          </div>
          <button onClick={() => navigate('/prediction')} className="mt-2 font-mono text-[10px] text-ink-3 hover:text-ink tracking-eyebrow">
            VER TODOS OS {totalMatches} JOGOS →
          </button>
        </div>

        {/* ── Ranking preview ── */}
        {top3.length > 0 && (
          <div className="border-2 border-ink">
            <div className="px-4 py-2.5 border-b border-hairline flex items-baseline justify-between">
              <span className="font-display text-base">RANKING</span>
              <button onClick={() => navigate('/ranking')} className="font-mono text-[10px] text-ink-4 hover:text-ink">
                VER TUDO →
              </button>
            </div>
            <div className="divide-y divide-hairline">
              {top3.map(r => (
                <div key={r.userId} className={cn('flex items-center gap-3 px-4 py-2.5', r.isYou && 'bg-yellow')}>
                  <span className="font-display text-xl w-6 flex-shrink-0">{r.rank}°</span>
                  <Avatar initials={r.initials} color={r.color} size={28} />
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-[11px] font-bold truncate">{r.name}</div>
                    <div className="font-mono text-[9px] text-ink-3">{r.dept}</div>
                  </div>
                  <span className="font-display text-lg">{fmtPts(r.pts)}</span>
                </div>
              ))}
              {myRank && myRank.rank > 3 && (
                <div className="flex items-center gap-3 px-4 py-2.5 bg-yellow">
                  <span className="font-display text-xl w-6 flex-shrink-0">{myRank.rank}°</span>
                  <Avatar initials={myRank.initials} color={myRank.color} size={28} />
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-[11px] font-bold truncate">Você</div>
                    <div className="font-mono text-[9px] text-ink-3">{myRank.dept}</div>
                  </div>
                  <span className="font-display text-lg">{fmtPts(myRank.pts)}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Apostas gerais CTA ── */}
        {apostasFeitas < 3 && (
          <div className="border-2 border-yellow bg-yellow/10 p-4">
            <div className="font-mono text-[10px] tracking-eyebrow text-ink-3 mb-1">APOSTAS GERAIS · OBRIGATÓRIO</div>
            <p className="font-display text-xl text-ink leading-tight mb-2">
              CAMPEÃO · VICE · ARTILHEIRO
            </p>
            <p className="font-mono text-[10px] text-ink-3 mb-3">
              Prazo: antes de 11 Jun · 16:00 · vale até +50 pontos
            </p>
            <button
              onClick={() => navigate('/prediction', { state: { tab: 'champion' } })}
              className="btn-ink text-[11px] w-full justify-center"
            >
              FAZER APOSTAS GERAIS →
            </button>
          </div>
        )}

        {/* ── Mata-mata CTA ── */}
        <div className="border-2 border-ink p-4 flex items-center justify-between gap-3">
          <div>
            <div className="font-mono text-[10px] tracking-eyebrow text-ink-3 mb-0.5">MATA-MATA</div>
            <div className="font-display text-xl">MINHA CHAVE</div>
            <div className="font-serif-it text-sm text-ink-3">oitavas · quartas · semi · final</div>
          </div>
          <button
            onClick={() => navigate('/bracket')}
            className="btn-ink text-[11px] px-4 py-2.5 flex-shrink-0"
          >
            PALPITAR →
          </button>
        </div>
      </div>

    </div>
  )
}

// ─── Desktop ──────────────────────────────────────────────────────────────────

function HomeDesktop() {
  const navigate = useNavigate()
  const user = useAuthStore(s => s.user)
  const { predictions, championPick, vicePick, scorerPick } = usePredictionStore()
  const upcoming = MOCK_UPCOMING
  const days = daysUntil(TOURNAMENT_START)

  const totalMatches = WC2026_MATCHES.length
  const totalPredictions = Object.keys(predictions).length
  const apostasFeitas = [championPick, vicePick, scorerPick].filter(Boolean).length
  const top5 = MOCK_RANKING.slice(0, 5)
  const myRank = MOCK_RANKING.find(r => r.isYou)

  return (
    <div className="min-h-dvh bg-paper">
      <div className="max-w-screen-xl mx-auto px-6 py-8 space-y-5">

        {/* ── Hero row — 3 columns ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-[1.5fr_1fr_0.9fr] gap-5">

          {/* Countdown card — rotating hero */}
          <RotatingHeroDesktop days={days} onCta={() => navigate('/prediction')} />

          {/* Progresso */}
          <div className="border-2 border-ink bg-ink text-paper flex flex-col p-6 gap-4">
            <div>
              <div className="font-mono text-[10px] tracking-eyebrow text-paper/40 mb-1">
                OLÁ{user?.firstName ? `, ${user.firstName.toUpperCase()}` : ''}!
              </div>
              <div className="font-display text-4xl leading-none">{totalPredictions}</div>
              <div className="font-serif-it text-paper/60 text-sm">de {totalMatches} palpites feitos</div>
            </div>

            <div className="space-y-3 flex-1">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="font-mono text-[9px] text-paper/40 tracking-eyebrow">GRUPOS</span>
                  <span className="font-mono text-[9px] text-paper/60">{totalPredictions}/{totalMatches}</span>
                </div>
                <div className="h-1 bg-paper/10 overflow-hidden">
                  <div className="h-full bg-yellow transition-all" style={{ width: `${totalMatches > 0 ? (totalPredictions / totalMatches) * 100 : 0}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <span className="font-mono text-[9px] text-paper/40 tracking-eyebrow">APOSTAS GERAIS</span>
                  <span className="font-mono text-[9px] text-paper/60">{apostasFeitas}/3</span>
                </div>
                <div className="h-1 bg-paper/10 overflow-hidden">
                  <div className="h-full bg-green transition-all" style={{ width: `${(apostasFeitas / 3) * 100}%` }} />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <button onClick={() => navigate('/prediction')} className="btn-yellow w-full justify-center">
                {totalPredictions === 0 ? 'COMEÇAR →' : 'CONTINUAR →'}
              </button>
              {apostasFeitas < 3 && (
                <button
                  onClick={() => navigate('/prediction', { state: { tab: 'champion' } })}
                  className="w-full border border-yellow/30 p-2 text-center hover:bg-yellow/10 transition-colors"
                >
                  <span className="font-mono text-[9px] text-yellow tracking-eyebrow">
                    ⚠ APOSTAS GERAIS PENDENTES
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* Ranking preview */}
          <div className="border-2 border-ink flex flex-col">
            <div className="px-4 py-3 border-b border-hairline flex items-baseline justify-between">
              <div className="flex items-baseline gap-2">
                <span className="font-display text-lg">RANKING</span>
                {myRank && <span className="font-serif-it text-sm text-ink-3">{myRank.rank}° você</span>}
              </div>
              <button onClick={() => navigate('/ranking')} className="font-mono text-[10px] text-ink-4 hover:text-ink">
                VER TUDO →
              </button>
            </div>
            {top5.length > 0 ? (
              <div className="flex-1 divide-y divide-hairline">
                {top5.map(r => (
                  <div key={r.userId} className={cn('flex items-center gap-2 px-4 py-2', r.isYou && 'bg-yellow')}>
                    <span className="font-display text-base w-5 flex-shrink-0">{r.rank}</span>
                    <Avatar initials={r.initials} color={r.color} size={24} />
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-[10px] font-bold truncate">{r.name.split(' ')[0]}</div>
                      <div className="font-mono text-[8px] text-ink-3">{r.dept}</div>
                    </div>
                    <span className="font-display text-base">{fmtPts(r.pts)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-3">
                <span className="font-display text-5xl text-ink-4">—</span>
                <p className="font-mono text-[11px] text-ink-3 leading-relaxed max-w-[160px]">
                  Os pontos aparecem aqui quando os jogos começarem.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ── Secondary row ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-[1.6fr_1fr_1fr] gap-5">

          {/* Upcoming matches */}
          <div className="border-2 border-ink">
            <div className="px-4 py-3 border-b border-hairline flex items-baseline gap-2">
              <span className="font-display text-lg">PRÓXIMOS</span>
              <span className="font-serif-it text-sm text-ink-3">jogos · grupo</span>
            </div>
            <div className="divide-y divide-hairline">
              {upcoming.slice(0, 6).map(match => {
                const hasPick = !!predictions[match.id]
                return (
                  <button
                    key={match.id}
                    onClick={() => navigate('/prediction')}
                    className={cn(
                      'w-full flex items-center gap-4 px-4 py-3 transition-colors text-left group',
                      hasPick ? 'bg-green/5 hover:bg-green/10' : 'hover:bg-hairline'
                    )}
                  >
                    <div className="flex-shrink-0 w-14 text-center">
                      <div className="font-mono text-[9px] text-ink-4 tracking-eyebrow">GRUPO {match.group}</div>
                    </div>
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Flag team={match.home} size={26} />
                      <div className="min-w-0">
                        <div className="font-mono text-[12px] font-bold truncate">{match.home.name}</div>
                      </div>
                    </div>
                    <div className="text-center flex-shrink-0 px-2">
                      <div className="font-mono text-[9px] text-ink-4 tracking-eyebrow">{match.date}</div>
                      <div className="font-display text-lg leading-none">{match.time}</div>
                    </div>
                    <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                      <div className="min-w-0 text-right">
                        <div className="font-mono text-[12px] font-bold truncate">{match.away.name}</div>
                      </div>
                      <Flag team={match.away} size={26} />
                    </div>
                    {hasPick
                      ? <span className="font-mono text-[10px] text-green flex-shrink-0">✓</span>
                      : <span className="font-mono text-[10px] text-ink-4 group-hover:text-ink transition-colors flex-shrink-0">→</span>
                    }
                  </button>
                )
              })}
            </div>
            <button onClick={() => navigate('/prediction')} className="w-full px-4 py-2.5 font-mono text-[10px] text-ink-3 hover:text-ink tracking-eyebrow border-t border-hairline text-center">
              VER TODOS OS {totalMatches} JOGOS →
            </button>
          </div>

          {/* Mata-mata CTA */}
          <div className="border-2 border-ink flex flex-col">
            <div className="px-4 py-3 border-b border-hairline flex items-baseline gap-2">
              <span className="font-display text-lg">MINHA CHAVE</span>
              <span className="font-serif-it text-sm text-ink-3">mata-mata</span>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-4">
              <p className="font-mono text-[11px] text-ink-3 leading-relaxed">
                Palpite no mata-mata — oitavas a partir de 27 Jun. Seus palpites de grupo determinam as equipes.
              </p>
              <button
                onClick={() => navigate('/bracket')}
                className="btn-yellow w-full justify-center"
              >
                MINHA CHAVE →
              </button>
            </div>
          </div>

          {/* Resenha CTA */}
          <ResenhaCard />
        </div>
      </div>

    </div>
  )
}

function ResenhaCard() {
  const navigate = useNavigate()
  const messages = useChatStore(s => s.messages)
  const recent = messages.slice(-3)

  return (
    <div className="border-2 border-ink flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b border-hairline flex items-baseline justify-between">
        <div className="flex items-baseline gap-1.5">
          <span className="font-display text-lg">#RESENHA</span>
          <span className="font-serif-it text-sm text-ink-3">ao vivo</span>
        </div>
        <button onClick={() => navigate('/resenha')} className="font-mono text-[10px] text-ink-4 hover:text-ink">
          ENTRAR →
        </button>
      </div>
      {recent.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-3">
          <span className="font-display text-4xl text-ink-4">💬</span>
          <p className="font-mono text-[11px] text-ink-3 leading-relaxed">
            Nenhuma mensagem ainda. Seja o primeiro a entrar na resenha.
          </p>
          <button onClick={() => navigate('/resenha')} className="btn-ghost text-[10px]">
            ENTRAR NA RESENHA →
          </button>
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-hairline">
          {recent.map(msg => (
            <div key={msg.id} className="px-4 py-2.5 flex gap-2.5 items-start">
              <Avatar initials={msg.initials} color={msg.color} size={24} />
              <div className="flex-1 min-w-0">
                <span className="font-mono text-[10px] font-bold text-ink">{msg.who}</span>
                <p className="font-sans text-[12px] text-ink-2 leading-snug truncate">{msg.text}</p>
              </div>
            </div>
          ))}
          <button
            onClick={() => navigate('/resenha')}
            className="px-4 py-2.5 font-mono text-[10px] text-ink-4 hover:text-ink hover:bg-hairline text-left transition-colors"
          >
            VER TUDO →
          </button>
        </div>
      )}
    </div>
  )
}
