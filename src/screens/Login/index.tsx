import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Logo } from '@/components/shared/Logo'
import { TourneyMark } from '@/components/shared/TourneyMark'
import { useAuthStore } from '@/stores/auth.store'
import { useIsDesktop } from '@/hooks/useBreakpoint'
import { MOCK_ME } from '@/data/mock'
import { asset } from '@/lib/utils'

export function LoginScreen() {
  const isDesktop = useIsDesktop()
  return isDesktop ? <LoginDesktop /> : <LoginMobile />
}

function useEnter() {
  const setUser = useAuthStore((s) => s.setUser)
  const navigate = useNavigate()

  const handleEnter = (name: string) => {
    const parts = name.trim().split(' ')
    const firstName = parts[0] || MOCK_ME.firstName
    const lastName = parts.slice(1).join(' ') || MOCK_ME.lastName
    const initials = (firstName[0] + (lastName?.[0] ?? firstName[1] ?? '')).toUpperCase()
    setUser({ ...MOCK_ME, firstName, lastName, initials })
    navigate('/home')
  }

  return { handleEnter }
}

// ─── Mobile ───────────────────────────────────────────────────────────────────

function LoginMobile() {
  const [name, setName] = useState('')
  const { handleEnter } = useEnter()

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
        <Logo height={64} className="mb-8 brightness-0 invert" />

        <h1 className="font-display text-5xl text-paper leading-none mb-2">
          ACESSO<br />RESTRITO
        </h1>
        <p className="font-serif-it text-yellow text-lg mb-8">
          só pra galera da firma
        </p>

        <div className="mb-3">
          <p className="font-mono text-[9px] tracking-eyebrow text-paper/50 mb-1.5">SEU NOME</p>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && name.trim() && handleEnter(name)}
            placeholder="Como aparecer no bolão"
            autoFocus
            className="w-full bg-paper/10 border border-paper/20 focus:border-paper/60 px-3 py-3 font-sans text-[14px] text-paper placeholder:text-paper/30 outline-none transition-colors"
          />
        </div>

        <button
          onClick={() => name.trim() && handleEnter(name)}
          disabled={!name.trim()}
          className="btn-yellow w-full justify-center disabled:opacity-50"
        >
          ENTRAR →
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
  const [name, setName] = useState('')
  const { handleEnter } = useEnter()

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
        <Logo height={80} className="mb-8" />

        <TourneyMark size="sm" className="mb-6 block" />

        <h1 className="font-display text-5xl leading-none mb-2">
          ENTRAR<br />NO BOLÃO
        </h1>
        <p className="font-serif-it text-green-deep text-xl mb-8">
          só pra galera da Suprema
        </p>

        <div className="mb-4">
          <p className="font-mono text-[9px] tracking-eyebrow text-ink-4 mb-1.5">SEU NOME</p>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && name.trim() && handleEnter(name)}
            placeholder="Como aparecer no bolão"
            autoFocus
            className="w-full bg-paper-deep border border-line focus:border-ink px-3 py-3 font-sans text-[14px] outline-none transition-colors placeholder:text-ink-4"
          />
        </div>

        <button
          onClick={() => name.trim() && handleEnter(name)}
          disabled={!name.trim()}
          className="btn-yellow w-full justify-center disabled:opacity-50"
        >
          ENTRAR →
        </button>

        <p className="font-mono text-[10px] text-ink-4 text-center mt-4">
          Acesso restrito a colaboradores da Suprema Gaming.
        </p>
      </div>
    </div>
  )
}
