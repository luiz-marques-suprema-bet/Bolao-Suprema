import type { Match } from '@/types'
import { POINT_RULES } from '@/types'
import { WC2026_MATCHES } from '@/data/wc2026'
import { calculatePoints } from '@/lib/scoring'
import { isMatchClosed } from '@/lib/markets'
import { isPlaceholderMatch } from '@/lib/matchGuards'

// ─── Espiadinha — "espie os palpites alheios" ────────────────────────────────
//
// Regra de ouro (anti-cola): só revelamos palpites de partidas que JÁ começaram
// (kickoff passou) ou estão ao vivo/encerradas. Jogo que ainda vai rolar fica
// escondido para ninguém copiar. O gate é `isMatchClosed` — o MESMO momento em
// que o mercado fecha.
//
// As CLASSES dos palpiteiros derivam da acurácia (pontos ganhos ÷ pontos
// possíveis nos jogos já apurados). POINT_RULES é a única fonte das regras.

const pointsFor = (id: string) => POINT_RULES.find(r => r.id === id)?.points ?? 0
const GROUP_EXACT = pointsFor('group_exact') // 10
const KO_EXACT = pointsFor('ko_exact')       // 12

export const STAGE_BY_CODE: Record<string, string> = Object.fromEntries(
  WC2026_MATCHES.map(m => [m.id, m.stage]),
)

export function maxPointsFor(stage: string): number {
  return stage === 'group' ? GROUP_EXACT : KO_EXACT
}

// ─── Classes / Tiers ──────────────────────────────────────────────────────────

export interface EspiaTier {
  id: string
  label: string
  tagline: string
  /** Dica da faixa no ranking (mostrada na legenda). */
  rankHint: string
  /** Classe Tailwind do selo. */
  badgeClass: string
  /** Cor da barrinha. */
  barClass: string
}

// Ordem do melhor para o pior. A classe é atribuída por POSIÇÃO no ranking
// (percentil) em buildEspiadinha — congruente com a lista ordenada por pontos
// (topo = G.O.A.T), e ninguém vira G.O.A.T cravando 1 jogo só.
export const ESPIA_TIERS: EspiaTier[] = [
  { id: 'goat',      label: 'G.O.A.T',                  tagline: 'craque dos palpites',     rankHint: 'topo ~10%',      badgeClass: 'bg-yellow text-[#0D0D0D] border-transparent', barClass: 'bg-yellow' },
  { id: 'genio',     label: 'Gênio',                    tagline: 'acima da média',          rankHint: 'topo ~30%',      badgeClass: 'bg-green/15 text-green-deep border-green/40',  barClass: 'bg-green' },
  { id: 'medio',     label: 'Palpiteiro médio',         tagline: 'no meio da tabela',       rankHint: 'meio',           badgeClass: 'bg-surface-2 text-ink-2 border-hairline',      barClass: 'bg-ink-3' },
  { id: 'tentando',  label: 'Tá tentando',              tagline: 'ainda vai pegar o jeito', rankHint: 'parte de baixo', badgeClass: 'bg-surface-2 text-ink-3 border-hairline',      barClass: 'bg-ink-4' },
  { id: 'participar',label: 'O importante é participar', tagline: 'presença garantida',      rankHint: '~10% finais',    badgeClass: 'bg-surface-2 text-ink-4 border-hairline border-dashed', barClass: 'bg-ink-4/60' },
]

// Classe pela fração de posição no ranking (0 = topo).
function tierByRankFraction(fraction: number): EspiaTier {
  if (fraction < 0.10) return ESPIA_TIERS[0] // goat
  if (fraction < 0.30) return ESPIA_TIERS[1] // genio
  if (fraction < 0.65) return ESPIA_TIERS[2] // medio
  if (fraction < 0.90) return ESPIA_TIERS[3] // tentando
  return ESPIA_TIERS[4]                       // participar
}

// ─── Acerto de um palpite ───────────────────────────────────────────────────────

// Encerrado: exact/partial/miss (pontos). pending: jogo em andamento, ainda
// sem apuração — não mostramos placar ao vivo, só o palpite.
export type HitKind = 'exact' | 'partial' | 'miss' | 'pending'

export interface Hit {
  kind: HitKind
  label: string
  points: number | null
}

export function hitFor(points: number | null, stage: string, settled: boolean): Hit {
  if (!settled) return { kind: 'pending', label: 'no jogo', points: null }
  const max = maxPointsFor(stage)
  const p = points ?? 0
  if (p >= max) return { kind: 'exact', label: 'CRAVOU', points: p }
  if (p > 0)    return { kind: 'partial', label: `+${p}`, points: p }
  return { kind: 'miss', label: 'errou', points: 0 }
}

