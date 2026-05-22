export interface TournamentValidationResult {
  valid: boolean
  error: string | null
}

export function validateTournamentPicks(
  champion: string | null | undefined,
  vice: string | null | undefined,
): TournamentValidationResult {
  if (!champion || !vice) return { valid: true, error: null }
  if (champion === vice) {
    return { valid: false, error: 'Campeao e vice nao podem ser a mesma selecao.' }
  }
  return { valid: true, error: null }
}

export const validateChampionVice = validateTournamentPicks
