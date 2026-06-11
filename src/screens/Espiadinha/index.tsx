import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Flag } from '@/components/shared/Flag'
import { Avatar } from '@/components/shared/Avatar'
import { useAuthStore } from '@/stores/auth.store'
import { useMatchStore } from '@/stores/match.store'
import { useMatchesWithStatus } from '@/hooks/useMatchWithStatus'
import { supabase, isMockMode } from '@/lib/supabase'
import { WC2026_MATCHES } from '@/data/wc2026'
import { isMatchClosed } from '@/lib/markets'
import { isPlaceholderMatch } from '@/lib/matchGuards'
import { formatMatchDate, formatMatchTime } from '@/lib/matchTime'
import { cn } from '@/lib/utils'
import {
  buildEspiadinha,
  ESPIA_TIERS,
  type EspiaView,
  type EspiaMatch,
  type EspiaStanding,
  type EspiaTier,
  type EspiaProfile,
  type EspiaPredRow,
} from '@/lib/espiadinha'

// ─── helpers ──────────────────────────────────────────────────────────────────

const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

type ProfileRow = {
  id: string
  first_name: string | null
  last_name: string | null
  dept: string | null
  initials: string | null
  color: string | null
  avatar_url: string | null
  participant_status: string | null
  privacy_hide_profile: boolean | null
}

type PredRow = {
  user_id: string
  match_code: string
  home_score: number
  away_score: number
  points_earned: number | null
}

// ─── data hook (real, em tempo real) ────────────────────────────────────────────

