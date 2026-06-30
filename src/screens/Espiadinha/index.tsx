import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Flag } from '@/components/shared/Flag'
import { Avatar } from '@/components/shared/Avatar'
import { useAuthStore } from '@/stores/auth.store'
import { useMatchStore } from '@/stores/match.store'
import { useMatchesWithStatus } from '@/hooks/useMatchWithStatus'
import { useTabResync } from '@/hooks/useTabResync'
import { supabase, isMockMode } from '@/lib/supabase'
import { fetchRanking, subscribeRankingUpdates } from '@/lib/ranking'
import { WC2026_MATCHES } from '@/data/wc2026'
import { isMatchClosed } from '@/lib/markets'
import { isPlaceholderMatch } from '@/lib/matchGuards'
import { formatMatchDate, formatMatchTime } from '@/lib/matchTime'
import { cn } from '@/lib/utils'
import {
  buildGuesses,
  standingsFromRanking,
  ESPIA_TIERS,
  type EspiaStanding,
  type EspiaTier,
  type EspiaProfile,
  type EspiaPredRow,
} from '@/lib/espiadinha'
import { ShareCravadaButton } from '@/components/shared/ShareCravada'
import type { CravadaCardData } from '@/lib/shareCard'
import type { Match, RankingEntry } from '@/types'

type ShareCtx = Pick<CravadaCardData, 'userName' | 'userInitials' | 'userColor' | 'userAvatarUrl' | 'rank' | 'className'>

// ─── helpers ──────────────────────────────────────────────────────────────────

const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

// Filtros de fase — todas as fases da Copa (não só grupos/mata-mata).
const PHASE_FILTERS: Array<{ id: string; label: string; stages: string[] | null }> = [
  { id: 'all',   label: 'TODAS',      stages: null },
  { id: 'group', label: 'GRUPOS',     stages: ['group'] },
  { id: 'r32',   label: 'FASE DE 32', stages: ['round_of_32'] },
  { id: 'r16',   label: 'OITAVAS',    stages: ['round_of_16'] },
  { id: 'qf',    label: 'QUARTAS',    stages: ['quarter_final'] },
  { id: 'sf',    label: 'SEMIS',      stages: ['semi_final'] },
  { id: '3rd',   label: '3º LUGAR',   stages: ['third_place'] },
  { id: 'final', label: 'FINAL',      stages: ['final'] },
]

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

// match_code → slot do chaveamento (pra buscar o "quem passa" em bracket_picks).
function matchCodeToSlotId(code: string): string | null {
  if (/^ko-r32-\d+$/.test(code)) return code.replace('ko-r32-', 'r32_')
  if (/^ko-r16-\d+$/.test(code)) return code.replace('ko-r16-', 'r16_')
  if (/^ko-qf-\d+$/.test(code)) return code.replace('ko-qf-', 'qf_')
  if (/^ko-sf-\d+$/.test(code)) return code.replace('ko-sf-', 'sf_')
  if (code === 'ko-third-1') return 'third_1'
  if (code === 'ko-final-1') return 'final_1'
  return null
}

// ─── data hook ────────────────────────────────────────────────────────────────
// Carrega SÓ o esqueleto: jogos revelados + ranking (colocação). Os palpites de
// cada jogo são buscados sob demanda quando o jogo é aberto (ver MatchCard) — é o
// que evita buscar milhares de linhas de uma vez (e o teto de 1000 do PostgREST).

type RevealedMatch = { match: Match; settled: boolean }

