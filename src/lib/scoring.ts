import type { MatchStage } from '@/types'

// ─── Regras de pontuação — única fonte de verdade do projeto ─────────────────
//
// Fase de grupos:
//   Placar exato                              → 10 pts
//   Resultado + gols do vencedor              →  7 pts  (ex: 3×0 vs 3×1)
//   Resultado correto (V/E/D)                 →  5 pts
//   Gols de uma equipe correto                →  1 pt
//
// Mata-mata (regras 5.2 oficiais) — ESCADA (uma faixa só, não é soma) + bônus:
//   Placar exato (90 min)                     → 12 pts
//   Resultado + placar de um time             →  8 pts
//   Resultado correto (V/E/D)                 →  5 pts
//   Acerto do classificado (só ele)           →  2 pts (num empate/pênaltis)
//   Nada                                      →  0 pts
//   BÔNUS: +2 por acertar quem se classifica  → SÓ soma no placar exato de um
//     empate (12 → 14). Nas faixas 8/5 NÃO soma.
//   → jogo decidido no tempo normal: máx 12. Empate cravado + classificado: 14.
//
// O placar/resultado contam SÓ o tempo regulamentar (90 min) — gol na prorrogação
// NÃO muda o placar. O +2 é um BÔNUS por acertar quem se classifica; só existe em
// jogo que EMPATOU nos 90 min (pênaltis decidem quem passa) e apenas em cima do
// placar exato. Acertar SÓ o classificado (errou placar/resultado) num empate = 2.
//
// Grupos — "gols do vencedor" (+7): exige o resultado E os gols do time VENCEDOR;
// só os gols do perdedor (com resultado certo) vale 5. Em empate não há vencedor.
//
// Apostas gerais (calculadas separadamente na tabela users):
//   Campeão                                   → 25 pts
//   Vice-campeão                              → 15 pts
//   Artilheiro                                → 10 pts

export interface MatchResult {
  homeScore: number
  awayScore: number
}

export interface PredictionInput {
  homeScore: number
  awayScore: number
}

function outcome(home: number, away: number): 'home' | 'draw' | 'away' {
  if (home > away) return 'home'
  if (away > home) return 'away'
  return 'draw'
}

export function calculatePoints(
  prediction: PredictionInput,
  result: MatchResult,
  stage: MatchStage
): number {
  const p = prediction
  const r = result

  const isGroup = stage === 'group'
  const exactMatch = p.homeScore === r.homeScore && p.awayScore === r.awayScore
  const correctOutcome = outcome(p.homeScore, p.awayScore) === outcome(r.homeScore, r.awayScore)
  const oneTeamCorrect = p.homeScore === r.homeScore || p.awayScore === r.awayScore
  // Acertou os gols do time VENCEDOR (em empate não há vencedor → false).
  const winnerGoalsCorrect =
    (r.homeScore > r.awayScore && p.homeScore === r.homeScore) ||
    (r.awayScore > r.homeScore && p.awayScore === r.awayScore)

  if (isGroup) {
    if (exactMatch) return 10
    if (correctOutcome && winnerGoalsCorrect) return 7
    if (correctOutcome) return 5
    if (oneTeamCorrect) return 1
    return 0
  }

  // Mata-mata — SÓ o placar (tempo regulamentar). O bônus aditivo de +2 do
  // classificado é somado por calculateKoPoints, que conhece o "quem passa".
  if (exactMatch) return 12
  if (correctOutcome && oneTeamCorrect) return 8   // resultado + placar de um time
  if (correctOutcome) return 5
  return 0
}

/**
 * Mata-mata (regras 5.2 oficiais) — ESCADA: o palpite cai em UMA faixa (12/8/5/2/0),
 * não é soma. O placar/resultado contam SÓ o tempo regulamentar (`result` = placar
 * dos 90 min). O +2 é um BÔNUS por acertar quem se classifica e SÓ soma no placar
 * exato de um empate (12 → 14); nas faixas 8/5 não soma. Acertar só o classificado
 * (errou placar/resultado) num empate = 2. Jogo decidido nos 90 min: máx 12.
 * `predictedAdvancer` = quem o usuário acha que passa (home/away).
 * `realAdvancer` = quem passou de verdade (pode ter sido nos pênaltis).
 */
export function calculateKoPoints(
  prediction: PredictionInput,
  result: MatchResult,
  predictedAdvancer: 'home' | 'away' | null,
  realAdvancer: 'home' | 'away' | null
): number {
  const exactMatch = prediction.homeScore === result.homeScore && prediction.awayScore === result.awayScore
  const correctResult = outcome(prediction.homeScore, prediction.awayScore) === outcome(result.homeScore, result.awayScore)
  const oneTeamGoals = prediction.homeScore === result.homeScore || prediction.awayScore === result.awayScore
  const drawInRegulation = result.homeScore === result.awayScore
  const advancerCorrect =
    predictedAdvancer !== null && realAdvancer !== null && predictedAdvancer === realAdvancer

  // Escada — cada palpite cai em UMA faixa só (não é soma). O +2 é um BÔNUS por
  // acertar quem se classifica e SÓ soma no placar exato de um empate (12→14); nas
  // faixas 8/5 ele NÃO soma. "Só o classificado" (2) é a faixa de baixo: vale num
  // empate (pênaltis) quando errou o placar E o resultado, mas acertou quem passa.
  if (exactMatch) return drawInRegulation && advancerCorrect ? 14 : 12
  if (correctResult && oneTeamGoals) return 8
  if (correctResult) return 5
  if (drawInRegulation && advancerCorrect) return 2
  return 0
}
