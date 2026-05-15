import { WC2026_GROUPS } from '@/data/wc2026'

export interface TournamentValidationResult {
  valid: boolean
  error: string | null
}

export function getGroupOfTeam(code: string | null | undefined): string | null {
  if (!code) return null
  for (const group of WC2026_GROUPS) {
    if (group.teams.includes(code)) return group.id
  }
  return null
}

export function validateTournamentPicks(
  champion: string | null | undefined,
  vice: string | null | undefined,
): TournamentValidationResult {
  if (!champion || !vice) return { valid: true, error: null }
  if (champion === vice) {
    return { valid: false, error: 'Campeao e vice nao podem ser a mesma selecao.' }
  }
  const championGroup = getGroupOfTeam(champion)
  const viceGroup = getGroupOfTeam(vice)
  if (championGroup && viceGroup && championGroup === viceGroup) {
    return {
      valid: false,
      error: `Campeao e vice nao podem ser do mesmo grupo (Grupo ${championGroup}). Escolha selecoes de grupos diferentes.`,
    }
  }
  return { valid: true, error: null }
}

export const validateChampionVice = validateTournamentPicks
