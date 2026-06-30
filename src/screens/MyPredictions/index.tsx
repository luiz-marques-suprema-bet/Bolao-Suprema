import { useMemo, useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Flag } from '@/components/shared/Flag'
import { useAuthStore } from '@/stores/auth.store'
import { usePredictionStore } from '@/stores/prediction.store'
import { useBracketStore } from '@/stores/bracket.store'
import { useMatchesWithStatus } from '@/hooks/useMatchWithStatus'
import { useTabResync } from '@/hooks/useTabResync'
import { WC2026_MATCHES, WC2026_GROUPS } from '@/data/wc2026'
import { formatMatchDate, formatMatchTime } from '@/lib/matchTime'
import { getEffectiveMarketStatus } from '@/lib/markets'
import { isPlaceholderMatch } from '@/lib/matchGuards'
import { calculatePoints } from '@/lib/scoring'
import { fetchRanking, subscribeRankingUpdates } from '@/lib/ranking'
import { standingsFromRanking, type EspiaTier } from '@/lib/espiadinha'
import { ShareCravadaButton } from '@/components/shared/ShareCravada'
import type { CravadaCardData } from '@/lib/shareCard'
import { cn, fmtPts } from '@/lib/utils'
import type { Match, Prediction, RankingEntry } from '@/types'

type UserCardCtx = Pick<CravadaCardData, 'userName' | 'userInitials' | 'userColor' | 'userAvatarUrl' | 'rank' | 'className'>

function isCravada(m: Match, pred?: Prediction): boolean {
  return m.status === 'finished' && !!pred && m.homeScore != null && m.awayScore != null
    && pred.homeScore === m.homeScore && pred.awayScore === m.awayScore
}

function cravadaCard(m: Match, pred: Prediction, ctx: UserCardCtx): CravadaCardData {
  return {
    home: { code: m.home.code, flag: m.home.flag, color: m.home.color },
    away: { code: m.away.code, flag: m.away.flag, color: m.away.color },
    homeScore: m.homeScore ?? 0,
    awayScore: m.awayScore ?? 0,
    points: pointsOf(m, pred) ?? (m.stage === 'group' ? 10 : 12),
    stageLabel: m.stage === 'group' ? `Grupo ${m.group}` : (m.stageLabel ?? 'Mata-mata'),
    dateLabel: formatMatchDate(m),
    ...ctx,
  }
}

// match_code → slot do chaveamento (pra ler o "quem passa" do usuário).
function matchCodeToSlotId(code: string): string | null {
  if (/^ko-r32-\d+$/.test(code)) return code.replace('ko-r32-', 'r32_')
  if (/^ko-r16-\d+$/.test(code)) return code.replace('ko-r16-', 'r16_')
  if (/^ko-qf-\d+$/.test(code)) return code.replace('ko-qf-', 'qf_')
  if (/^ko-sf-\d+$/.test(code)) return code.replace('ko-sf-', 'sf_')
  if (code === 'ko-third-1') return 'third_1'
  if (code === 'ko-final-1') return 'final_1'
  return null
}

// Pontos de um jogo: usa o valor do banco (autoritativo: grupos + mata-mata);
// se ainda não veio, calcula pelo placar real (regra atual).
function pointsOf(m: Match, pred?: Prediction): number | null {
  if (!pred || m.status !== 'finished') return null
  if (typeof pred.pointsEarned === 'number') return pred.pointsEarned
  if (m.homeScore == null || m.awayScore == null) return null
  return calculatePoints({ homeScore: pred.homeScore, awayScore: pred.awayScore }, { homeScore: m.homeScore, awayScore: m.awayScore }, m.stage)
}

function TierBadge({ tier }: { tier: EspiaTier }) {
  return (
    <span className={cn('inline-flex items-center rounded-full border font-mono text-[9px] font-bold tracking-eyebrow uppercase px-2 py-0.5 whitespace-nowrap', tier.badgeClass)}>
      {tier.label}
    </span>
  )
}