function useEspiadinhaData(): {
  matches: RevealedMatch[]
  standings: EspiaStanding[]
  profiles: EspiaProfile[]
  loading: boolean
} {
  const me = useAuthStore(s => s.user)
  const matches = useMatchesWithStatus(WC2026_MATCHES)
  const matchStoreLoaded = useMatchStore(s => s.isLoaded)
  const [profiles, setProfiles] = useState<EspiaProfile[]>([])
  const [ranking, setRanking] = useState<RankingEntry[]>([])

  // Ranking OFICIAL — mesma fonte do Ranking geral, pra a colocação bater igual.
  const loadRanking = useCallback(() => {
    fetchRanking(me?.id).then(setRanking).catch(() => setRanking([]))
  }, [me?.id])

  useEffect(() => loadRanking(), [loadRanking])
  useTabResync(loadRanking)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const unsub = subscribeRankingUpdates(() => {
      clearTimeout(timer)
      timer = setTimeout(() => loadRanking(), 250)
    })
    return () => { clearTimeout(timer); unsub() }
  }, [loadRanking])

  // Perfis dos participantes (uma vez) — usados ao montar os palpites de um jogo.
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

  // Jogos revelados (anti-cola): só os já iniciados/encerrados, mais recentes 1º.
  const revealed = useMemo<RevealedMatch[]>(
    () => matchStoreLoaded
      ? matches
          .filter(m => !isPlaceholderMatch(m) && isMatchClosed(m))
          .sort((a, b) => new Date(b.kickoffUtc).getTime() - new Date(a.kickoffUtc).getTime())
          .map(m => ({ match: m, settled: m.status === 'finished' || !!m.settledAt }))
      : [],
    [matches, matchStoreLoaded],
  )

  const standings = useMemo(() => standingsFromRanking(ranking), [ranking])

  return { matches: revealed, standings, profiles, loading: !matchStoreLoaded }
}

// Busca paginada dos palpites de UM jogo (sob demanda). Um jogo tem ~200 palpites,
// bem abaixo do teto, mas paginamos por segurança caso cresça.
async function fetchMatchPredictions(matchCode: string): Promise<EspiaPredRow[]> {
  const PAGE = 1000
  const acc: EspiaPredRow[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('predictions')
      .select('user_id, match_code, home_score, away_score, points_earned')
      .eq('match_code', matchCode)
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error || !data) break
    const rows = data as unknown as PredRow[]
    for (const r of rows) {
      acc.push({
        userId: r.user_id,
        matchId: r.match_code,
        homeScore: r.home_score,
        awayScore: r.away_score,
        points: r.points_earned ?? null,
      })
    }
    if (rows.length < PAGE) break
  }
  return acc
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

function StatusBadge({ settled }: { settled: boolean }) {
  return settled
    ? <span className="font-mono text-[9px] font-bold tracking-eyebrow text-ink-3">ENCERRADO</span>
    : <span className="font-mono text-[9px] font-bold tracking-eyebrow text-red">EM ANDAMENTO</span>
}

