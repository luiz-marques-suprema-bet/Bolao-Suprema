import type { MatchStage } from '@/types'

// ─── Regras de pontuação — única fonte de verdade do projeto ─────────────────
//
// Fase de grupos:
//   Placar exato                              → 10 pts
//   Resultado + gols do vencedor              →  7 pts  (ex: 3×0 vs 3×1)
//   Resultado correto (V/E/D)                 →  5 pts
//   Gols de uma equipe correto                →  1 pt
//
// Mata-mata (regras 5.2) — o placar/resultado valem POR SI; o classificado é piso:
//   Placar exato (conta prorrogação)          → 12 pts
//   Resultado + placar de um time             →  8 pts
//   Resultado correto (V/E/D)                 →  5 pts
//   Só acertou o classificado (incl. pênaltis)→  2 pts
//   Nada                                      →  0 pts
//
// O placar exato usa o placar FINAL (que já inclui prorrogação). Os pênaltis só
// definem o classificado (o piso de 2). "Placar de um time": basta acertar os
// gols de um dos times junto com o resultado.
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

  // Mata-mata
  if (exactMatch) return 12
  if (correctOutcome && winnerGoalsCorrect) return 8
  if (correctOutcome) return 5
  // Para mata-mata, 2 pts se acertou o classificado (mesmo lógica do resultado)
  // Isso é verificado na camada acima com o winner real
  return 0
}

/**
 * Mata-mata (regras 5.2) — placar/resultado valem por si (12/8/5); o classificado
 * é só o piso de 2 pts. O placar exato usa o placar FINAL (inclui prorrogação).
 * `predictedAdvancer` = quem o usuário acha que passa (home/away).
 * `realAdvancer` = quem passou de verdade (pode ter sido nos pênaltis).
 */
export function calculateKoPoints(
  prediction: PredictionInput,
  result: MatchResult,
  predictedAdvancer: 'home' | 'away' | null,
  realAdvancer: 'home' | 'away' | null
): number {
  // Regras 5.2: o placar/resultado valem POR SI (não dependem do classificado).
  // O classificado (inclui prorrogação/pênaltis) é só o piso de 2 pts.
  const exactMatch = prediction.homeScore === result.homeScore && prediction.awayScore === result.awayScore
  if (exactMatch) return 12                          // placar exato (conta prorrogação)
  const correctResult = outcome(prediction.homeScore, prediction.awayScore) === outcome(result.homeScore, result.awayScore)
  const oneTeamGoals = prediction.homeScore === result.homeScore || prediction.awayScore === result.awayScore
  if (correctResult && oneTeamGoals) return 8        // resultado + placar de um time
  if (correctResult) return 5                        // resultado
  const advancerCorrect = predictedAdvancer !== null && realAdvancer !== null && predictedAdvancer === realAdvancer
  if (advancerCorrect) return 2                       // só acertou o classificado
  return 0
}
