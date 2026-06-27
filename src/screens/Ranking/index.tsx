import { useState, useEffect, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { Avatar } from '@/components/shared/Avatar'
import { Flag } from '@/components/shared/Flag'
import { FloatingTooltip } from '@/components/shared/FloatingTooltip'
import { useIsDesktop } from '@/hooks/useBreakpoint'
import { useTabResync } from '@/hooks/useTabResync'
import { useMatchesWithStatus } from '@/hooks/useMatchWithStatus'
import { useAuthStore } from '@/stores/auth.store'
import { fmtPts, cn } from '@/lib/utils'
import { fetchRanking, subscribeRankingUpdates } from '@/lib/ranking'
import { supabase, isMockMode } from '@/lib/supabase'
import { WC2026_MATCHES } from '@/data/wc2026'
import { fetchRankingBreakdown, fetchScoringRules } from '@/services/product'
import type { RankingBreakdown, RankingEntry, Mov, ScoringRule } from '@/types'

const MOV_COLOR = (mov: string) =>
  mov.startsWith('+') ? 'text-green' : mov.startsWith('-') ? 'text-red' : 'text-ink-4'

let rankingCache: RankingEntry[] = []
const RANKING_TIMEOUT_MS = 8000

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      window.setTimeout(() => reject(new Error(`${label} demorou demais para responder.`)), ms)
    }),
  ])
}

function useRanking() {
  const me = useAuthStore(s => s.user)
  const [ranking, setRanking] = useState<RankingEntry[]>(rankingCache)
  const [loading, setLoading] = useState(rankingCache.length === 0)
  const [error, setError] = useState<string | null>(null)

  const loadRanking = useCallback(() => {
    let active = true
    setLoading(rankingCache.length === 0)
    setError(null)

    withTimeout(fetchRanking(me?.id), RANKING_TIMEOUT_MS, 'Ranking')
      .then(r => {
        if (!active) return
        rankingCache = r
        setRanking(r)
      })
      .catch(err => {
        if (!active) return
        setError(err instanceof Error ? err.message : 'Erro ao carregar ranking.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => { active = false }
  }, [me?.id])

  useEffect(() => loadRanking(), [loadRanking])
  useTabResync(loadRanking)

  useEffect(() => {
    let timer: number | undefined
    const unsubscribe = subscribeRankingUpdates(() => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        loadRanking()
      }, 250)
    })

    return () => {
      window.clearTimeout(timer)
      unsubscribe()
    }
  }, [loadRanking])

  return { ranking, loading, error }
}

function useScoring() {
  const [rules, setRules] = useState<ScoringRule[]>([])
  useEffect(() => {
    let active = true
    fetchScoringRules()
      .then(res => { if (active) setRules(res.data ?? []) })
      .catch(() => { if (active) setRules([]) })
    return () => { active = false }
  }, [])
  return rules
}

