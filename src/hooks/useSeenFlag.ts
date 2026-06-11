import { useCallback, useState } from 'react'

/**
 * Flag persistente "já vi isto" em localStorage. Útil para selos de "NOVO" que
 * devem sumir para sempre depois do primeiro clique (por navegador/dispositivo).
 *
 * Retorna [seen, markSeen]. `seen` começa lendo o localStorage; `markSeen`
 * grava e atualiza o estado para o selo sumir na hora.
 */
export function useSeenFlag(key: string): [boolean, () => void] {
  const [seen, setSeen] = useState<boolean>(() => {
    try {
      return localStorage.getItem(key) === '1'
    } catch {
      return false
    }
  })

  const markSeen = useCallback(() => {
    try {
      localStorage.setItem(key, '1')
    } catch {
      /* localStorage indisponível — ignora */
    }
    setSeen(true)
  }, [key])

  return [seen, markSeen]
}
