import { beforeEach, describe, expect, it } from 'vitest'
import { validateChampionVice } from './tournamentValidation'
import { usePredictionStore } from '@/stores/prediction.store'

describe('special pick validation', () => {
  beforeEach(() => {
    usePredictionStore.getState().resetLocalPredictionState()
    usePredictionStore.getState().setUserId(undefined)
  })

  it('allows empty, partial, same-group and cross-group champion/vice picks', () => {
    expect(validateChampionVice(null, null)).toEqual({ valid: true, error: null })
    expect(validateChampionVice('BRA', null)).toEqual({ valid: true, error: null })
    expect(validateChampionVice(null, 'MAR')).toEqual({ valid: true, error: null })
    expect(validateChampionVice('BRA', 'MAR')).toEqual({ valid: true, error: null })
    expect(validateChampionVice('BRA', 'ARG')).toEqual({ valid: true, error: null })
    expect(validateChampionVice('ARG', 'BRA')).toEqual({ valid: true, error: null })
  })

  it('rejects only identical champion and vice picks', () => {
    expect(validateChampionVice('BRA', 'BRA')).toEqual({
      valid: false,
      error: 'Campeao e vice nao podem ser a mesma selecao.',
    })
  })

  it('does not clear a valid same-group vice when champion changes', () => {
    const store = usePredictionStore.getState()

    store.setVicePick('MAR')
    store.setChampionPick('BRA')

    expect(usePredictionStore.getState().championPick).toBe('BRA')
    expect(usePredictionStore.getState().vicePick).toBe('MAR')
    expect(usePredictionStore.getState().lastError).toBeNull()
  })

  it('does not accept the same team through store setters', () => {
    const store = usePredictionStore.getState()

    store.setChampionPick('BRA')
    store.setVicePick('BRA')

    expect(usePredictionStore.getState().championPick).toBe('BRA')
    expect(usePredictionStore.getState().vicePick).toBeNull()
    expect(usePredictionStore.getState().lastError).toBe('Campeao e vice nao podem ser a mesma selecao.')
  })
})
