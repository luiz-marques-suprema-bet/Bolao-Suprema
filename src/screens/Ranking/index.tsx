import { useState } from 'react'
import { Avatar } from '@/components/shared/Avatar'
import { Eyebrow } from '@/components/shared/Eyebrow'
import { useIsDesktop } from '@/hooks/useBreakpoint'
import { useAuthStore } from '@/stores/auth.store'
import { MOCK_RANKING } from '@/data/mock'
import { fmtPts, cn } from '@/lib/utils'
import type { RankingEntry } from '@/types'

const MOV_COLOR = (mov: string) =>
  mov.startsWith('+') ? 'text-green' : mov.startsWith('-') ? 'text-red' : 'text-ink-4'

export function RankingScreen() {
  const isDesktop = useIsDesktop()
  return isDesktop ? <RankingDesktop /> : <RankingMobile />
}

// ─── Row component ─────────────────────────────────────────────────────────────

function RankingRow({ r, large = false }: { r: RankingEntry; large?: boolean }) {
  return (
    <div className={cn(
      'flex items-center gap-3 border-b border-hairline',
      r.isYou ? 'bg-yellow' : 'hover:bg-paper-deep/50',
      large ? 'px-5 py-3.5' : 'px-4 py-2.5'
    )}>
      <span className={cn('font-display flex-shrink-0', large ? 'text-3xl w-9' : 'text-2xl w-7')}>
        {r.rank}º
      </span>
      <Avatar initials={r.initials} color={r.color} size={large ? 36 : 28} />
      <div className="flex-1 min-w-0">
        <div className={cn('font-mono font-bold truncate', large ? 'text-[13px]' : 'text-[12px]')}>
          {r.name}
        </div>
        <div className="font-mono text-[10px] text-ink-3">{r.dept}</div>
      </div>
      <span className={cn('font-mono text-[10px] font-bold w-6 text-center', MOV_COLOR(r.mov))}>
        {r.mov}
      </span>
      <div className="hidden sm:flex items-center gap-4 font-mono text-[11px] text-ink-3">
        <span title="Acertos">{r.correct}</span>
        <span title="Exatos" className="text-green">{r.exact}</span>
        <span title="Streak">{r.streak}🔥</span>
      </div>
      <span className={cn('font-display', large ? 'text-2xl' : 'text-xl')}>{fmtPts(r.pts)}</span>
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyRanking() {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center px-6">
      <span className="font-display text-6xl text-ink-4">—</span>
      <div>
        <div className="font-display text-2xl text-ink mb-1">AINDA SEM PONTOS</div>
        <p className="font-mono text-[11px] text-ink-3 max-w-[280px] leading-relaxed">
          O torneio começa em 11 Jun. O ranking será preenchido à medida que os resultados saírem.
        </p>
      </div>
    </div>
  )
}

// ─── Mobile ───────────────────────────────────────────────────────────────────

function RankingMobile() {
  const [tab, setTab] = useState<'geral' | 'squad' | 'semana'>('geral')
  const me = useAuthStore(s => s.user)
  const fullRanking = MOCK_RANKING
  const myEntry = fullRanking.find(r => r.isYou)

  const ranking = tab === 'squad' && me
    ? fullRanking.filter(r => r.dept === me.dept)
    : fullRanking

  const top3 = fullRanking.slice(0, 3)

  return (
    <div className="min-h-dvh bg-paper pb-24">
      <div className="bg-paper-deep px-4 pt-6 pb-4">
        <Eyebrow className="mb-4">RANKING · BOLÃO DA SUPREMA</Eyebrow>

        {top3.length >= 3 ? (
          <div className="flex items-end justify-center gap-2">
            {[top3[1], top3[0], top3[2]].map((r, i) => {
              const heights = [90, 124, 80]
              const ranks = [2, 1, 3]
              return (
                <div key={r.userId} className="flex flex-col items-center gap-2 flex-1 max-w-[100px]">
                  <Avatar initials={r.initials} color={r.color} size={ranks[i] === 1 ? 44 : 36} />
                  <div className="font-mono text-[10px] font-bold text-center truncate px-1">
                    {r.name.split(' ')[0]}
                  </div>
                  <div
                    className={cn('w-full flex items-start justify-center pt-3 border-2 border-ink',
                      ranks[i] === 1 ? 'bg-yellow' : 'bg-paper')}
                    style={{ height: heights[i] }}
                  >
                    <span className="font-display text-3xl">{ranks[i]}º</span>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <EmptyRanking />
        )}
      </div>

      {myEntry && (
        <div className="bg-ink text-paper px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
          <Avatar initials={myEntry.initials} color={myEntry.color} size={32} />
          <div className="flex-1">
            <div className="font-mono text-[10px] text-paper/50">VOCÊ · {myEntry.rank}º</div>
            <div className="font-display text-2xl">{fmtPts(myEntry.pts)} PTS</div>
          </div>
          <div className="text-right">
            <div className="font-mono text-[10px] text-paper/50">{myEntry.correct} acertos</div>
            <div className="font-mono text-[10px] text-yellow">{myEntry.streak}🔥 streak</div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 border-b border-line">
        {(['geral', 'squad', 'semana'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('py-2.5 font-mono text-[10px] font-bold tracking-eyebrow uppercase transition-colors',
              tab === t ? 'bg-ink text-paper' : 'text-ink-3 hover:bg-hairline')}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'geral' && ranking.length === 0 && (
        <div className="mx-4 mt-4 border-2 border-ink p-4">
          <p className="font-mono text-[10px] tracking-eyebrow text-ink-3 mb-3">COMO PONTUAR</p>
          <div className="space-y-2">
            {[
              { pts: '10', label: 'Placar exato' },
              { pts: '7',  label: 'Resultado + diferença de gols' },
              { pts: '3',  label: 'Só o vencedor' },
              { pts: '25', label: 'Campeão (aposta geral)' },
              { pts: '15', label: 'Vice-campeão' },
              { pts: '10', label: 'Artilheiro' },
            ].map(r => (
              <div key={r.label} className="flex items-center gap-2">
                <span className="font-display text-xl text-green w-8 flex-shrink-0">+{r.pts}</span>
                <span className="font-mono text-[11px] text-ink-3">{r.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'semana' ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center px-4">
          <p className="font-mono text-[11px] text-ink-3">Ranking semanal disponível após o início dos jogos.</p>
        </div>
      ) : ranking.length > 0 ? (
        <div className="divide-y divide-hairline">
          {ranking.map(r => <RankingRow key={r.userId} r={r} />)}
        </div>
      ) : tab === 'squad' ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center px-4">
          <p className="font-mono text-[11px] text-ink-3">Nenhum colega do seu squad pontuou ainda.</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 py-10 text-center px-4">
          <p className="font-mono text-[11px] text-ink-3">Nenhum palpite pontuado ainda.</p>
        </div>
      )}
    </div>
  )
}

// ─── Desktop ──────────────────────────────────────────────────────────────────

function RankingDesktop() {
  const ranking = MOCK_RANKING
  const top3 = ranking.slice(0, 3)
  const me = ranking.find(r => r.isYou)

  return (
    <div className="min-h-dvh bg-paper">
      <div className="max-w-screen-xl mx-auto px-6 py-8">
        <Eyebrow className="mb-6">RANKING · BOLÃO DA SUPREMA</Eyebrow>

        <div className="grid grid-cols-[1.4fr_1fr] gap-6">
          {/* Left */}
          <div>
            {/* Podium */}
            {top3.length >= 3 ? (
              <div className="flex items-end gap-4 mb-6 border-b border-hairline pb-6">
                {[top3[1], top3[0], top3[2]].map((r, i) => {
                  const ranks = [2, 1, 3]
                  const heights = [100, 132, 88]
                  return (
                    <div key={r.userId} className="flex flex-col items-center gap-2 flex-1">
                      <Avatar initials={r.initials} color={r.color} size={ranks[i] === 1 ? 52 : 40} />
                      <div className="font-mono text-[11px] font-bold text-center">{r.name}</div>
                      <div className="font-mono text-[10px] text-ink-3">{r.dept}</div>
                      <div
                        className={cn('w-full flex items-start justify-center pt-4 border-2 border-ink',
                          ranks[i] === 1 ? 'bg-yellow' : 'bg-paper-deep')}
                        style={{ height: heights[i] }}
                      >
                        <span className="font-display text-4xl">{ranks[i]}º</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="mb-6 border-b border-hairline pb-6">
                <EmptyRanking />
              </div>
            )}

            {/* Full table */}
            <div className="border-2 border-ink">
              <div className="grid grid-cols-[40px_1fr_100px_48px_48px_48px_80px] gap-2 px-5 py-2 border-b border-hairline font-mono text-[9px] tracking-eyebrow text-ink-4">
                <span>#</span><span>JOGADOR</span><span>DEPT</span>
                <span className="text-center">CERT</span>
                <span className="text-center">EXAT</span>
                <span className="text-center">🔥</span>
                <span className="text-right">PTS</span>
              </div>
              {ranking.length > 0 ? ranking.map(r => (
                <div key={r.userId} className={cn(
                  'grid grid-cols-[40px_1fr_100px_48px_48px_48px_80px] gap-2 items-center px-5 py-2.5 border-b border-hairline',
                  r.isYou ? 'bg-yellow' : 'hover:bg-paper-deep/40'
                )}>
                  <span className="font-display text-2xl">{r.rank}</span>
                  <div className="flex items-center gap-2 min-w-0">
                    <Avatar initials={r.initials} color={r.color} size={28} />
                    <div className="min-w-0">
                      <div className="font-mono text-[12px] font-bold truncate">{r.name}</div>
                      <span className={cn('font-mono text-[10px]', MOV_COLOR(r.mov))}>{r.mov}</span>
                    </div>
                  </div>
                  <span className="font-mono text-[10px] text-ink-3 truncate">{r.dept}</span>
                  <span className="font-mono text-[12px] text-center">{r.correct}</span>
                  <span className="font-mono text-[12px] text-center text-green font-bold">{r.exact}</span>
                  <span className="font-mono text-[12px] text-center">{r.streak}</span>
                  <span className="font-display text-xl text-right">{fmtPts(r.pts)}</span>
                </div>
              )) : (
                <div className="px-5 py-8 text-center">
                  <p className="font-mono text-[11px] text-ink-3">
                    Nenhum palpite pontuado ainda · torneio começa em 11 Jun
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Right sidebar */}
          <div className="space-y-4">
            {me ? (
              <div className="bg-ink text-paper p-6">
                <div className="font-mono text-[10px] text-paper/40 tracking-eyebrow mb-3">VOCÊ</div>
                <div className="font-display text-[72px] leading-none">{String(me.rank).padStart(2, '0')}º</div>
                <div className="font-display text-3xl text-yellow mt-1">{fmtPts(me.pts)} PTS</div>
                <div className="grid grid-cols-3 gap-3 mt-5 border-t border-paper/10 pt-4">
                  <div>
                    <div className="font-display text-2xl">{me.correct}</div>
                    <div className="font-mono text-[9px] text-paper/40">ACERTOS</div>
                  </div>
                  <div>
                    <div className="font-display text-2xl">{me.exact}</div>
                    <div className="font-mono text-[9px] text-paper/40">EXATOS</div>
                  </div>
                  <div>
                    <div className="font-display text-2xl">{me.streak}🔥</div>
                    <div className="font-mono text-[9px] text-paper/40">STREAK</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-ink text-paper p-6">
                <div className="font-mono text-[10px] text-paper/40 tracking-eyebrow mb-3">SUA POSIÇÃO</div>
                <div className="font-display text-[72px] leading-none text-paper/20">—</div>
                <p className="font-mono text-[11px] text-paper/40 mt-3">
                  Faça seus palpites. Os pontos aparecem quando os jogos começarem.
                </p>
              </div>
            )}

            {/* Pontuação */}
            <div className="border-2 border-ink p-4">
              <p className="font-mono text-[10px] tracking-eyebrow text-ink-3 mb-3">COMO PONTUAR</p>
              <div className="space-y-2">
                {[
                  { pts: '10', label: 'Placar exato' },
                  { pts: '7',  label: 'Resultado + diferença de gols' },
                  { pts: '3',  label: 'Só o vencedor' },
                  { pts: '25', label: 'Campeão (aposta geral)' },
                  { pts: '15', label: 'Vice-campeão' },
                  { pts: '10', label: 'Artilheiro' },
                ].map(r => (
                  <div key={r.label} className="flex items-center gap-2">
                    <span className="font-display text-xl text-green w-8 flex-shrink-0">+{r.pts}</span>
                    <span className="font-mono text-[11px] text-ink-3">{r.label}</span>
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