function useEspiadinhaData(): { view: EspiaView; loading: boolean } {
  const matches = useMatchesWithStatus(WC2026_MATCHES)
  const matchStoreLoaded = useMatchStore(s => s.isLoaded)
  const [predictions, setPredictions] = useState<EspiaPredRow[]>([])
  const [profiles, setProfiles] = useState<EspiaProfile[]>([])
  const [predLoading, setPredLoading] = useState(true)
  const [loadedOnce, setLoadedOnce] = useState(false)

  // Só consideramos jogos revelados depois que o status do banco carregou —
  // evita revelar (e depois "desrevelar") partidas com dados estáticos parciais.
  const revealedCodes = useMemo(
    () => matchStoreLoaded
      ? matches.filter(m => !isPlaceholderMatch(m) && isMatchClosed(m)).map(m => m.id)
      : [],
    [matches, matchStoreLoaded],
  )
  const codesKey = useMemo(() => revealedCodes.slice().sort().join(','), [revealedCodes])

  // Perfis dos participantes (uma vez).
  useEffect(() => {
    if (isMockMode) return
    let active = true
    void (async () => {
      const { data } = await supabase
        .from('public_profiles')
        .select('id, first_name, last_name, dept, initials, color, avatar_url, participant_status, privacy_hide_profile')
        .neq('participant_status', 'removed')
      if (!active) return
      const list = ((data ?? []) as ProfileRow[])
        .filter(r => r.participant_status === 'active')
        .filter(r => !r.privacy_hide_profile)
        .map<EspiaProfile>(r => ({
          id: r.id,
          name: `${r.first_name ?? ''} ${r.last_name ?? ''}`.trim() || 'Participante',
          firstName: (r.first_name ?? '').trim() || 'Participante',
          initials: r.initials ?? '?',
          color: r.color ?? '#777',
          avatarUrl: r.avatar_url ?? undefined,
          dept: r.dept ?? '',
        }))
      setProfiles(list)
    })()
    return () => { active = false }
  }, [])

  // Palpites — SOMENTE dos jogos já revelados (anti-cola no próprio fetch).
  const loadPredictions = useCallback(() => {
    let active = true
    void (async () => {
      if (isMockMode || revealedCodes.length === 0) {
        setPredictions([])
        setPredLoading(false)
        return
      }
      setPredLoading(true)
      const { data } = await supabase
        .from('predictions')
        .select('user_id, match_code, home_score, away_score, points_earned')
        .in('match_code', revealedCodes)
      if (!active) return
      setPredictions(((data ?? []) as PredRow[]).map(r => ({
        userId: r.user_id,
        matchId: r.match_code,
        homeScore: r.home_score,
        awayScore: r.away_score,
        points: r.points_earned ?? null,
      })))
      setPredLoading(false)
    })()
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codesKey])

  useEffect(() => loadPredictions(), [loadPredictions])

  // Tempo real: novos palpites/apurações disparam recarga (debounce). Os placares
  // e mudanças de status chegam pelo match.store (useMatchesWithStatus).
  useEffect(() => {
    if (isMockMode) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const channel = supabase
      .channel(`espiadinha-${Date.now()}-${Math.random().toString(16).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'predictions' }, () => {
        clearTimeout(timer)
        timer = setTimeout(() => loadPredictions(), 300)
      })
      .subscribe()
    return () => {
      clearTimeout(timer)
      void supabase.removeChannel(channel)
    }
  }, [loadPredictions])

  // Marca "já carregou ao menos uma vez" — daí o spinner inicial não volta a
  // cada atualização em tempo real (a tela atualiza no lugar, sem piscar).
  useEffect(() => {
    if (matchStoreLoaded && !predLoading) setLoadedOnce(true)
  }, [matchStoreLoaded, predLoading])

  const view = useMemo(
    () => buildEspiadinha(matches, predictions, profiles),
    [matches, predictions, profiles],
  )

  return { view, loading: (!matchStoreLoaded || predLoading) && !loadedOnce }
}

// ─── peças visuais ──────────────────────────────────────────────────────────────

function TierBadge({ tier, small = false }: { tier: EspiaTier; small?: boolean }) {
  return (
    <span className={cn(
      'inline-flex items-center rounded-full border font-mono font-bold tracking-eyebrow uppercase whitespace-nowrap',
      small ? 'text-[7.5px] px-1.5 py-0.5' : 'text-[9px] px-2 py-0.5',
      tier.badgeClass,
    )}>
      {tier.label}
    </span>
  )
}

function HitChip({ kind, label }: { kind: string; label: string }) {
  return (
    <span className={cn(
      'inline-flex items-center justify-center rounded-md font-mono text-[9px] font-bold tracking-eyebrow uppercase px-1.5 py-0.5 min-w-[44px]',
      kind === 'exact'   && 'bg-green text-white',
      kind === 'partial' && 'border border-hairline text-ink-2 bg-surface-2',
      kind === 'miss'    && 'text-ink-4',
      kind === 'pending' && 'text-ink-3 border border-dashed border-hairline',
    )}>
      {label}
    </span>
  )
}

function StatusBadge({ em }: { em: EspiaMatch }) {
  const { match } = em
  if (match.status === 'live') {
    return (
      <span className="inline-flex items-center gap-1.5 font-mono text-[9px] font-bold tracking-eyebrow text-red">
        <span className="h-1.5 w-1.5 rounded-full bg-red animate-pulse" />
        AO VIVO{match.liveMinute ? ` · ${match.liveMinute}` : ''}
      </span>
    )
  }
  if (em.settled) {
    return <span className="font-mono text-[9px] font-bold tracking-eyebrow text-ink-3">ENCERRADO</span>
  }
  return <span className="font-mono text-[9px] font-bold tracking-eyebrow text-ink-3">EM ANDAMENTO</span>
}

function MatchCard({ em, meId, query }: { em: EspiaMatch; meId?: string; query: string }) {
  const navigate = useNavigate()
  const { match } = em
  const guesses = query
    ? em.guesses.filter(g => norm(g.user.name).includes(norm(query)))
    : em.guesses
  if (query && guesses.length === 0) return null

  return (
    <div className="ui-card overflow-hidden">
      {/* cabeçalho */}
      <div className="flex items-center justify-between gap-2 border-b border-hairline px-4 py-2.5 bg-surface-2">
        <span className="font-mono text-[9px] tracking-eyebrow text-ink-3 truncate">{match.stageLabel}</span>
        <StatusBadge em={em} />
      </div>

      {/* placar */}
      <div className="flex items-center justify-center gap-3 px-4 py-4">
        <div className="flex items-center gap-2 flex-1 justify-end min-w-0">
          <span className="font-display text-2xl leading-none text-ink truncate">{match.home.code}</span>
          <Flag team={match.home} size={26} />
        </div>
        <div className="flex flex-col items-center">
          <div className="font-display text-3xl leading-none text-ink tabular-nums">
            {match.homeScore ?? 0}<span className="text-ink-4 px-1">×</span>{match.awayScore ?? 0}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Flag team={match.away} size={26} />
          <span className="font-display text-2xl leading-none text-ink truncate">{match.away.code}</span>
        </div>
      </div>
      <div className="px-4 pb-2 text-center font-mono text-[9px] text-ink-4">
        {formatMatchDate(match)} · {formatMatchTime(match)} · {match.venue}
      </div>

      {/* palpites */}
      <div className="border-t border-hairline divide-y divide-hairline max-h-[420px] overflow-y-auto">
        {guesses.map(g => {
          const isMe = g.user.id === meId
          return (
            <div
              key={g.user.id}
              onClick={() => navigate(isMe ? '/profile' : `/u/${g.user.id}`)}
              className={cn(
                'flex items-center gap-2.5 px-4 py-2 transition-colors cursor-pointer hover:bg-surface-hover',
                isMe && 'bg-yellow/15',
              )}
            >
              <Avatar initials={g.user.initials} color={g.user.color} src={g.user.avatarUrl} size={26} />
              <div className="min-w-0 flex-1">
                <div className="font-mono text-[11px] font-bold text-ink truncate">
                  {g.user.name}{isMe && <span className="text-ink-3 font-normal"> · você</span>}
                </div>
                {g.user.dept && <div className="font-mono text-[9px] text-ink-4 truncate">{g.user.dept}</div>}
              </div>
              <span className="font-display text-lg text-ink-2 tabular-nums">{g.homeScore}×{g.awayScore}</span>
              <HitChip kind={g.hit.kind} label={g.hit.label} />
            </div>
          )
        })}
        {guesses.length === 0 && (
          <div className="px-4 py-5 text-center font-mono text-[10px] text-ink-4">
            Ninguém palpitou neste jogo.
          </div>
        )}
      </div>

      <div className="border-t border-hairline px-4 py-2 font-mono text-[9px] text-ink-4">
        {em.guesses.length} {em.guesses.length === 1 ? 'palpite' : 'palpites'}
        {em.settled ? ' · apurado' : ' · pontos saem na apuração'}
      </div>
    </div>
  )
}

function StandingRow({ s, rank, meId }: { s: EspiaStanding; rank: number; meId?: string }) {
  const navigate = useNavigate()
  const isMe = s.user.id === meId
  return (
    <div
      onClick={() => navigate(isMe ? '/profile' : `/u/${s.user.id}`)}
      className={cn(
        'flex items-center gap-2.5 px-3 py-2.5 border-b border-hairline transition-colors cursor-pointer hover:bg-surface-hover',
        isMe && 'bg-yellow/15',
      )}
    >
      <span className="font-display text-lg w-6 text-center text-ink-3 flex-shrink-0">{rank}</span>
      <Avatar initials={s.user.initials} color={s.user.color} src={s.user.avatarUrl} size={30} />
      <div className="min-w-0 flex-1">
        <div className="font-mono text-[11px] font-bold text-ink truncate">{s.user.firstName}</div>
        <div className="mt-0.5"><TierBadge tier={s.tier} small /></div>
      </div>
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        <span className="font-display text-base text-ink leading-none">{s.points} <span className="font-mono text-[8px] text-ink-4">pts</span></span>
        <div className="flex items-center gap-1.5">
          <div className="h-1 w-12 rounded-full bg-hairline overflow-hidden">
            <div className={cn('h-full rounded-full', s.tier.barClass)} style={{ width: `${Math.round(s.accuracy * 100)}%` }} />
          </div>
          <span className="font-mono text-[8px] text-ink-4 w-7 text-right">{Math.round(s.accuracy * 100)}%</span>
        </div>
      </div>
    </div>
  )
}

function ClassesLegend() {
  return (
    <div className="ui-card p-4">
      <p className="font-mono text-[10px] tracking-eyebrow text-ink-3 mb-3">AS CLASSES</p>
      <div className="space-y-3">
        {ESPIA_TIERS.map(tier => (
          <div key={tier.id} className="border-b border-hairline last:border-b-0 pb-2.5 last:pb-0">
            <TierBadge tier={tier} />
            <div className="font-mono text-[10px] text-ink-2 mt-1.5 leading-snug">
              {tier.tagline} <span className="text-ink-4">· {Math.round(tier.min * 100)}%+</span>
            </div>
          </div>
        ))}
      </div>
      <p className="font-mono text-[9px] text-ink-4 mt-3 leading-relaxed">
        Acurácia = pontos que você fez ÷ pontos possíveis nos jogos já apurados.
      </p>
    </div>
  )
}

// ─── tela ─────────────────────────────────────────────────────────────────────

function EspiaHeader() {
  return (
    <div className="border-b border-hairline pb-5 mb-5">
      <div className="font-mono text-[10px] tracking-eyebrow text-ink-3">SÓ JOGO QUE JÁ ROLOU · SEM COLA</div>
      <div className="font-display text-6xl md:text-8xl leading-none text-ink">ESPIADINHA</div>
      <div className="flex items-baseline gap-3">
        <span className="font-serif-it text-3xl md:text-5xl text-green-deep leading-none">dos palpites,</span>
        <span className="font-mono text-[10px] tracking-eyebrow text-ink-3 self-end mb-1">olho no alheio.</span>
      </div>
    </div>
  )
}

function StandingsCard({ standings, meId }: { standings: EspiaStanding[]; meId?: string }) {
  return (
    <div className="ui-card overflow-hidden">
      <div className="px-4 py-3 border-b border-hairline bg-ink text-paper">
        <div className="font-mono text-[10px] tracking-eyebrow text-paper/50">RANKING DA ESPIADINHA</div>
        <div className="font-display text-2xl leading-none">QUEM ESTÁ CRAVANDO</div>
      </div>
      {standings.length > 0 ? (
        <div className="max-h-[60vh] overflow-y-auto">
          {standings.map((s, i) => (
            <StandingRow key={s.user.id} s={s} rank={i + 1} meId={meId} />
          ))}
        </div>
      ) : (
        <div className="px-4 py-6 text-center font-mono text-[10px] text-ink-3">
          As classes aparecem quando os primeiros jogos forem apurados.
        </div>
      )}
    </div>
  )
}

export function EspiadinhaScreen() {
  const me = useAuthStore(s => s.user)
  const { view, loading } = useEspiadinhaData()

  const [phase, setPhase] = useState<'all' | 'group' | 'ko'>('all')
  const [query, setQuery] = useState('')

  const filteredMatches = useMemo(() => view.matches.filter(em =>
    phase === 'all' ? true : phase === 'group' ? em.match.stage === 'group' : em.match.stage !== 'group',
  ), [view.matches, phase])

  const standings = useMemo(() => {
    if (!query) return view.standings
    return view.standings.filter(s => norm(s.user.name).includes(norm(query)))
  }, [view.standings, query])

  const hasAny = view.matches.length > 0

  return (
    <div className="min-h-dvh bg-paper pb-24 lg:pb-10">
      <div className="app-shell py-7 lg:py-9">
        <EspiaHeader />

        {loading ? (
          <div className="ui-card p-12 text-center">
            <div className="font-mono text-[11px] tracking-eyebrow text-ink-3 animate-pulse">
              CARREGANDO A ESPIADINHA…
            </div>
          </div>
        ) : !hasAny ? (
          <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
            <div className="order-2 lg:order-1">
              <div className="ui-card p-10 text-center">
                <div className="font-display text-5xl md:text-6xl text-ink-4 mb-3">EM BREVE</div>
                <p className="font-mono text-[12px] text-ink-3 max-w-[380px] mx-auto leading-relaxed">
                  Ainda não rolou nenhum jogo. Assim que a bola rolar, os palpites de quem já jogou
                  aparecem aqui — em tempo real e sem cola.
                </p>
              </div>
            </div>
            <aside className="order-1 lg:order-2 space-y-4">
              <StandingsCard standings={[]} meId={me?.id} />
              <ClassesLegend />
            </aside>
          </div>
        ) : (
          <>
            {/* controles */}
            <div className="mb-5 flex flex-wrap items-center gap-3">
              <div className="flex border border-line">
                {([['all', 'TODAS'], ['group', 'GRUPOS'], ['ko', 'MATA-MATA']] as const).map(([id, label]) => (
                  <button
                    key={id}
                    onClick={() => setPhase(id)}
                    className={cn(
                      'px-3 py-1.5 font-mono text-[10px] font-bold tracking-eyebrow uppercase transition-colors',
                      phase === id ? 'bg-yellow text-[#0D0D0D]' : 'text-ink-3 hover:bg-surface-hover',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 border border-line bg-card px-3 py-1.5 flex-1 min-w-[180px]">
                <span className="font-mono text-[13px] text-ink-4">⌕</span>
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Buscar palpiteiro…"
                  className="flex-1 bg-transparent font-sans text-[13px] text-ink outline-none placeholder:text-ink-4"
                />
                {query && (
                  <button type="button" onClick={() => setQuery('')} className="font-mono text-[11px] text-ink-4 hover:text-ink">✕</button>
                )}
              </div>
            </div>

            {/* corpo */}
            <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
              {/* espiada por jogo */}
              <div className="order-2 lg:order-1 space-y-4">
                {filteredMatches.length > 0 ? (
                  filteredMatches.map(em => <MatchCard key={em.match.id} em={em} meId={me?.id} query={query} />)
                ) : (
                  <div className="ui-card p-8 text-center">
                    <div className="font-display text-3xl text-ink-4 mb-2">—</div>
                    <p className="font-mono text-[11px] text-ink-3 max-w-[320px] mx-auto leading-relaxed">
                      {query
                        ? 'Nenhum palpiteiro encontrado nessa fase.'
                        : 'Nenhum jogo revelado nessa fase ainda. Assim que um jogo começar, os palpites aparecem aqui.'}
                    </p>
                  </div>
                )}
              </div>

              {/* classes */}
              <aside className="order-1 lg:order-2 space-y-4">
                <StandingsCard standings={standings} meId={me?.id} />
                <ClassesLegend />
              </aside>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
