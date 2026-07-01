import type { MatchStage } from '@/types'

// ─── Regras de pontuação — única fonte de verdade do projeto ─────────────────
//
// Fase de grupos:
//   Placar exato                              → 10 pts
//   Resultado + gols do vencedor              →  7 pts  (ex: 3×0 vs 3×1)
//   Resultado correto (V/E/D)                 →  5 pts
//   Gols de uma equipe correto                →  1 pt
//
// Mata-mata (regras 5.2 oficiais) — PLACAR (só tempo regulamentar) + BÔNUS aditivo:
//   Placar exato (90 min)                     → 12 pts
//   Resultado + placar de um time             →  8 pts
//   Resultado correto (V/E/D)                 →  5 pts
//   Nada                                      →  0 pts
//   + Classificado / quem passa (aditivo)     → +2 pts (incl. prorrogação/pênaltis)
//   → total = placar + bônus, máximo 14 pts.
//
// O placar/resultado contam SÓ o tempo regulamentar (90 min) — gol na prorrogação
// NÃO muda o placar. A prorrogação/pênaltis só definem o classificado (o +2). O +2
// é ADITIVO e vale em qualquer jogo (não é piso nem teto). "Placar de um time":
// basta acertar os gols de um dos times junto com o resultado.
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
 * Mata-mata (regras 5.2 oficiais) — total = PLACAR + BÔNUS aditivo do classificado.
 * O placar/resultado (12/8/5) contam SÓ o tempo regulamentar (`result` = placar dos
 * 90 min); a prorrogação não muda o placar. O bônus de +2 é aditivo e vale em
 * qualquer jogo quando se acerta quem passa (incl. prorrogação/pênaltis). Máximo 14.
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

  // Placar sobre o tempo regulamentar (12 / 8 / 5 / 0).
  let placar = 0
  if (exactMatch) placar = 12                          // placar exato (90 min)
  else if (correctResult && oneTeamGoals) placar = 8   // resultado + placar de um time
  else if (correctResult) placar = 5                   // resultado

  // Bônus ADITIVO: acertou o classificado (incl. prorrogação/pênaltis).
  const advancerCorrect =
    predictedAdvancer !== null && realAdvancer !== null && predictedAdvancer === realAdvancer
  return placar + (advancerCorrect ? 2 : 0)
}
