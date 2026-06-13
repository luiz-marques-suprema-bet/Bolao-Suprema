import { useEffect, useRef } from 'react'
import { supabase, isMockMode } from '@/lib/supabase'

// Navegadores congelam os timers de abas em segundo plano. Com isso o heartbeat
// do WebSocket do Supabase Realtime para, o servidor derruba a conexao e os
// eventos que acontecem enquanto a aba esta fora NAO sao reenviados
// (postgres_changes nao tem replay). Resultado: ao voltar pra aba, a tela fica
// congelada no ultimo estado ate um F5. Este hook resolve isso no site inteiro:
// quando a aba volta a ficar ativa, reconecta o socket e refaz o fetch.

function wakeRealtime() {
  if (isMockMode) return
  try {
    const rt = supabase.realtime as unknown as {
      isConnected?: () => boolean
      connect?: () => void
    }
    if (typeof rt?.isConnected === 'function' && !rt.isConnected()) {
      rt.connect?.()
    }
  } catch {
    // Socket interno indisponivel — o refetch abaixo ja garante a correcao.
  }
}

/**
 * Refaz o fetch (backfill) sempre que a aba volta a ficar ativa — foco da janela,
 * mudanca de visibilidade ou reconexao de rede. Acaba com o "so atualiza quando
 * eu clico": o que aconteceu enquanto a aba estava em segundo plano e recarregado
 * sozinho, sem precisar de F5.
 *
 * O callback deve ser barato e idempotente (ele apenas refaz a carga existente).
 */
export function useTabResync(onResume: () => void) {
  const cbRef = useRef(onResume)
  cbRef.current = onResume

  useEffect(() => {
    if (typeof document === 'undefined') return

    let timer: ReturnType<typeof setTimeout> | undefined

    const fire = () => {
      // Debounce: visibilitychange + focus costumam disparar quase juntos.
      clearTimeout(timer)
      timer = setTimeout(() => {
        wakeRealtime()
        cbRef.current()
      }, 250)
    }

    const onVisible = () => { if (document.visibilityState === 'visible') fire() }
    const onOnline = () => { if (document.visibilityState === 'visible') fire() }

    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', fire)
    window.addEventListener('online', onOnline)

    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', fire)
      window.removeEventListener('online', onOnline)
    }
  }, [])
}
