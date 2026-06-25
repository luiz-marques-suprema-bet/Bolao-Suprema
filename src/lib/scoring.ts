import type { MatchStage } from '@/types'

// ─── Regras de pontuação — única fonte de verdade do projeto ─────────────────
//
// Fase de grupos:
//   Placar exato                              → 10 pts
//   Resultado + gols do vencedor              →  7 pts  (ex: 3×0 vs 3×1)
//   Resultado correto (V/E/D)                 →  5 pts
//   Gols de uma equipe correto                →  1 pt
//
// Mata-mata — "quem passa manda" (acertar o CLASSIFICADO é obrigatório; o
// placar do tempo regulamentar é bônus em cima dele):
//   ACERTOU quem passa:
//     Placar exato (90')              → 12 pts  (CRAVADA)
//     Resultado + gols do vencedor    →  8 pts
//     Resultado certo (90')           →  5 pts
//     Só acertou quem passa           →  3 pts
//   ERROU quem passa:
//     Cravou o placar (90')           →  2 pts  (consolação)
//     resto                           →  0 pts
//
// "Gols do vencedor": o +7/+8 exige acertar o resultado E o número de gols do
// time VENCEDOR. Acertar só os gols do perdedor (com o resultado certo) vale 5,
// não 7. Em empate não há vencedor, então o teto com resultado certo é 5.
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

  // Mata-mata
  if (exactMatch) return 12
  if (correctOutcome && winnerGoalsCorrect) return 8
  if (correctOutcome) return 5
  // Para mata-mata, 2 pts se acertou o classificado (mesmo lógica do resultado)
  // Isso é verificado na camada acima com o winner real
  return 0
}

/**
 * Mata-mata — "quem passa manda". Acertar o classificado é o que destrava os
 * pontos; o placar do tempo regulamentar é bônus em cima.
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
  const correctRegTime = outcome(prediction.homeScore, prediction.awayScore) === outcome(result.homeScore, result.awayScore)
  const winnerGoalsCorrect =
    (result.homeScore > result.awayScore && prediction.homeScore === result.homeScore) ||
    (result.awayScore > result.homeScore && prediction.awayScore === result.awayScore)
  const advancerCorrect = predictedAdvancer !== null && realAdvancer !== null && predictedAdvancer === realAdvancer

  if (advancerCorrect) {
    if (exactMatch) return 12              // CRAVADA: placar exato + quem passa
    if (correctRegTime && winnerGoalsCorrect) return 8
    if (correctRegTime) return 5
    return 3                               // só acertou quem passa
  }
  // Errou quem passa: só a consolação por cravar o placar do tempo normal.
  if (exactMatch) return 2
  return 0
}