function MatchCard({ match, settled, profiles, meId, query, myCtx }: {
  match: Match
  settled: boolean
  profiles: EspiaProfile[]
  meId?: string
  query: string
  myCtx?: ShareCtx
}) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [fHome, setFHome] = useState('')
  const [fAway, setFAway] = useState('')
  const [rawPreds, setRawPreds] = useState<EspiaPredRow[] | null>(null)
  const [picks, setPicks] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)

  const isKo = match.stage !== 'group'
  const slotId = isKo ? matchCodeToSlotId(match.id) : null
  // No mata-mata, o "quem passa" REAL: o vencedor oficial (inclui pênaltis); só
  // existe quando o jogo encerra e tem vencedor (≠ empate).
  const realAdvancer = settled && match.winner && match.winner !== 'draw' ? match.winner : null

  // Carrega ao abrir; recarrega se o resultado mudar (apuração) → reflete pontos.
  const resultKey = `${match.id}|${settled}|${match.homeScore ?? ''}|${match.awayScore ?? ''}|${match.winner ?? ''}`
  useEffect(() => {
    if (!open || isMockMode) return
    let active = true
    setLoading(true)
    void (async () => {
      const [preds] = await Promise.all([
        fetchMatchPredictions(match.id),
        // "quem passa" de cada um (mata-mata): busca os palpites de classificado do slot.
        slotId
          ? supabase.from('bracket_picks').select('user_id, picked_winner').eq('slot_id', slotId)
              .then(({ data }) => {
                if (!active) return
                const map: Record<string, string> = {}
                for (const r of (data ?? []) as Array<{ user_id: string; picked_winner: string }>) map[r.user_id] = r.picked_winner
                setPicks(map)
              })
          : Promise.resolve(),
      ])
      if (!active) return
      setRawPreds(preds)
      setLoading(false)
    })()
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, resultKey])

  // "Quem passa" efetivo de um palpite: o pick explícito do chaveamento OU, na
  // falta dele, o vencedor do placar cravado (placar decisivo já indica). Empate
  // sem pick = não definiu (null) — espelha a regra de pontuação.
  const advancerOf = (homeScore: number, awayScore: number, userId: string): string | null => {
    const explicit = picks[userId]
    if (explicit) return explicit
    if (homeScore > awayScore) return match.home.code
    if (homeScore < awayScore) return match.away.code
    return null
  }

  const allGuesses = useMemo(
    () => (rawPreds ? buildGuesses(match, rawPreds, profiles) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rawPreds, profiles, resultKey],
  )
  // Distribuição por placar (pra filtrar "quem palpitou 2×0"), mais usados primeiro.
  const scoreCounts = useMemo(() => {
    const m = new Map<string, number>()
    for (const g of allGuesses) {
      const k = `${g.homeScore}×${g.awayScore}`
      m.set(k, (m.get(k) ?? 0) + 1)
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [allGuesses])

  // Filtro de placar (campos manuais casa × visitante); ativa quando os dois têm valor.
  const scoreFilter = fHome !== '' && fAway !== '' ? `${fHome}×${fAway}` : null

  // Filtro por nome + por placar; meu palpite sempre no topo da lista.
  const guesses = useMemo(() => {
    let list = allGuesses
    if (query) list = list.filter(g => norm(g.user.name).includes(norm(query)))
    if (scoreFilter) list = list.filter(g => `${g.homeScore}×${g.awayScore}` === scoreFilter)
    return [...list].sort((a, b) => (b.user.id === meId ? 1 : 0) - (a.user.id === meId ? 1 : 0))
  }, [allGuesses, query, scoreFilter, meId])

  return (
    <div className="ui-card overflow-hidden">
      {/* cabeçalho clicável — abre/fecha os palpites do jogo */}
      <button type="button" onClick={() => setOpen(o => !o)} className="block w-full text-left transition-colors hover:bg-surface-hover">
        <div className="flex items-center justify-between gap-2 border-b border-hairline px-4 py-2.5 bg-surface-2">
          <span className="font-mono text-[9px] tracking-eyebrow text-ink-3 truncate">{match.stageLabel}</span>
          <StatusBadge settled={settled} />
        </div>

        {/* confronto (placar só quando encerrado) */}
        <div className="flex items-center justify-center gap-3 px-4 py-4">
          <div className="flex items-center gap-2 flex-1 justify-end min-w-0">
            <span className="font-display text-2xl leading-none text-ink truncate">{match.home.code}</span>
            <Flag team={match.home} size={26} />
          </div>
          <div className="flex flex-col items-center">
            {settled ? (
              <div className="font-display text-3xl leading-none text-ink tabular-nums">
                {match.homeScore ?? 0}<span className="text-ink-4 px-1">×</span>{match.awayScore ?? 0}
              </div>
            ) : (
              <span className="font-display text-2xl leading-none text-ink-4">×</span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Flag team={match.away} size={26} />
            <span className="font-display text-2xl leading-none text-ink truncate">{match.away.code}</span>
          </div>
        </div>
        {settled && isKo && realAdvancer && (
          <div className="px-4 pb-1 text-center font-mono text-[9px] font-bold tracking-eyebrow text-green-deep">
            {realAdvancer} PASSOU{match.homeScore === match.awayScore ? ' · NOS PÊNALTIS' : ''}
          </div>
        )}
        <div className="px-4 pb-2 text-center font-mono text-[9px] text-ink-4">
          {formatMatchDate(match)} · {formatMatchTime(match)} · {match.venue}
        </div>
        <div className="flex items-center justify-center gap-1.5 border-t border-hairline px-4 py-2 font-mono text-[10px] font-bold tracking-eyebrow text-green-deep">
          {open ? 'OCULTAR PALPITES' : 'VER PALPITES'}
          <span className={cn('inline-block transition-transform', open && 'rotate-180')}>▾</span>
        </div>
      </button>

      {/* palpites do jogo — carregados sob demanda */}
      {open && (
        <div className="border-t border-hairline">
          {loading && !rawPreds ? (
            <div className="px-4 py-6 text-center font-mono text-[10px] tracking-eyebrow text-ink-3 animate-pulse">
              CARREGANDO PALPITES…
            </div>
          ) : (
            <>
              {scoreCounts.length > 1 && (
                <div className="border-b border-hairline px-3 py-2.5 space-y-2">
                  {/* placar manual: digite qualquer resultado */}
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[9px] tracking-eyebrow text-ink-4 flex-shrink-0">FILTRAR PLACAR</span>
                    <input
                      value={fHome}
                      onChange={e => setFHome(e.target.value.replace(/\D/g, '').slice(0, 2))}
                      inputMode="numeric"
                      placeholder="–"
                      aria-label="gols casa"
                      className="w-9 text-center font-display text-lg leading-none border border-line bg-card py-1 outline-none focus:border-ink"
                    />
                    <span className="font-display text-lg text-ink-4">×</span>
                    <input
                      value={fAway}
                      onChange={e => setFAway(e.target.value.replace(/\D/g, '').slice(0, 2))}
                      inputMode="numeric"
                      placeholder="–"
                      aria-label="gols visitante"
                      className="w-9 text-center font-display text-lg leading-none border border-line bg-card py-1 outline-none focus:border-ink"
                    />
                    {scoreFilter && (
                      <button type="button" onClick={() => { setFHome(''); setFAway('') }}
                        className="ml-1 font-mono text-[9px] tracking-eyebrow text-ink-3 underline underline-offset-2 hover:text-ink">
                        LIMPAR
                      </button>
                    )}
                  </div>
                  {/* todos os placares palpitados (quebram em linhas, sem scroll lateral) */}
                  <div className="flex flex-wrap gap-2">
                    {scoreCounts.map(([score, n]) => {
                      const [h, a] = score.split('×')
                      const active = scoreFilter === score
                      return (
                        <button
                          key={score}
                          type="button"
                          onClick={() => { if (active) { setFHome(''); setFAway('') } else { setFHome(h); setFAway(a) } }}
                          className={cn('font-mono text-[12px] font-bold tabular-nums px-2.5 py-1.5 border transition-colors',
                            active ? 'bg-yellow text-[#0D0D0D] border-ink' : 'border-hairline text-ink-2 hover:bg-surface-hover')}
                        >
                          {score} <span className="text-ink-4 font-normal">· {n}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
              <div className="divide-y divide-hairline max-h-[60vh] overflow-y-auto">
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
                      <div className="flex flex-shrink-0 flex-col items-end gap-0.5">
                        <span className="font-display text-lg leading-none text-ink-2 tabular-nums">{g.homeScore}×{g.awayScore}</span>
                        {isKo && (() => {
                          const adv = advancerOf(g.homeScore, g.awayScore, g.user.id)
                          const ok = realAdvancer ? adv === realAdvancer : null
                          return (
                            <span className={cn('border px-1 py-px font-mono text-[8px] font-bold leading-none tracking-eyebrow',
                              adv == null ? 'border-hairline text-ink-4'
                              : ok === true ? 'border-green/50 bg-green/10 text-green'
                              : ok === false ? 'border-red/40 bg-red/5 text-red'
                              : 'border-line-strong text-ink-2')}>
                              passa ▸ {adv ?? '—'}
                            </span>
                          )
                        })()}
                      </div>
                      <HitChip kind={g.hit.kind} label={g.hit.label} />
                      {isMe && g.hit.kind === 'exact' && myCtx && (
                        <ShareCravadaButton data={{
                          home: { code: match.home.code, flag: match.home.flag, color: match.home.color },
                          away: { code: match.away.code, flag: match.away.flag, color: match.away.color },
                          homeScore: g.homeScore,
                          awayScore: g.awayScore,
                          points: g.hit.points ?? (match.stage === 'group' ? 10 : 12),
                          stageLabel: match.stage === 'group' ? `Grupo ${match.group}` : (match.stageLabel ?? 'Mata-mata'),
                          dateLabel: formatMatchDate(match),
                          ...myCtx,
                        }} icon />
                      )}
                    </div>
                  )
                })}
                {guesses.length === 0 && (
                  <div className="px-4 py-5 text-center font-mono text-[10px] text-ink-4">
                    {scoreFilter ? `Ninguém cravou ${scoreFilter} neste jogo.`
                      : query ? 'Nenhum palpiteiro com esse nome neste jogo.'
                      : 'Ninguém palpitou neste jogo.'}
                  </div>
                )}
              </div>
              <div className="border-t border-hairline px-4 py-2 font-mono text-[9px] text-ink-4">
                {(scoreFilter || query)
                  ? `${guesses.length} de ${allGuesses.length} palpites`
                  : `${allGuesses.length} ${allGuesses.length === 1 ? 'palpite' : 'palpites'}`}
                {settled ? ' · apurado' : ' · pontos saem na apuração'}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function StandingRow({ s, meId }: { s: EspiaStanding; meId?: string }) {
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
      <span className="font-display text-lg w-7 text-center text-ink-3 flex-shrink-0">{s.rank}º</span>
      <Avatar initials={s.user.initials} color={s.user.color} src={s.user.avatarUrl} size={30} />
      <div className="min-w-0 flex-1">
        <div className="font-mono text-[11px] font-bold text-ink truncate">{s.user.firstName}</div>
        <div className="mt-0.5"><TierBadge tier={s.tier} small /></div>
      </div>
      <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
        <span className="font-display text-base text-ink leading-none">{s.points} <span className="font-mono text-[8px] text-ink-4">pts</span></span>
        <span className="font-mono text-[8px] text-ink-4">{s.exact} {s.exact === 1 ? 'cravada' : 'cravadas'}</span>
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
              {tier.tagline} <span className="text-ink-4">· {tier.rankHint}</span>
            </div>
          </div>
        ))}
      </div>
      <p className="font-mono text-[9px] text-ink-4 mt-3 leading-relaxed">
        A classe vem da sua posição no ranking — mais pontos, classe melhor.
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
        <div className="font-mono text-[10px] tracking-eyebrow text-paper/50">MESMA COLOCAÇÃO DO RANKING GERAL</div>
        <div className="font-display text-2xl leading-none">QUEM ESTÁ CRAVANDO</div>
      </div>
      {standings.length > 0 ? (
        <div className="max-h-[60vh] overflow-y-auto">
          {standings.map(s => (
            <StandingRow key={s.user.id} s={s} meId={meId} />
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
  const { matches, standings: allStandings, profiles, loading } = useEspiadinhaData()

  const [phaseId, setPhaseId] = useState('all')
  const [query, setQuery] = useState('')

  const activeFilter = PHASE_FILTERS.find(f => f.id === phaseId) ?? PHASE_FILTERS[0]
  const filteredMatches = useMemo(() => matches.filter(rm =>
    activeFilter.stages === null ? true : activeFilter.stages.includes(rm.match.stage),
  ), [matches, activeFilter])

  const standings = useMemo(() => {
    if (!query) return allStandings
    return allStandings.filter(s => norm(s.user.name).includes(norm(query)))
  }, [allStandings, query])

  const myCtx = useMemo<ShareCtx | undefined>(() => {
    if (!me) return undefined
    const st = allStandings.find(s => s.user.id === me.id)
    return {
      userName: `${me.firstName} ${me.lastName ?? ''}`.trim() || me.firstName || 'Você',
      userInitials: me.initials ?? '?',
      userColor: me.color ?? '#777',
      userAvatarUrl: me.avatarUrl,
      rank: st?.rank,
      className: st?.tier.label,
    }
  }, [me, allStandings])

  const hasAny = matches.length > 0

  return (
    <div className="min-h-dvh bg-paper pb-24 lg:pb-10 overflow-x-hidden">
      <div className="app-shell py-7 lg:py-9">
        <EspiaHeader />

        <div className="mb-5 -mt-2 border-l-2 border-yellow bg-yellow/5 px-3 py-1.5">
          <span className="font-mono text-[9px] text-ink-3 leading-snug">
            ⏱ Os pontos podem levar um tempo pra apurar depois que o jogo termina — a fonte de resultados nem sempre é instantânea.
          </span>
        </div>

        {loading ? (
          <div className="ui-card p-12 text-center">
            <div className="font-mono text-[11px] tracking-eyebrow text-ink-3 animate-pulse">
              CARREGANDO A ESPIADINHA…
            </div>
          </div>
        ) : !hasAny ? (
          <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
            <div className="order-2 lg:order-1 min-w-0">
              <div className="ui-card p-10 text-center">
                <div className="font-display text-5xl md:text-6xl text-ink-4 mb-3">EM BREVE</div>
                <p className="font-mono text-[12px] text-ink-3 max-w-[380px] mx-auto leading-relaxed">
                  Ainda não rolou nenhum jogo. Assim que a bola rolar, os palpites de quem já jogou
                  aparecem aqui — em tempo real e sem cola.
                </p>
              </div>
            </div>
            <aside className="order-1 lg:order-2 space-y-4 min-w-0">
              <StandingsCard standings={[]} meId={me?.id} />
              <ClassesLegend />
            </aside>
          </div>
        ) : (
          <>
            {/* controles */}
            <div className="mb-5 space-y-2.5">
              <div className="flex flex-wrap gap-1.5">
                {PHASE_FILTERS.map(f => (
                  <button
                    key={f.id}
                    onClick={() => setPhaseId(f.id)}
                    className={cn(
                      'px-3 py-1.5 font-mono text-[10px] font-bold tracking-eyebrow uppercase border transition-colors',
                      phaseId === f.id ? 'bg-yellow text-[#0D0D0D] border-ink' : 'border-line text-ink-3 hover:bg-surface-hover',
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 border border-line bg-card px-3 py-1.5">
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
              <div className="order-2 lg:order-1 space-y-4 min-w-0">
                {filteredMatches.length > 0 ? (
                  filteredMatches.map(rm => (
                    <MatchCard key={rm.match.id} match={rm.match} settled={rm.settled} profiles={profiles} meId={me?.id} query={query} myCtx={myCtx} />
                  ))
                ) : (
                  <div className="ui-card p-8 text-center">
                    <div className="font-display text-3xl text-ink-4 mb-2">—</div>
                    <p className="font-mono text-[11px] text-ink-3 max-w-[320px] mx-auto leading-relaxed">
                      Nenhum jogo revelado nessa fase ainda. Assim que um jogo começar, os palpites aparecem aqui.
                    </p>
                  </div>
                )}
              </div>

              {/* classes */}
              <aside className="order-1 lg:order-2 space-y-4 min-w-0">
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
