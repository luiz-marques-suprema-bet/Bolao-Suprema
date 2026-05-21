import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Avatar } from '@/components/shared/Avatar'
import { Eyebrow } from '@/components/shared/Eyebrow'
import { FloatingTooltip } from '@/components/shared/FloatingTooltip'
import { useIsDesktop } from '@/hooks/useBreakpoint'
import { useAuthStore } from '@/stores/auth.store'
import { fmtPts, cn } from '@/lib/utils'
import { fetchRanking } from '@/lib/ranking'
import { fetchRankingBreakdown, fetchScoringRules } from '@/services/product'
import type { RankingBreakdown, RankingEntry, Mov, ScoringRule } from '@/types'

const MOV_COLOR = (mov: string) =>
  mov.startsWith('+') ? 'text-green' : mov.startsWith('-') ? 'text-red' : 'text-ink-4'

function useRanking() {
  const me = useAuthStore(s => s.user)
  const [ranking, setRanking] = useState<RankingEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetchRanking(me?.id).then(r => { setRanking(r); setLoading(false) })
  }, [me?.id])

  return { ranking, loading }
}

function useScoring() {
  const [rules, setRules] = useState<ScoringRule[]>([])
  useEffect(() => {
    fetchScoringRules().then(res => setRules(res.data ?? []))
  }, [])
  return rules
}

function useBreakdown(userId?: string) {
  const [items, setItems] = useState<RankingBreakdown[]>([])
  useEffect(() => {
    if (!userId) {
      setItems([])
      return
    }
    fetchRankingBreakdown(userId).then(res => setItems(res.data ?? []))
  }, [userId])
  return items
}

export function RankingScreen() {
  const isDesktop = useIsDesktop()
  return isDesktop ? <RankingDesktop /> : <RankingMobile />
}

// ─── Row component ─────────────────────────────────────────────────────────────