function useBreakdown(userId?: string) {
  const [items, setItems] = useState<RankingBreakdown[]>([])

  const loadBreakdown = useCallback(() => {
    if (!userId) {
      setItems([])
      return () => {}
    }
    let active = true
    fetchRankingBreakdown(userId)
      .then(res => { if (active) setItems(res.data ?? []) })
      .catch(() => { if (active) setItems([]) })
    return () => { active = false }
  }, [userId])

  useEffect(() => loadBreakdown(), [loadBreakdown])
  useTabResync(loadBreakdown)

  useEffect(() => {
    if (!userId || isMockMode) return undefined

    let timer: number | undefined
    const channel = supabase
      .channel(`ranking-breakdown-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ranking_breakdowns', filter: `user_id=eq.${userId}` },
        () => {
          window.clearTimeout(timer)
          timer = window.setTimeout(() => {
            loadBreakdown()
          }, 250)
        },
      )
      .subscribe()

    return () => {
      window.clearTimeout(timer)
      void supabase.removeChannel(channel)
    }
  }, [loadBreakdown, userId])

  return items
}

export function RankingScreen() {
  const isDesktop = useIsDesktop()
  return isDesktop ? <RankingDesktop /> : <RankingMobile />
}

// ─── Row component ─────────────────────────────────────────────────────────────

function RankingRow({ r, large = false, onPeek }: { r: RankingEntry; large?: boolean; onPeek?: (r: RankingEntry) => void }) {
  const navigate = useNavigate()
  return (
    <div
      onClick={() => (onPeek ? onPeek(r) : navigate(`/u/${r.userId}`))}
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

// ─── Espiada rápida: palpites finalizados de um palpiteiro ─────────────────────

function PlayerPeekModal({ entry, onClose }: { entry: RankingEntry; onClose: () => void }) {
  const navigate = useNavigate()
  const matches = useMatchesWithStatus(WC2026_MATCHES)
  const [preds, setPreds] = useState<Record<string, { h: number; a: number; pts: number | null }> | null>(null)

  useEffect(() => {
    if (isMockMode) { setPreds({}); return }
    let active = true
    void supabase
      .from('predictions')
      .select('match_code, home_score, away_score, points_earned')
      .eq('user_id', entry.userId)
      .then(({ data }) => {
        if (!active) return
        const map: Record<string, { h: number; a: number; pts: number | null }> = {}
        for (const r of (data ?? []) as { match_code: string | null; home_score: number; away_score: number; points_earned: number | null }[]) {
          if (r.match_code) map[r.match_code] = { h: r.home_score, a: r.away_score, pts: r.points_earned ?? null }
        }
        setPreds(map)
      })
    return () => { active = false }
  }, [entry.userId])

  const finished = useMemo(
    () => (preds
      ? matches
          .filter(m => m.status === 'finished' && preds[m.id])
          .sort((a, b) => new Date(b.kickoffUtc).getTime() - new Date(a.kickoffUtc).getTime())
      : []),
    [matches, preds],
  )

  return createPortal(
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/70 px-4 py-6 overflow-y-auto" onClick={(e) => { e.stopPropagation(); onClose() }}>
      <div className="relative w-full max-w-sm ui-card overflow-hidden" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} aria-label="Fechar"
          className="absolute top-3 right-3 z-10 grid h-7 w-7 place-items-center border border-hairline bg-card font-mono text-[11px] text-ink-3 hover:border-ink hover:text-ink">✕</button>

        <div className="bg-ink text-paper px-4 py-3 flex items-center gap-3">
          <Avatar initials={entry.initials} color={entry.color} src={entry.avatarUrl} size={42} />
          <div className="min-w-0 flex-1">
            <div className="font-display text-2xl leading-none truncate">{entry.name}</div>
            <div className="font-mono text-[10px] text-paper/60 mt-1">
              {entry.rank}º · {fmtPts(entry.pts)} pts · {entry.correct} acertos · {entry.exact} cravadas
            </div>
          </div>
        </div>

        <div className="max-h-[52vh] overflow-y-auto divide-y divide-hairline">
          {preds === null ? (
            <div className="px-4 py-10 text-center font-mono text-[11px] tracking-eyebrow text-ink-3 animate-pulse">CARREGANDO PALPITES…</div>
          ) : finished.length === 0 ? (
            <div className="px-4 py-10 text-center font-mono text-[11px] text-ink-3">Nenhum palpite em jogo encerrado ainda.</div>
          ) : finished.map(m => {
            const p = preds[m.id]
            const pts = p?.pts ?? 0
            return (
              <div key={m.id} className="flex items-center gap-2 px-4 py-2.5">
                <Flag team={m.home} size={18} />
                <span className="font-mono text-[11px] font-bold">{m.home.code}</span>
                <span className="font-mono text-[9px] text-ink-4">×</span>
                <span className="font-mono text-[11px] font-bold">{m.away.code}</span>
                <Flag team={m.away} size={18} />
                <div className="flex-1" />
                <span className="font-mono text-[8px] text-ink-4 whitespace-nowrap hidden sm:inline">{m.homeScore}–{m.awayScore} real</span>
                <span className="font-display text-base text-ink tabular-nums whitespace-nowrap flex-shrink-0">{p?.h}–{p?.a}</span>
                <span className={cn('font-mono text-[9px] font-bold rounded-md px-1.5 py-0.5 flex-shrink-0',
                  pts >= 10 ? 'bg-green text-white' : pts > 0 ? 'border border-hairline text-ink-2 bg-surface-2' : 'text-ink-4')}>
                  {pts > 0 ? `+${pts}` : '0'}
                </span>
              </div>
            )
          })}
        </div>

        <button
          onClick={() => { onClose(); navigate(`/u/${entry.userId}`) }}
          className="w-full border-t border-hairline py-3 font-mono text-[11px] font-bold tracking-eyebrow text-ink hover:bg-surface-hover"
        >
          ABRIR PERFIL COMPLETO →
        </button>
      </div>
    </div>,
    document.body,
  )
}

// ─── Busca de palpiteiro (filtro em tempo real na própria lista) ───────────────

const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

function InlineSearch({ query, setQuery }: { query: string; setQuery: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2 border border-line bg-card px-3 py-2">
      <span className="font-mono text-[13px] text-ink-4">⌕</span>
      <input
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Buscar palpiteiro…"
        className="flex-1 bg-transparent font-sans text-[13px] text-ink outline-none placeholder:text-ink-4"
      />
      {query && (
        <button type="button" onClick={() => setQuery('')}
          className="font-mono text-[11px] text-ink-4 hover:text-ink">✕</button>
      )}
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

function RankingLoading() {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center px-6">
      <span className="inline-block h-5 w-5 rounded-full border-2 border-ink-4 border-t-transparent animate-spin" />
      <span className="font-mono text-[11px] tracking-eyebrow text-ink-3 animate-pulse">CARREGANDO RANKING…</span>
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
    label: 'MATA-MATA · quem passa manda',
    rules: [
      { pts: 12, label: 'CRAVADA: placar exato + quem passa', tip: 'Acertou o placar certinho E quem se classifica. A cravada só conta com o classificado certo.' },
      { pts: 8,  label: 'Resultado + gols do vencedor + quem passa', tip: 'Acertou o resultado, os gols do time vencedor E quem avança.' },
      { pts: 5,  label: 'Resultado certo + quem passa',               tip: 'Acertou quem venceu E quem se classifica.' },
      { pts: 3,  label: 'Só acertou quem passa',                      tip: 'Errou o placar, mas cravou quem se classifica.' },
      { pts: 2,  label: 'Cravou o placar, mas errou quem passa',      tip: 'Consolação: acertou o placar, mas o outro time se classificou.' },
    ],
  },
  {
    label: 'APOSTAS ESPECIAIS',
    rules: [
      { pts: 25, label: 'Campeão',      tip: 'Acertou o campeão do mundo. Vale antes do início do torneio.' },
      { pts: 15, label: 'Vice-campeão', tip: 'Acertou o vice-campeão. Não pode ser a mesma seleção escolhida como campeã.' },
      { pts: 10, label: 'Artilheiro (+ critério de desempate)', tip: 'Acertou o artilheiro da Copa. Em caso de empate nos gols, vale quem escolheu o jogador com mais gols.' },
    ],
  },
]

function ScoringRulesBox({ rules: _rules }: { rules: ScoringRule[] }) {
  return (
    <div className="ui-card p-4">
      <p className="font-mono text-[10px] tracking-eyebrow text-ink-3 mb-1">COMO PONTUAR</p>
      <p className="font-mono text-[10px] text-ink-4 leading-snug mb-3">
        Em cada jogo vale só a faixa mais alta que você acertar — elas não somam entre si.
      </p>
      <div className="space-y-4">
        {SCORING_SECTIONS.map(section => (
          <div key={section.label}>
            <p className="font-mono text-[8px] tracking-eyebrow text-ink-4 mb-1.5">{section.label}</p>
            <div className="space-y-1.5">
              {section.rules.map(r => (
                <div key={r.label} className="flex items-baseline gap-2">
                  <span className="font-display text-xl text-green w-8 flex-shrink-0 text-right tabular-nums">{r.pts}</span>
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
  const { ranking: fullRanking, loading, error } = useRanking()
  const [query, setQuery] = useState('')
  const myEntry = fullRanking.find(r => r.isYou)
  const visible = useMemo(
    () => query ? fullRanking.filter(r => norm(r.name).includes(norm(query))) : fullRanking,
    [fullRanking, query],
  )
  const [peek, setPeek] = useState<RankingEntry | null>(null)

  const top3 = fullRanking.slice(0, 3)

  return (
    <div className="min-h-dvh bg-paper pb-24">
      <div className="bg-surface-2 px-4 pt-6 pb-4">
        <div className="border-b border-hairline pb-4 mb-4">
          <div className="font-display text-5xl leading-none text-ink">RANKING</div>
          <div className="flex items-baseline gap-3">
            <span className="font-serif-it text-3xl text-green-deep leading-none">geral,</span>
            <span className="font-mono text-[10px] tracking-eyebrow text-ink-3 self-end mb-1">do bolão.</span>
          </div>
          <div className="mt-3 border-l-2 border-yellow bg-yellow/5 px-3 py-1.5">
            <span className="font-mono text-[9px] text-ink-3 leading-snug">⏱ Os pontos podem levar um tempo pra apurar após o fim do jogo.</span>
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
        ) : loading && fullRanking.length === 0 ? (
          <RankingLoading />
        ) : (
          <EmptyRanking />
        )}
      </div>

      {myEntry && (
        <div className="bg-ink text-paper px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
          <Avatar initials={myEntry.initials} color={myEntry.color} src={myEntry.avatarUrl} size={32} />
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

      <div className="px-4 pt-3">
        <InlineSearch query={query} setQuery={setQuery} />
      </div>

      {(loading || error) && (
        <div className="border-b border-hairline bg-card px-4 py-2 font-mono text-[10px] text-ink-3">
          {loading ? 'Atualizando ranking…' : error}
        </div>
      )}

      {fullRanking.length === 0 && (
        <div className="mx-4 mt-4">
          <ScoringRulesBox rules={[]} />
        </div>
      )}

      {fullRanking.length === 0 ? (
        loading ? null : (
          <div className="flex flex-col items-center gap-2 py-10 text-center px-4">
            <p className="font-mono text-[11px] text-ink-3">Nenhum palpite pontuado ainda.</p>
          </div>
        )
      ) : visible.length > 0 ? (
        <div className="divide-y divide-hairline">
          {visible.map(r => <RankingRow key={r.userId} r={r} onPeek={setPeek} />)}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 py-10 text-center px-4">
          <p className="font-mono text-[11px] text-ink-3">Nenhum palpiteiro encontrado para "{query}".</p>
        </div>
      )}

      {peek && <PlayerPeekModal entry={peek} onClose={() => setPeek(null)} />}
    </div>
  )
}

// ─── Desktop ──────────────────────────────────────────────────────────────────

function RankingDesktop() {
  const meUser = useAuthStore(s => s.user)
  const { ranking, loading, error } = useRanking()
  const [query, setQuery] = useState('')
  const [peek, setPeek] = useState<RankingEntry | null>(null)
  const rules = useScoring()
  const top3 = ranking.slice(0, 3)
  const visible = useMemo(
    () => query ? ranking.filter(r => norm(r.name).includes(norm(query))) : ranking,
    [ranking, query],
  )
  const me = ranking.find(r => r.isYou) ?? (meUser ? {
    userId: meUser.id, name: `${meUser.firstName} ${meUser.lastName}`, dept: meUser.dept,
    initials: meUser.initials, color: meUser.color, pts: 0, correct: 0, exact: 0, streak: 0, mov: '—' as Mov, rank: 0, isYou: true
  } : undefined)
  const breakdown = useBreakdown(meUser?.id)

  return (
    <div className="min-h-dvh bg-paper">
      <div className="app-shell py-8">
        <div className="border-b border-hairline pb-5 mb-6">
          <div className="font-display text-5xl md:text-7xl leading-none text-ink">RANKING</div>
          <div className="flex items-baseline gap-3">
            <span className="font-serif-it text-3xl md:text-5xl text-green-deep leading-none">geral,</span>
            <span className="font-mono text-[10px] tracking-eyebrow text-ink-3 self-end mb-1">do bolão.</span>
          </div>
          <div className="mt-3 border-l-2 border-yellow bg-yellow/5 px-3 py-1.5 inline-block">
            <span className="font-mono text-[9px] text-ink-3 leading-snug">⏱ Os pontos podem levar um tempo pra apurar após o fim do jogo.</span>
          </div>
        </div>

        {(loading || error) && (
          <div className="mb-4 border border-hairline bg-card px-4 py-2 font-mono text-[10px] text-ink-3">
            {loading ? 'Atualizando ranking…' : error}
          </div>
        )}

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
            ) : loading && ranking.length === 0 ? (
              <div className="mb-6 border-b border-hairline pb-6">
                <RankingLoading />
              </div>
            ) : (
              <div className="mb-6 border-b border-hairline pb-6">
                <EmptyRanking />
              </div>
            )}

            {/* Full table */}
            <div className="mb-3">
              <InlineSearch query={query} setQuery={setQuery} />
            </div>
            <div className="ui-panel">
              <div className="grid grid-cols-[40px_1fr_100px_48px_48px_48px_80px] gap-2 px-5 py-2 border-b border-hairline font-mono text-[9px] tracking-eyebrow text-ink-4">
                <span>#</span><span>JOGADOR</span><span>DEPT</span>
                <span className="text-center">CERT</span>
                <span className="text-center">EXAT</span>
                <span className="text-center">STK</span>
                <span className="text-right">PTS</span>
              </div>
              {ranking.length > 0 ? (visible.length > 0 ? visible.map(r => (
                <div key={r.userId} onClick={() => setPeek(r)} className={cn(
                  'grid grid-cols-[40px_1fr_100px_48px_48px_48px_80px] gap-2 items-center px-5 py-2.5 border-b border-hairline cursor-pointer transition-colors',
                  r.isYou ? 'bg-yellow text-[#0D0D0D] hover:bg-yellow/90' : 'hover:bg-surface-hover'
                )}>
                  <span className="font-display text-2xl">{r.rank}º</span>
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
                  <p className="font-mono text-[11px] text-ink-3">Nenhum palpiteiro encontrado para "{query}".</p>
                </div>
              )) : loading ? null : (
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
            <BreakdownBox items={breakdown} />
            <ScoringRulesBox rules={rules} />
          </div>
        </div>
      </div>
      {peek && <PlayerPeekModal entry={peek} onClose={() => setPeek(null)} />}
    </div>
  )
}
