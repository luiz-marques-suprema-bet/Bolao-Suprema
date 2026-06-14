import { useEffect, useState } from 'react'

// Widget "site atualizado". Sem backend: a cada build os assets do index.html
// mudam de hash. Guardamos a "assinatura" do index.html que estava no ar quando
// o app carregou e ficamos checando (polling leve + ao voltar pra aba). Se mudar,
// houve deploy novo → mostra um botão pra recarregar (location.reload).
export function UpdateAvailableBanner() {
  const [stale, setStale] = useState(false)

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

    const check = async () => {
      const sig = await signature()
      if (cancelled || !sig) return
      if (current === null) current = sig
      else if (sig !== current) setStale(true)
    }

    check()
    const id = window.setInterval(check, 90_000)
    const onVisible = () => { if (document.visibilityState === 'visible') check() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { cancelled = true; clearInterval(id); document.removeEventListener('visibilitychange', onVisible) }
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