function RankingRow({ r, large = false }: { r: RankingEntry; large?: boolean }) {
  const navigate = useNavigate()
  return (
    <div
      onClick={() => navigate(`/u/${r.userId}`)}
      className={cn(
        'flex items-center gap-3 border-b border-hairline cursor-pointer transition-colors',
        r.isYou ? 'bg-yellow text-[#0D0D0D] hover:bg-yellow/90' : 'hover:bg-surface-hover',
        large ? 'px-5 py-3.5' : 'px-4 py-2.5'
      )}
    >
      <span className={cn('font-display flex-shrink-0', large ? 'text-3xl w-9' : 'text-2xl w-7')}>
        {r.rank}º
      </span>
      <Avatar initials={r.initials} color={r.color} src={r.avatarUrl} size={large ? 36 : 28} />
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
        <FloatingTooltip label="Resultados certos: acertou ao menos o vencedor ou empate">
          <span className="cursor-default">{r.correct}</span>
        </FloatingTooltip>
        <FloatingTooltip label="Placares exatos: acertou o placar perfeito — vale +10pts (grupos) ou +12pts (mata-mata)">
          <span className="text-green cursor-default">{r.exact}</span>
        </FloatingTooltip>
        <FloatingTooltip label="Sequência de acertos consecutivos">
          <span className="cursor-default">{r.streak}</span>
        </FloatingTooltip>
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

const SCORING_SECTIONS = [
  {
    label: 'FASE DE GRUPOS',
    rules: [
      { pts: 10, label: 'Placar exato',                  tip: 'Acertou o placar perfeito. ex: você palpitou 2×1 e o resultado foi 2×1.' },
      { pts: 7,  label: 'Resultado + gols do vencedor',  tip: 'Acertou o resultado E os gols do time vencedor. ex: palpitou 3×0, real foi 3×1.' },
      { pts: 5,  label: 'Resultado correto (V/E/D)',      tip: 'Acertou apenas quem ganhou ou que empatou. ex: palpitou 2×1, real foi 1×0.' },
      { pts: 1,  label: 'Gols de uma equipe acertados',  tip: 'Acertou os gols de pelo menos um time. ex: palpitou 1×1, real foi 2×1 (acertou os gols do time visitante).' },
    ],
  },
  {
    label: 'MATA-MATA',
    rules: [
      { pts: 12, label: 'Placar exato (tempo regulamentar)', tip: 'Placar perfeito nos 90 minutos. Prorrogação e pênaltis não contam para este critério.' },
      { pts: 8,  label: 'Resultado + gols de um time',       tip: 'Acertou o resultado E os gols de ao menos um time no tempo regulamentar.' },
      { pts: 5,  label: 'Resultado correto',                  tip: 'Acertou quem venceu no tempo regulamentar (sem contar prorr./pênaltis).' },
      { pts: 2,  label: 'Classificado (incl. prorr./pênaltis)', tip: 'Acertou quem avança de fase — vale o resultado final, incluindo prorrogação e pênaltis.' },
    ],
  },
  {
    label: 'APOSTAS ESPECIAIS',
    rules: [
      { pts: 25, label: 'Campeão',      tip: 'Acertou o campeão do mundo. Vale antes do início do torneio.' },
      { pts: 15, label: 'Vice-campeão', tip: 'Acertou o vice-campeão. Campeão e vice não podem ser do mesmo grupo.' },
      { pts: 10, label: 'Artilheiro (+ critério de desempate)', tip: 'Acertou o artilheiro da Copa. Em caso de empate nos gols, vale quem escolheu o jogador com mais gols.' },
    ],
  },
]

function ScoringRulesBox({ rules: _rules }: { rules: ScoringRule[] }) {
  return (
    <div className="ui-card p-4">
      <p className="font-mono text-[10px] tracking-eyebrow text-ink-3 mb-3">COMO PONTUAR</p>
      <div className="space-y-4">
        {SCORING_SECTIONS.map(section => (
          <div key={section.label}>
            <p className="font-mono text-[8px] tracking-eyebrow text-ink-4 mb-1.5">{section.label}</p>
            <div className="space-y-1.5">
              {section.rules.map(r => (
                <div key={r.label} className="flex items-center gap-2">
                  <span className="font-display text-xl text-green w-8 flex-shrink-0">+{r.pts}</span>
                  <FloatingTooltip label={r.tip}>
                    <span className="font-mono text-[11px] text-ink-3 cursor-default underline decoration-dotted decoration-ink-4 underline-offset-2">
                      {r.label}
                    </span>
                  </FloatingTooltip>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function BreakdownBox({ items }: { items: RankingBreakdown[] }) {
  return (
    <div className="ui-card p-4">
      <p className="font-mono text-[10px] tracking-eyebrow text-ink-3 mb-3">COMO SUA PONTUACAO FOI CALCULADA</p>
      {items.length === 0 ? (
        <p className="font-mono text-[11px] text-ink-3 leading-relaxed">
          Ainda nao ha pontos apurados para detalhar. Quando um resultado for registrado, cada origem de ponto aparece aqui.
        </p>
      ) : (
        <div className="space-y-2 max-h-64 overflow-auto">
          {items.slice(0, 12).map(item => (
            <div key={item.id} className="flex items-start justify-between gap-3 border-b border-hairline pb-2">
              <div>
                <div className="font-mono text-[10px] font-bold">{item.label}</div>
                <div className="font-mono text-[8px] text-ink-4">{item.sourceType} · {item.sourceId}</div>
              </div>
              <span className="font-display text-xl text-green">+{item.points}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Mobile ───────────────────────────────────────────────────────────────────

function RankingMobile() {
  const [tab, setTab] = useState<'geral' | 'squad' | 'semana'>('geral')
  const me = useAuthStore(s => s.user)
  const { ranking: fullRanking, loading } = useRanking()
  const rules = useScoring()
  const myEntry = fullRanking.find(r => r.isYou)

  const ranking = tab === 'squad' && me
    ? fullRanking.filter(r => r.dept === me.dept)
    : fullRanking

  const top3 = fullRanking.slice(0, 3)

  if (loading) return (
    <div className="min-h-dvh bg-paper flex items-center justify-center">
      <span className="font-mono text-[11px] tracking-eyebrow text-ink-3 animate-pulse">CARREGANDO…</span>
    </div>
  )

  return (
    <div className="min-h-dvh bg-paper pb-24">
      <div className="bg-surface-2 px-4 pt-6 pb-4">
        <div className="border-b border-hairline pb-4 mb-4">
          <div className="font-display text-5xl leading-none text-ink">RANKING</div>
          <div className="flex items-baseline gap-3">
            <span className="font-serif-it text-3xl text-green-deep leading-none">geral,</span>
            <span className="font-mono text-[10px] tracking-eyebrow text-ink-3 self-end mb-1">do bolão.</span>
          </div>
        </div>

        {top3.length >= 3 ? (
          <div className="flex items-end justify-center gap-2">
            {[top3[1], top3[0], top3[2]].map((r, i) => {
              const heights = [90, 124, 80]
              const ranks = [2, 1, 3]
              return (
                <div key={r.userId} className="flex flex-col items-center gap-2 flex-1 max-w-[100px]">
                  <Avatar initials={r.initials} color={r.color} src={r.avatarUrl} size={ranks[i] === 1 ? 44 : 36} />
                  <div className="font-mono text-[10px] font-bold text-center truncate px-1">
                    {r.name.split(' ')[0]}
                  </div>
                  <div
                    className={cn('w-full flex items-start justify-center pt-3 border-2 border-line-strong',
                      ranks[i] === 1 ? 'bg-yellow text-[#0D0D0D]' : 'bg-card')}
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
            <div className="font-mono text-[10px] text-yellow">{myEntry.streak} streak</div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 border-b border-line">
        {(['geral', 'squad', 'semana'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('py-2.5 font-mono text-[10px] font-bold tracking-eyebrow uppercase transition-colors',
              tab === t ? 'bg-yellow text-[#0D0D0D]' : 'text-ink-3 hover:bg-surface-hover')}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'geral' && ranking.length === 0 && (
        <div className="mx-4 mt-4">
          <ScoringRulesBox rules={[]} />
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
  const navigate = useNavigate()
  const meUser = useAuthStore(s => s.user)
  const { ranking, loading } = useRanking()
  const rules = useScoring()
  const top3 = ranking.slice(0, 3)
  const me = ranking.find(r => r.isYou) ?? (meUser ? {
    userId: meUser.id, name: `${meUser.firstName} ${meUser.lastName}`, dept: meUser.dept,
    initials: meUser.initials, color: meUser.color, pts: 0, correct: 0, exact: 0, streak: 0, mov: '—' as Mov, rank: 0, isYou: true
  } : undefined)
  const breakdown = useBreakdown(meUser?.id)

  if (loading) return (
    <div className="min-h-dvh bg-paper flex items-center justify-center">
      <span className="font-mono text-[11px] tracking-eyebrow text-ink-3 animate-pulse">CARREGANDO…</span>
    </div>
  )

  return (
    <div className="min-h-dvh bg-paper">
      <div className="max-w-screen-xl mx-auto px-6 py-8">
        <div className="border-b border-hairline pb-5 mb-6">
          <div className="font-display text-5xl md:text-7xl leading-none text-ink">RANKING</div>
          <div className="flex items-baseline gap-3">
            <span className="font-serif-it text-3xl md:text-5xl text-green-deep leading-none">geral,</span>
            <span className="font-mono text-[10px] tracking-eyebrow text-ink-3 self-end mb-1">do bolão.</span>
          </div>
        </div>

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
                      <Avatar initials={r.initials} color={r.color} src={r.avatarUrl} size={ranks[i] === 1 ? 52 : 40} />
                      <div className="font-mono text-[11px] font-bold text-center">{r.name}</div>
                      <div className="font-mono text-[10px] text-ink-3">{r.dept}</div>
                      <div
                        className={cn('w-full flex items-start justify-center pt-4 border-2 border-line-strong',
                          ranks[i] === 1 ? 'bg-yellow text-[#0D0D0D]' : 'bg-card')}
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
            <div className="ui-panel">
              <div className="grid grid-cols-[40px_1fr_100px_48px_48px_48px_80px] gap-2 px-5 py-2 border-b border-hairline font-mono text-[9px] tracking-eyebrow text-ink-4">
                <span>#</span><span>JOGADOR</span><span>DEPT</span>
                <span className="text-center">CERT</span>
                <span className="text-center">EXAT</span>
                <span className="text-center">STK</span>
                <span className="text-right">PTS</span>
              </div>
              {ranking.length > 0 ? ranking.map(r => (
                <div key={r.userId} onClick={() => navigate(`/u/${r.userId}`)} className={cn(
                  'grid grid-cols-[40px_1fr_100px_48px_48px_48px_80px] gap-2 items-center px-5 py-2.5 border-b border-hairline cursor-pointer transition-colors',
                  r.isYou ? 'bg-yellow text-[#0D0D0D] hover:bg-yellow/90' : 'hover:bg-surface-hover'
                )}>
                  <span className="font-display text-2xl">{r.rank}</span>
                  <div className="flex items-center gap-2 min-w-0">
                    <Avatar initials={r.initials} color={r.color} src={r.avatarUrl} size={28} />
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
                    <div className="font-display text-2xl">{me.streak}</div>
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
            <ScoringRulesBox rules={rules} />
          </div>
        </div>
      </div>
    </div>
  )
}
