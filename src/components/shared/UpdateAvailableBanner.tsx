import { useEffect, useRef, useState } from 'react'

// Widget "site atualizado". Sem backend: a cada build os assets do index.html
// mudam de hash. Guardamos a "assinatura" do index.html que estava no ar quando
// o app carregou e ficamos checando (polling leve + ao voltar pra aba). Se mudar,
// houve deploy novo → o app se atualiza sozinho em momentos seguros (e mostra um
// botão pra atualizar na hora, como atalho).
export function UpdateAvailableBanner() {
  const [stale, setStale] = useState(false)
  const staleRef = useRef(false)
  const reloadedRef = useRef(false)

  useEffect(() => {
    let current: string | null = null
    let cancelled = false

    const signature = async (): Promise<string | null> => {
      try {
        const base = import.meta.env.BASE_URL || '/'
        const res = await fetch(`${base}index.html?v=${Date.now()}`, { cache: 'no-store' })
        if (!res.ok) return null
        const html = await res.text()
        const assets = html.match(/assets\/[\w.-]+\.(?:js|css)/g)
        return assets ? assets.sort().join('|') : html
      } catch {
        return null
      }
    }

    // Recarrega no máximo uma vez. Os gatilhos abaixo só disparam em momentos
    // seguros — nunca no meio de um palpite que ainda não foi salvo.
    const reloadNow = () => {
      if (reloadedRef.current) return
      reloadedRef.current = true
      window.location.reload()
    }

    const markStale = () => {
      if (staleRef.current) return
      staleRef.current = true
      setStale(true)
      // Aba em segundo plano → atualiza já; quando a pessoa voltar já está nova.
      if (document.visibilityState === 'hidden') reloadNow()
    }

    const check = async () => {
      const sig = await signature()
      if (cancelled || !sig) return
      if (current === null) current = sig
      else if (sig !== current) markStale()
    }

    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      // Voltou pra aba: se já tem versão nova, atualiza; senão, checa agora.
      if (staleRef.current) reloadNow()
      else check()
    }
    // Trocar de tela (HashRouter = mudança de hash) é um intervalo natural e
    // seguro pra recarregar sem atrapalhar nada que esteja em andamento.
    const onNavigate = () => { if (staleRef.current) reloadNow() }

    check()
    const id = window.setInterval(check, 90_000)
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('hashchange', onNavigate)
    return () => {
      cancelled = true
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('hashchange', onNavigate)
    }
  }, [])

  if (!stale) return null

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[95] flex justify-center px-3"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 4.5rem)' }}
    >
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="flex items-center gap-2 rounded-full border-2 border-ink bg-yellow px-4 py-2.5 font-mono text-[11px] font-bold tracking-eyebrow text-[#0D0D0D] shadow-btn active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
      >
        <span className="inline-block animate-spin" style={{ animationDuration: '2.4s' }}>↻</span>
        NOVA VERSÃO · TOQUE PRA ATUALIZAR
      </button>
    </div>
  )
}
