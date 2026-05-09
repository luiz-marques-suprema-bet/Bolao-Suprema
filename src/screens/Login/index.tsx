import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Logo } from '@/components/shared/Logo'
import { TourneyMark } from '@/components/shared/TourneyMark'
import { useAuthStore } from '@/stores/auth.store'
import { useIsDesktop } from '@/hooks/useBreakpoint'
import { asset } from '@/lib/utils'

export function LoginScreen() {
  const isDesktop = useIsDesktop()
  return isDesktop ? <LoginDesktop /> : <LoginMobile />
}

function useEnter() {
  const [loading, setLoading] = useState(false)
  const { signInWithEmail } = useAuthStore()
  const navigate = useNavigate()

  const handleEnter = async () => {
    setLoading(true)
    await signInWithEmail('mock@suprema.group')
    navigate('/home')
  }

  return { loading, handleEnter }
}

// ─── Mobile ───────────────────────────────────────────────────────────────────

function LoginMobile() {
  const { loading, handleEnter } = useEnter()

  return (
    <div className="min-h-dvh flex flex-col relative bg-ink">
      <div className="absolute inset-0">
        <img
          src={asset('assets/hero-portrait.webp')}
          alt=""
          className="w-full h-full object-cover object-center opacity-40"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/60 to-transparent" />
      </div>

      <div className="relative flex-1 flex flex-col justify-end p-5 pb-10">
        <Logo height={36} className="mb-8 brightness-0 invert" />

        <h1 className="font-display text-5xl text-paper leading-none mb-2">
          ACESSO<br />RESTRITO
        </h1>
        <p className="font-serif-it text-yellow text-lg mb-8">
          só pra galera da firma
        </p>

        <button
          onClick={handleEnter}
          disabled={loading}
          className="btn-yellow w-full justify-center disabled:opacity-50"
        >
          {loading ? 'ENTRANDO…' : 'ENTRAR →'}
        </button>

        <p className="font-mono text-[10px] text-paper/30 tracking-eyebrow text-center mt-6">
          ACESSO RESTRITO À SUPREMA GAMING · USO INTERNO
        </p>
      </div>
    </div>
  )
}

// ─── Desktop ──────────────────────────────────────────────────────────────────

function LoginDesktop() {
  const { loading, handleEnter } = useEnter()

  return (
    <div className="min-h-dvh flex bg-paper">
      {/* Left — Photo */}
      <div className="relative flex-1 hidden lg:flex flex-col justify-end p-10 overflow-hidden">
        <img
          src={asset('assets/hero-portrait.webp')}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/20 to-transparent" />

        <div className="relative">
          <div className="font-display text-[80px] leading-none text-paper mb-2">BOLÃO</div>
          <div className="font-serif-it text-2xl text-yellow">Copa do Mundo 2026</div>
          <div className="font-mono text-[11px] text-paper/40 mt-2 tracking-eyebrow">
            ★ USA · CAN · MEX · JUN–JUL 2026
          </div>
        </div>
      </div>

      {/* Right — Form */}
      <div className="w-full lg:w-[480px] flex flex-col justify-center px-10 py-12 bg-paper">
        <Logo height={40} className="mb-10" />

        <TourneyMark size="sm" className="mb-6 block" />

        <h1 className="font-display text-5xl leading-none mb-2">
          ENTRAR<br />NO BOLÃO
        </h1>
        <p className="font-serif-it text-green-deep text-xl mb-10">
          só pra galera da Suprema
        </p>

        <button
          onClick={handleEnter}
          disabled={loading}
          className="btn-yellow w-full justify-center disabled:opacity-50"
        >
          {loading ? 'ENTRANDO…' : 'ENTRAR →'}
        </button>

        <p className="font-mono text-[10px] text-ink-4 text-center mt-4">
          Acesso restrito a colaboradores da Suprema Gaming.
        </p>
      </div>
    </div>
  )
}
