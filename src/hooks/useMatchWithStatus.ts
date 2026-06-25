import { useMemo, useEffect } from 'react'
import type { Match, MatchStatusOverride } from '@/types'
import { useMatchStore } from '@/stores/match.store'
import { TEAMS } from '@/data/teams'

// No mata-mata, os times saem conforme os grupos terminam (materialização no
// banco). Se o override traz um código real (≠ TBD) que existe em TEAMS, ele
// substitui o placeholder estático — assim a chave/jogos preenchem sozinhos.
function resolveTeam(code: string | null | undefined, fallback: Match['home']): Match['home'] {
  if (code && code !== 'TBD' && TEAMS[code]) return TEAMS[code]
  return fallback
}

function merge(m: Match, override: MatchStatusOverride): Match {
  return {
    ...m,
    home:        resolveTeam(override.homeCode, m.home),
    away:        resolveTeam(override.awayCode, m.away),
    status:      override.status,
    marketStatus: override.marketStatus,
    homeScore:   override.homeScore,
    awayScore:   override.awayScore,
    liveMinute:  override.liveMinute ?? undefined,
    winner:      override.winner ?? undefined,
    lockedAt:    override.lockedAt ?? null,
    lockedBy:    override.lockedBy ?? null,
    lockReason:  override.lockReason ?? null,
    unlockedAt:  override.unlockedAt ?? null,
    settledAt:   override.settledAt ?? null,
    kickoffUtc:  override.kickoffUtc ?? m.kickoffUtc,
    date:        override.date ?? m.date,
    time:        override.time ?? m.time,
  }
}

/**
 * Mescla a lista estática de partidas (wc2026.ts) com os overrides de status
 * vindos do Supabase. Se um match_code existir no banco, o status, placar e
 * minuto ao vivo do banco prevalecem sobre os dados estáticos.
 *
 * Isso garante que o admin pode abrir/fechar apostas e registrar placares
 * sem precisar alterar o arquivo wc2026.ts.
 */
export function useMatchesWithStatus(staticMatches: Match[]): Match[] {
  const { overrides, isLoaded, init } = useMatchStore()

  useEffect(() => { init() }, [init])

  return useMemo(() => {
    if (!isLoaded) return staticMatches
    return staticMatches.map(m => {
      const override = overrides[m.id]
      return override ? merge(m, override) : m
    })
  }, [staticMatches, overrides, isLoaded])
}

/**
 * Versão single-match — para usar dentro de componentes de detalhe.
 */
export function useMatchWithStatus(match: Match): Match {
  const { overrides, isLoaded, init } = useMatchStore()

  useEffect(() => { init() }, [init])

  return useMemo(() => {
    if (!isLoaded) return match
    const override = overrides[match.id]
    return override ? merge(match, override) : match
  }, [match, overrides, isLoaded])
}