export function MyPredictionsScreen() {
  const navigate = useNavigate()
  const me = useAuthStore(s => s.user)
  const { predictions, championPick, vicePick, scorerPick, syncFromSupabase } = usePredictionStore()
  const syncBracket = useBracketStore(s => s.syncFromSupabase)
  const matches = useMatchesWithStatus(WC2026_MATCHES)
  const [ranking, setRanking] = useState<RankingEntry[]>([])
  const [group, setGroup] = useState<string>('all')

  // Recarrega palpites (pontos) + classificados (quem passa) + ranking.
  const reload = useCallback(() => {
    if (!me?.id) return
    void syncFromSupabase(me.id)
    void syncBracket(me.id)
    fetchRanking(me.id).then(setRanking).catch(() => {})
  }, [me?.id, syncFromSupabase, syncBracket])
  useEffect(() => reload(), [reload])
  useTabResync(reload)
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined
    const unsub = subscribeRankingUpdates(() => { clearTimeout(t); t = setTimeout(reload, 300) })
    return () => { clearTimeout(t); unsub() }
  }, [reload])

  const myEntry = useMemo(
    () => ranking.find(r => r.isYou) ?? ranking.find(r => r.userId === me?.id),
    [ranking, me?.id],
  )
  const myTier = useMemo(
    () => standingsFromRanking(ranking).find(s => s.user.id === me?.id)?.tier,
    [ranking, me?.id],
  )
  const userCtx = useMemo<UserCardCtx>(() => ({
    userName: me ? (`${me.firstName} ${me.lastName ?? ''}`.trim() || me.firstName || 'Você') : 'Você',
    userInitials: me?.initials ?? '?',
    userColor: me?.color ?? '#777',
    userAvatarUrl: me?.avatarUrl,
    rank: myEntry?.rank,
    className: myTier?.label,
  }), [me, myEntry?.rank, myTier?.label])

  // Jogos atuais: TODOS os que estão AO VIVO (pode ter 2+ ao mesmo tempo);
  // se nenhum estiver ao vivo, mostra só o próximo a começar.
  const currentGames = useMemo(() => {
    const playable = matches.filter(m => !isPlaceholderMatch(m) && m.kickoffUtc)
    const live = playable
      .filter(m => m.status === 'live')
      .sort((a, b) => new Date(a.kickoffUtc).getTime() - new Date(b.kickoffUtc).getTime())
    if (live.length) return live
    const now = Date.now()
    const next = playable
      .filter(m => m.status !== 'finished' && new Date(m.kickoffUtc).getTime() > now)
      .sort((a, b) => new Date(a.kickoffUtc).getTime() - new Date(b.kickoffUtc).getTime())[0]
    return next ? [next] : []
  }, [matches])

  const filtered = useMemo(() => matches.filter(m => {
    if (group === 'all') return true
    if (group === 'ko') return m.stage !== 'group'
    return m.group === group
  }), [matches, group])

  const doneCount = useMemo(() => matches.filter(m => predictions[m.id]).length, [matches, predictions])
  const pendingCount = useMemo(
    () => matches.filter(m => !predictions[m.id] && !isPlaceholderMatch(m) && getEffectiveMarketStatus(m) === 'open').length,
    [matches, predictions],
  )

  return (
    <div className="min-h-dvh bg-paper pb-24 lg:pb-10">
      <div className="app-shell px-4 py-6 md:px-8 space-y-5">

        {/* ── Cabeçalho ──────────────────────────────────────────── */}
        <header>
          <p className="font-mono text-[10px] tracking-eyebrow text-ink-3">MEU PAINEL</p>
          <div className="font-display text-5xl md:text-7xl leading-none text-ink">PALPITES</div>
          <div className="flex items-baseline gap-3">
            <span className="font-serif-it text-3xl md:text-5xl text-green-deep leading-none">seus,</span>
            <span className="font-mono text-[10px] tracking-eyebrow text-ink-3 self-end mb-1">no detalhe.</span>
          </div>
        </header>

        {/* ── Minha posição + classe ─────────────────────────────── */}
        <section className="ui-card overflow-hidden">
          <div className="bg-ink text-paper px-4 py-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="font-mono text-[9px] tracking-eyebrow text-paper/50">SUA COLOCAÇÃO</div>
              <div className="flex items-baseline gap-2">
                <span className="font-display text-4xl leading-none">{myEntry ? `${myEntry.rank}º` : '—'}</span>
                <span className="font-display text-xl text-yellow">{myEntry ? `${fmtPts(myEntry.pts)} pts` : ''}</span>
              </div>
            </div>
            {myTier && <TierBadge tier={myTier} />}
          </div>
          <div className="grid grid-cols-4 divide-x divide-hairline">
            <Stat label="acertos" value={myEntry?.correct ?? 0} />
            <Stat label="cravadas" value={myEntry?.exact ?? 0} />
            <Stat label="sequência" value={myEntry?.streak ?? 0} />
            <Stat label="feitos" value={doneCount} />
          </div>
          <button onClick={() => navigate('/ranking')} className="w-full border-t border-hairline py-2.5 font-mono text-[10px] tracking-eyebrow text-ink-3 hover:bg-surface-hover">
            VER RANKING COMPLETO →
          </button>
        </section>

        {/* ── Jogo(s) atual(is) — pode ter 2+ ao vivo simultâneos ── */}
        {currentGames.map(game => (
          <section key={game.id} className="ui-card overflow-hidden border-2 border-yellow">
            <div className="flex items-center justify-between bg-yellow/15 px-4 py-2">
              <span className="font-mono text-[9px] font-bold tracking-eyebrow text-ink">
                {game.status === 'live' ? '● JOGO AGORA' : 'PRÓXIMO JOGO'}
              </span>
              <span className="font-mono text-[9px] text-ink-3">{formatMatchDate(game)} · {formatMatchTime(game)}</span>
            </div>
            <CurrentGameBody match={game} pred={predictions[game.id]} onClick={() => navigate(`/prediction/${game.id}`)} />
          </section>
        ))}

        {/* ── Apostas especiais ──────────────────────────────────── */}
        <section className="ui-card p-4">
          <div className="flex items-baseline justify-between gap-3 mb-3">
            <h2 className="font-display text-xl">APOSTAS ESPECIAIS</h2>
            <button onClick={() => navigate('/prediction', { state: { tab: 'champion' } })} className="font-mono text-[10px] text-ink-3 hover:text-ink">EDITAR →</button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <General label="Campeão" value={championPick} />
            <General label="Vice" value={vicePick} />
            <General label="Artilheiro" value={scorerPick} />
          </div>
        </section>

        {/* ── Filtro por grupo + lista ───────────────────────────── */}
        <section className="ui-panel">
          <div className="ui-panel-header flex items-baseline justify-between">
            <h2 className="font-display text-xl">POR JOGO</h2>
            {pendingCount > 0 && <span className="font-mono text-[9px] text-yellow font-bold">{pendingCount} PENDENTE{pendingCount > 1 ? 'S' : ''}</span>}
          </div>

          <div className="flex flex-wrap gap-1.5 px-3 py-3 border-b border-hairline">
            <GroupChip id="all" label="TODOS" active={group === 'all'} onClick={setGroup} />
            {WC2026_GROUPS.map(g => (
              <GroupChip key={g.id} id={g.id} label={g.id} active={group === g.id} onClick={setGroup} />
            ))}
            <GroupChip id="ko" label="MATA-MATA" active={group === 'ko'} onClick={setGroup} />
          </div>

          <div className="divide-y divide-hairline">
            {filtered.length === 0 ? (
              <div className="px-4 py-8 text-center font-mono text-[11px] text-ink-3">Nenhum jogo nesse filtro.</div>
            ) : (
              filtered.map(match => (
                <MatchRow
                  key={match.id}
                  match={match}
                  pred={predictions[match.id]}
                  userCtx={userCtx}
                  onClick={() => navigate(`/prediction/${match.id}`)}
                />
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

// ─── peças ──────────────────────────────────────────────────────────

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="px-2 py-3 text-center">
      <div className="font-display text-2xl leading-none text-ink">{value}</div>
      <div className="font-mono text-[8px] tracking-eyebrow text-ink-3 mt-1">{label.toUpperCase()}</div>
    </div>
  )
}

function General({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="border border-hairline p-3 text-center min-w-0">
      <div className="font-mono text-[8px] tracking-eyebrow text-ink-4">{label.toUpperCase()}</div>
      <div className={cn('font-display text-lg mt-0.5 truncate', value ? 'text-ink' : 'text-ink-4')}>{value || '—'}</div>
    </div>
  )
}

function GroupChip({ id, label, active, onClick }: { id: string; label: string; active: boolean; onClick: (id: string) => void }) {
  return (
    <button
      onClick={() => onClick(id)}
      className={cn(
        'px-2.5 py-1 font-mono text-[10px] font-bold tracking-eyebrow uppercase border transition-colors',
        active ? 'bg-yellow text-[#0D0D0D] border-ink' : 'border-line text-ink-3 hover:bg-surface-hover',
      )}
    >
      {label === 'all' || label === 'ko' ? label : label.length === 1 ? `GRUPO ${label}` : label}
    </button>
  )
}

function MatchRow({ match, pred, userCtx, onClick }: { match: Match; pred?: Prediction; userCtx: UserCardCtx; onClick: () => void }) {
  const isDone = match.status === 'finished'
  const isLive = match.status === 'live'
  const placeholder = isPlaceholderMatch(match)
  const cravada = isCravada(match, pred)
  const pts = pointsOf(match, pred)

  // "Quem passa" no mata-mata: meu pick explícito OU o vencedor do meu placar
  // (decisivo já indica). Num empate sem pick, fica indefinido.
  const bracketPicks = useBracketStore(s => s.picks)
  const isKo = match.stage !== 'group'
  const slotId = isKo ? matchCodeToSlotId(match.id) : null
  const myAdvancer = !isKo || !pred ? null
    : (slotId && bracketPicks[slotId])
      ? bracketPicks[slotId]
      : pred.homeScore > pred.awayScore ? match.home.code
      : pred.homeScore < pred.awayScore ? match.away.code
      : null
  const realAdvancer = isDone && match.winner && match.winner !== 'draw' ? match.winner : null

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      className="w-full px-4 py-3 hover:bg-surface-hover transition-colors cursor-pointer"
    >
      {/* Linha 1 — o confronto + resultado real (só quando encerra) */}
      <div className="flex items-center gap-2">
        <span className="font-mono text-[8px] text-ink-4 w-11 flex-shrink-0 leading-tight">
          {match.stage === 'group' ? `GRUPO ${match.group}` : match.stageLabel}
        </span>
        <Flag team={match.home} size={20} />
        <span className="font-mono text-[12px] font-bold">{match.home.code}</span>
        <span className="font-mono text-[10px] text-ink-4">×</span>
        <span className="font-mono text-[12px] font-bold">{match.away.code}</span>
        <Flag team={match.away} size={20} />
        <div className="flex-1 min-w-0 text-right">
          {isDone ? (
            <span className="font-display text-xl text-ink tabular-nums">{match.homeScore ?? 0}–{match.awayScore ?? 0}</span>
          ) : isLive ? (
            <span className="font-mono text-[8px] font-bold text-red tracking-eyebrow">AO VIVO</span>
          ) : placeholder ? (
            <span className="font-mono text-[9px] text-ink-4">a definir</span>
          ) : (
            <span className="font-mono text-[9px] text-ink-4">{formatMatchDate(match)} · {formatMatchTime(match)}</span>
          )}
        </div>
      </div>

      {/* Linha 2 — meu palpite, pontos e compartilhar */}
      {!placeholder && (
        <div className="mt-1.5 flex items-center gap-2 pl-12">
          <span className="font-mono text-[8px] tracking-eyebrow text-ink-4 flex-shrink-0">PALPITE</span>
          {pred ? (
            <span className="font-display text-base leading-none text-ink tabular-nums flex-shrink-0 whitespace-nowrap">{pred.homeScore}–{pred.awayScore}</span>
          ) : (
            <span className="font-mono text-[9px] font-bold text-yellow flex-shrink-0 whitespace-nowrap">{isDone || isLive ? 'não palpitou' : 'PALPITAR →'}</span>
          )}
          {isKo && pred && (
            <span className={cn('border px-1 py-px font-mono text-[8px] font-bold leading-none tracking-eyebrow flex-shrink-0 whitespace-nowrap',
              myAdvancer == null ? 'border-hairline text-ink-4'
              : realAdvancer ? (myAdvancer === realAdvancer ? 'border-green/50 bg-green/10 text-green' : 'border-red/40 bg-red/5 text-red')
              : 'border-line-strong text-ink-2')}>
              passa ▸ {myAdvancer ?? '—'}
            </span>
          )}
          {isDone && pred && (
            <span className={cn(
              'font-mono text-[9px] font-bold rounded-md px-1.5 py-0.5 flex-shrink-0 whitespace-nowrap',
              (pts ?? 0) >= 10 ? 'bg-green text-white' : (pts ?? 0) > 0 ? 'border border-hairline text-ink-2 bg-surface-2' : 'text-ink-4',
            )}>
              {(pts ?? 0) > 0 ? `+${pts}` : '0'}
            </span>
          )}
          {!isDone && !isLive && pred && <span className="font-mono text-[10px] text-green font-bold flex-shrink-0">✓ salvo</span>}
          <div className="flex-1" />
          {cravada && pred && <ShareCravadaButton data={cravadaCard(match, pred, userCtx)} icon />}
        </div>
      )}
    </div>
  )
}

function CurrentGameBody({ match, pred, onClick }: { match: Match; pred?: Prediction; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full p-4 hover:bg-surface-hover transition-colors">
      <div className="flex items-center justify-center gap-3">
        <div className="flex items-center gap-2 flex-1 justify-end min-w-0">
          <span className="font-display text-2xl text-ink truncate">{match.home.code}</span>
          <Flag team={match.home} size={26} />
        </div>
        <span className="font-display text-xl text-ink-4">×</span>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Flag team={match.away} size={26} />
          <span className="font-display text-2xl text-ink truncate">{match.away.code}</span>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-center gap-2">
        <span className="font-mono text-[10px] text-ink-3">SEU PALPITE:</span>
        {pred
          ? <span className="font-display text-2xl text-green tabular-nums">{pred.homeScore}–{pred.awayScore}</span>
          : <span className="font-mono text-[11px] font-bold text-yellow">FAZER PALPITE →</span>}
      </div>
    </button>
  )
}