// ─── Tipos da view ──────────────────────────────────────────────────────────────

export interface EspiaProfile {
  id: string
  name: string
  firstName: string
  initials: string
  color: string
  avatarUrl?: string
  dept: string
}

export interface EspiaPredRow {
  userId: string
  matchId: string
  homeScore: number
  awayScore: number
  points: number | null
}

export interface EspiaGuess {
  user: EspiaProfile
  homeScore: number
  awayScore: number
  hit: Hit
}

export interface EspiaMatch {
  match: Match
  settled: boolean
  guesses: EspiaGuess[]
}

export interface EspiaStanding {
  user: EspiaProfile
  points: number
  settledCount: number
  accuracy: number
  exact: number
  correct: number
  tier: EspiaTier
}

export interface EspiaView {
  matches: EspiaMatch[]
  standings: EspiaStanding[]
}

function matchIsSettled(m: Match): boolean {
  return m.status === 'finished' || !!m.settledAt
}

/**
 * Monta a visão da Espiadinha a partir das partidas (com status do banco),
 * dos palpites e dos perfis. Função pura — usada tanto para os dados reais
 * quanto para a prévia/exemplo.
 */
export function buildEspiadinha(
  matches: Match[],
  predictions: EspiaPredRow[],
  profiles: EspiaProfile[],
): EspiaView {
  const profileById = new Map(profiles.map(p => [p.id, p]))

  const revealed = matches
    .filter(m => !isPlaceholderMatch(m) && isMatchClosed(m))
    .sort((a, b) => new Date(b.kickoffUtc).getTime() - new Date(a.kickoffUtc).getTime())

  const revealedCodes = new Set(revealed.map(m => m.id))
  const predsByMatch = new Map<string, EspiaPredRow[]>()
  for (const pred of predictions) {
    if (!revealedCodes.has(pred.matchId)) continue
    const list = predsByMatch.get(pred.matchId) ?? []
    list.push(pred)
    predsByMatch.set(pred.matchId, list)
  }

  // Acumuladores por usuário (só jogos já apurados contam para a classe).
  const acc: Record<string, { points: number; max: number; settled: number; exact: number; correct: number }> = {}

  const espiaMatches: EspiaMatch[] = revealed.map(match => {
    const settled = matchIsSettled(match)
    const stage = match.stage
    const result = { homeScore: match.homeScore ?? 0, awayScore: match.awayScore ?? 0 }

    const guesses: EspiaGuess[] = (predsByMatch.get(match.id) ?? [])
      .map(pred => {
        const user = profileById.get(pred.userId)
        if (!user) return null
        const pts = settled
          ? (pred.points ?? calculatePoints({ homeScore: pred.homeScore, awayScore: pred.awayScore }, result, stage))
          : null
        const hit = hitFor(pts, stage, settled)

        if (settled) {
          const max = maxPointsFor(stage)
          const bucket = acc[user.id] ?? { points: 0, max: 0, settled: 0, exact: 0, correct: 0 }
          bucket.points += pts ?? 0
          bucket.max += max
          bucket.settled += 1
          if (hit.kind === 'exact') bucket.exact += 1
          if ((pts ?? 0) > 0) bucket.correct += 1
          acc[user.id] = bucket
        }

        return { user, homeScore: pred.homeScore, awayScore: pred.awayScore, hit } as EspiaGuess
      })
      .filter((g): g is EspiaGuess => g !== null)
      .sort((a, b) => (b.hit.points ?? -1) - (a.hit.points ?? -1) || a.user.name.localeCompare(b.user.name))

    return { match, settled, guesses }
  })

  // Leaderboard ordenado por pontos (depois cravadas, depois acurácia).
  const ranked = Object.entries(acc)
    .map(([userId, b]) => {
      const user = profileById.get(userId)!
      const accuracy = b.max > 0 ? b.points / b.max : 0
      return { user, points: b.points, settledCount: b.settled, accuracy, exact: b.exact, correct: b.correct }
    })
    .filter(s => s.user)
    .sort((a, b) => b.points - a.points || b.exact - a.exact || b.accuracy - a.accuracy)

  // Classe por POSIÇÃO no ranking (percentil). Mesma pontuação → mesma classe
  // (o empate herda a classe do primeiro com aquela pontuação). Assim a lista
  // (ordenada por pontos) fica congruente com os selos: topo = G.O.A.T.
  const total = ranked.length
  const standings: EspiaStanding[] = []
  for (let i = 0; i < ranked.length; i++) {
    const tier = (i > 0 && ranked[i].points === ranked[i - 1].points)
      ? standings[i - 1].tier
      : tierByRankFraction(total > 0 ? i / total : 0)
    standings.push({ ...ranked[i], tier })
  }

  return { matches: espiaMatches, standings }
}
