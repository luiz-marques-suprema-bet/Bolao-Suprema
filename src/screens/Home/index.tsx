import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Flag } from '@/components/shared/Flag'
import { Avatar } from '@/components/shared/Avatar'
import { Marquee } from '@/components/shared/Marquee'
import { useAuthStore } from '@/stores/auth.store'
import { useIsDesktop } from '@/hooks/useBreakpoint'
import { MOCK_LIVE, MOCK_UPCOMING, MOCK_PAST, MOCK_RANKING } from '@/data/mock'
import { fmtPts, asset } from '@/lib/utils'
import { cn } from '@/lib/utils'

const MARQUEE_ITEMS = MOCK_PAST.map(
  m => `${m.home.code} ${m.homeScore ?? '?'}–${m.awayScore ?? '?'} ${m.away.code}`
)

export function HomeScreen() {
  const isDesktop = useIsDesktop()
  return isDesktop ? <HomeDesktop /> : <HomeMobile />
}

// ─── Mobile ───────────────────────────────────────────────────────────────────

function HomeMobile() {
  const navigate = useNavigate()
  const user = useAuthStore(s => s.user)
  const me = MOCK_RANKING.find(r => r.isYou)
  const live = MOCK_LIVE
  const upcoming = MOCK_UPCOMING

  return (
    <div className="min-h-dvh bg-paper pb-24">

      {/* ── Live match hero ── */}
      <section className="relative overflow-hidden" style={{ height: 300 }}>
        <img
          src={asset('assets/hero-jogadores.webp')}
          alt=""
          className="absolute inset-0 w-full h-full object-cover object-top"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-ink/50 via-ink/20 to-ink/80 pitch-turf" />

        <div className="absolute inset-0 flex flex-col items-center justify-end pb-5 px-4">
          {/* Live badge */}
          <div className="flex items-center gap-2 mb-3">
            <span className="live-dot" />
            <span className="font-mono text-[10px] font-bold tracking-eyebrow text-paper">
              AO VIVO · {live.liveMinute}
            </span>
          </div>

          {/* Teams & Score */}
          <div className="flex items-center gap-4 w-full justify-center">
            <div className="flex flex-col items-center gap-1.5">
              <Flag team={live.home} size={44} ring />
              <span className="font-mono text-[10px] font-bold text-paper/80">{live.home.code}</span>
            </div>
            <div className="font-display text-[88px] leading-none text-paper">
              {live.homeScore}–{live.awayScore}
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <Flag team={live.away} size={44} ring />
              <span className="font-mono text-[10px] font-bold text-paper/80">{live.away.code}</span>
            </div>
          </div>

          {/* Your pick pill */}
          <div className="mt-3 flex items-center gap-3">
            <div className="px-3 py-1.5 bg-paper/10 backdrop-blur-sm border border-paper/20 flex items-center gap-2">
              <span className="font-mono text-[10px] text-paper/60 tracking-eyebrow">SEU PALPITE</span>
              <span className="font-mono text-[13px] font-bold text-yellow">2–1</span>
            </div>
            <div className="px-3 py-1.5 bg-paper/10 backdrop-blur-sm border border-paper/20 flex items-center gap-2">
              <span className="font-mono text-[10px] text-paper/60 tracking-eyebrow">MAIS VOTADO</span>
              <span className="font-mono text-[13px] font-bold text-paper">2–0</span>
            </div>
          </div>
        </div>
      </section>

      <div className="px-4 space-y-3 pt-4">

        {/* ── You card ── */}
        {me && (
          <div className="bg-ink text-paper p-4 flex items-center gap-3">
            <Avatar initials={me.initials} color={me.color} size={44} />
            <div className="flex-1 min-w-0">
              <div className="font-mono text-[10px] text-paper/50 tracking-eyebrow">
                {me.rank}º · {me.streak > 0 && `${me.streak}🔥 SEQUÊNCIA · `}+3 ESSA SEMANA
              </div>
              <div className="font-display text-3xl leading-tight">{fmtPts(me.pts)} PTS</div>
            </div>
            <button onClick={() => navigate('/ranking')} className="font-mono text-[10px] font-bold text-yellow tracking-eyebrow flex-shrink-0">
              RANKING →
            </button>
          </div>
        )}

        {/* ── CTA palpite — editorial composition ── */}
        <div className="bg-yellow border-2 border-ink p-4 flex items-start justify-between gap-3">
          <div>
            <div className="font-mono text-[10px] tracking-eyebrow text-ink-3 mb-1">PRÓXIMOS JOGOS</div>
            <div className="leading-none">
              <span className="font-display text-4xl text-ink">{upcoming.length} JOGOS</span>
              <br />
              <span className="font-serif-it text-xl text-green-deep">esperando você</span>
            </div>
          </div>
          <button onClick={() => navigate('/prediction')} className="btn-ink text-[11px] px-4 py-2.5 flex-shrink-0 mt-1">
            PALPITAR →
          </button>
        </div>

        {/* ── Upcoming matches grid ── */}
        <div>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="font-display text-lg text-ink">PRÓXIMOS</span>
            <span className="font-serif-it text-sm text-ink-3">jogos</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {upcoming.slice(0, 4).map(match => (
              <button
                key={match.id}
                onClick={() => navigate(`/prediction/${match.id}`)}
                className="border-2 border-ink p-3 flex items-center gap-2 hover:-translate-y-px transition-transform text-left"
              >
                <Flag team={match.home} size={22} />
                <span className="font-mono text-[10px] font-bold">{match.home.code}</span>
                <span className="font-mono text-[9px] text-ink-4 mx-0.5">×</span>
                <span className="font-mono text-[10px] font-bold">{match.away.code}</span>
                <Flag team={match.away} size={22} />
              </button>
            ))}
          </div>
          {upcoming.length > 4 && (
            <button onClick={() => navigate('/prediction')} className="mt-2 font-mono text-[10px] text-ink-3 hover:text-ink tracking-eyebrow">
              + {upcoming.length - 4} JOGOS RESTANTES →
            </button>
          )}
        </div>

        {/* ── Past results ── */}
        {MOCK_PAST.length > 0 && (
          <div>
            <div className="flex items-baseline gap-2 mb-2">
              <span className="font-display text-lg text-ink">ÚLTIMOS</span>
              <span className="font-serif-it text-sm text-ink-3">resultados</span>
            </div>
            <div className="space-y-0.5">
              {MOCK_PAST.slice(0, 3).map(m => (
                <div key={m.id} className="flex items-center gap-3 py-2 border-b border-hairline">
                  <Flag team={m.home} size={18} />
                  <span className="font-mono text-[11px] font-bold">{m.home.code}</span>
                  <span className="font-display text-xl flex-1 text-center tracking-tight">
                    {m.homeScore}–{m.awayScore}
                  </span>
                  <span className="font-mono text-[11px] font-bold">{m.away.code}</span>
                  <Flag team={m.away} size={18} />
                  {m.pts !== undefined && (
                    <span className={cn('font-mono text-[10px] font-bold ml-1 w-8 text-right', m.pts > 0 ? 'text-green' : 'text-ink-4')}>
                      {m.pts > 0 ? `+${m.pts}` : '—'}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Marquee ── */}
      <div className="mt-6 border-t border-line bg-ink">
        <Marquee items={MARQUEE_ITEMS} color="#FFCB05" bg="#0D0D0D" speed={35} />
      </div>
    </div>
  )
}

// ─── Desktop ──────────────────────────────────────────────────────────────────

function HomeDesktop() {
  const navigate = useNavigate()
  const me = MOCK_RANKING.find(r => r.isYou)
  const live = MOCK_LIVE
  const upcoming = MOCK_UPCOMING

  return (
    <div className="min-h-dvh bg-paper">
      <div className="max-w-screen-xl mx-auto px-6 py-8 space-y-5">

        {/* ── Hero row — 3 columns ── */}
        <div className="grid grid-cols-[1.5fr_1fr_0.9fr] gap-5">

          {/* Live match card */}
          <div className="relative overflow-hidden min-h-[340px] border-2 border-ink">
            <img
              src={asset('assets/hero-jogadores.webp')}
              alt=""
              className="absolute inset-0 w-full h-full object-cover object-top pitch-turf"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/20 to-transparent" />
            <div className="relative h-full flex flex-col justify-end p-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="live-dot" />
                <span className="font-mono text-[10px] font-bold tracking-eyebrow text-paper/90">
                  AO VIVO · {live.stageLabel} · {live.liveMinute}
                </span>
              </div>
              <div className="flex items-center gap-5">
                <div className="flex flex-col items-center gap-2">
                  <Flag team={live.home} size={56} ring />
                  <span className="font-mono text-[10px] font-bold text-paper/80">{live.home.name.toUpperCase()}</span>
                </div>
                <div className="flex-1 text-center">
                  <div className="font-display text-[100px] leading-none text-paper">
                    {live.homeScore}–{live.awayScore}
                  </div>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <Flag team={live.away} size={56} ring />
                  <span className="font-mono text-[10px] font-bold text-paper/80">{live.away.name.toUpperCase()}</span>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-paper/10 border border-paper/20">
                  <span className="font-mono text-[10px] text-paper/60 tracking-eyebrow">SEU PALPITE</span>
                  <span className="font-mono text-sm font-bold text-yellow">2–1</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-paper/10 border border-paper/20">
                  <span className="font-mono text-[10px] text-paper/60 tracking-eyebrow">MAIS VOTADO</span>
                  <span className="font-mono text-sm font-bold text-paper">2–0</span>
                </div>
              </div>
            </div>
          </div>

          {/* Your position card */}
          {me && (
            <div className="bg-ink text-paper border-2 border-ink p-6 flex flex-col justify-between">
              <div>
                <div className="font-mono text-[10px] tracking-eyebrow text-paper/40 mb-3">SUA POSIÇÃO</div>
                <div className="font-display text-[76px] leading-none">{String(me.rank).padStart(2, '0')}º</div>
                <div className="font-mono text-[11px] text-paper/50 mt-1">{me.dept}</div>
              </div>
              <div>
                <div className="leading-none mb-4">
                  <div className="font-display text-3xl text-yellow">{fmtPts(me.pts)} PTS</div>
                  <div className="font-serif-it text-paper/40 text-sm">no bolão</div>
                </div>
                <div className="grid grid-cols-3 gap-2 border-t border-paper/10 pt-4">
                  <div>
                    <div className="font-display text-2xl">{me.correct}</div>
                    <div className="font-mono text-[9px] text-paper/40 tracking-eyebrow">ACERTOS</div>
                  </div>
                  <div>
                    <div className="font-display text-2xl">{me.exact}</div>
                    <div className="font-mono text-[9px] text-paper/40 tracking-eyebrow">EXATOS</div>
                  </div>
                  <div>
                    <div className="font-display text-2xl">{me.streak}🔥</div>
                    <div className="font-mono text-[9px] text-paper/40 tracking-eyebrow">STREAK</div>
                  </div>
                </div>
                <button onClick={() => navigate('/ranking')} className="btn-yellow w-full justify-center mt-4">
                  VER RANKING →
                </button>
              </div>
            </div>
          )}

          {/* CTA card — editorial mixed typography */}
          <div className="relative overflow-hidden border-2 border-ink flex flex-col justify-between p-6 bg-green">
            <div>
              <div className="font-mono text-[10px] tracking-eyebrow text-paper/60 mb-3">SEM PALPITE</div>
              <div className="leading-none">
                <div className="font-display text-[72px] text-paper leading-none">{upcoming.length}</div>
                <div className="font-display text-3xl text-paper">JOGOS</div>
                <div className="font-serif-it text-xl text-yellow mt-1">esperando você</div>
              </div>
            </div>
            <div>
              <p className="font-mono text-[11px] text-paper/60 mb-4 leading-relaxed">
                Não fique de fora. Cada jogo é ponto no bolso.
              </p>
              <button onClick={() => navigate('/prediction')} className="btn-yellow w-full justify-center">
                PALPITAR AGORA →
              </button>
            </div>
          </div>
        </div>

        {/* ── Secondary row ── */}
        <div className="grid grid-cols-[1.6fr_1fr_1fr] gap-5">

          {/* Upcoming matches */}
          <div className="border-2 border-ink">
            <div className="px-4 py-3 border-b border-hairline flex items-baseline gap-2">
              <span className="font-display text-lg">PRÓXIMOS</span>
              <span className="font-serif-it text-sm text-ink-3">jogos · grupo</span>
            </div>
            <div className="divide-y divide-hairline">
              {upcoming.slice(0, 6).map(match => (
                <button
                  key={match.id}
                  onClick={() => navigate(`/prediction/${match.id}`)}
                  className="w-full flex items-center gap-4 px-4 py-3 hover:bg-hairline transition-colors text-left group"
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
                  <span className="font-mono text-[10px] text-ink-4 group-hover:text-ink transition-colors flex-shrink-0">→</span>
                </button>
              ))}
            </div>
            {upcoming.length > 6 && (
              <button onClick={() => navigate('/prediction')} className="w-full px-4 py-2.5 font-mono text-[10px] text-ink-3 hover:text-ink tracking-eyebrow border-t border-hairline text-center">
                + {upcoming.length - 6} MAIS →
              </button>
            )}
          </div>

          {/* Top ranking */}
          <div className="border-2 border-ink">
            <div className="px-4 py-3 border-b border-hairline flex items-baseline justify-between">
              <div className="flex items-baseline gap-2">
                <span className="font-display text-lg">RANKING</span>
                <span className="font-serif-it text-sm text-ink-3">top 5</span>
              </div>
              <button onClick={() => navigate('/ranking')} className="font-mono text-[10px] text-ink-4 hover:text-ink">VER TUDO →</button>
            </div>
            <div className="divide-y divide-hairline">
              {MOCK_RANKING.slice(0, 5).map(r => (
                <motion.div
                  key={r.userId}
                  className={cn('flex items-center gap-3 px-4 py-2.5', r.isYou ? 'bg-yellow' : 'hover:bg-hairline/50')}
                  whileHover={{ x: r.isYou ? 0 : 2 }}
                  transition={{ duration: 0.12 }}
                >
                  <span className="font-display text-2xl w-7 flex-shrink-0">{r.rank}º</span>
                  <Avatar initials={r.initials} color={r.color} size={28} />
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-[12px] font-bold truncate">{r.name}</div>
                    <div className="font-mono text-[10px] text-ink-3">{r.dept}</div>
                  </div>
                  <span className="font-display text-xl flex-shrink-0">{fmtPts(r.pts)}</span>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Resenha peek */}
          <div className="border-2 border-ink flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-hairline flex items-baseline justify-between">
              <div className="flex items-baseline gap-1.5">
                <span className="font-display text-lg">#RESENHA</span>
                <span className="font-serif-it text-sm text-ink-3">ao vivo</span>
              </div>
              <button onClick={() => navigate('/resenha')} className="font-mono text-[10px] text-ink-4 hover:text-ink">ENTRAR →</button>
            </div>
            <div className="flex-1 p-3 space-y-3 overflow-hidden">
              {[
                { name: 'Lucas M.', text: 'BRASIL ABRINDO 1-0! 🔥', color: '#00A651', init: 'LM' },
                { name: 'Camila R.', text: 'Marrocos empatou 1-1 😱', color: '#6FB4FF', init: 'CR' },
                { name: 'Felipe S.', text: 'Acertei o 2-1! no ranking 👀', color: '#00A651', init: 'FS', isYou: true },
              ].map((m, i) => (
                <div key={i} className={cn('flex gap-2', m.isYou ? 'flex-row-reverse' : '')}>
                  <Avatar initials={m.init} color={m.color} size={24} className="flex-shrink-0" />
                  <div className={cn(
                    'px-3 py-1.5 text-[12px] max-w-[85%] leading-snug',
                    m.isYou
                      ? 'bg-yellow text-ink rounded-[12px_3px_12px_12px]'
                      : 'bg-paper-deep text-ink rounded-[3px_12px_12px_12px]'
                  )}>
                    {m.text}
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-hairline px-3 py-2 bg-paper-deep">
              <button onClick={() => navigate('/resenha')} className="w-full font-mono text-[10px] text-ink-3 text-center hover:text-ink tracking-eyebrow">
                ENTRAR NA RESENHA →
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Marquee ── */}
      <div className="border-t border-line bg-ink mt-4">
        <Marquee items={MARQUEE_ITEMS} color="#FFCB05" bg="#0D0D0D" speed={35} />
      </div>
    </div>
  )
}
