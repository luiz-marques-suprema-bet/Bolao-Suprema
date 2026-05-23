import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Logo } from '@/components/shared/Logo'
import { Stamp } from '@/components/shared/Stamp'
import { Marquee } from '@/components/shared/Marquee'
import { TourneyMark } from '@/components/shared/TourneyMark'
import { useIsDesktop } from '@/hooks/useBreakpoint'
import { asset } from '@/lib/utils'

const slides = [
  {
    eyebrow: '01 · O BOLÃO',
    stamp: 'COPA 2026',
    head: ['O BOLÃO', 'DA', 'SUPREMA'],
    kicker: 'Copa do Mundo 2026 · USA, CAN & MEX',
    body: 'Palpite nos jogos, monte sua chave e dispute com toda a firma quem manja mais de bola. 48 seleções, 104 partidas, 1 campeão.',
  },
  {
    eyebrow: '02 · COMO PONTUAR',
    stamp: '+ PONTOS',
    head: ['PALPITA,', 'PONTUA,', 'DOMINA'],
    kicker: 'Cada jogo vale — fase de grupos e mata-mata',
    body: 'Placar exato: +10 pts. Resultado + 1 gol: +7 pts. Só o resultado: +5 pts. No mata-mata o exato vale +12 pts. Campeão certo: +25 pts.',
  },
  {
    eyebrow: '03 · BORA',
    stamp: '11 JUN',
    head: ['104 JOGOS,', '48 SELEÇÕES,', '1 CAMPEÃO'],
    kicker: 'Abertura: 11 Jun · 16h BRT · Azteca · MEX vs RSA',
    body: 'Cria seu perfil, faz suas apostas gerais e entra na disputa. Final em 19 de Julho. Quem sabe mais de futebol aqui?',
  },
]

const MARQUEE_ITEMS = [
  'COPA DO MUNDO 2026',
  'USA · CAN · MEX',
  '48 SELEÇÕES',
  '104 PARTIDAS',
  '72 JOGOS NA FASE DE GRUPOS',
  'APOSTAS ABERTAS',
  'ABERTURA · 11 JUN · 16H BRT · AZTECA',
  'FINAL · 19 JUL',
  'BORA JOGAR →',
]

export function OnboardingScreen() {
  const isDesktop = useIsDesktop()
  return isDesktop ? <OnboardingDesktop /> : <OnboardingMobile />
}

// ─── Mobile ───────────────────────────────────────────────────────────────────

function OnboardingMobile() {
  const [step, setStep] = useState(0)
  const navigate = useNavigate()
  const slide = slides[step]

  return (
    <div className="h-dvh flex flex-col bg-paper overflow-hidden">
      {/* Hero image — responsive height so it never squeezes out the buttons */}
      <div className="relative h-[30vh] min-h-[160px] max-h-72 overflow-hidden flex-shrink-0">
        <img
          src={asset('assets/hero-onboarding.png')}
          alt="Copa do Mundo 2026"
          className="w-full h-full object-cover object-top"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-paper" />
        <div className="absolute bottom-3 left-4">
          <Stamp color="#FFCB05" rotation={-2}>{slide.stamp}</Stamp>
        </div>
        <div className="absolute top-3 right-4">
          <Logo height={40} />
        </div>
      </div>

      {/* Content — flex-1 with min-h-0 so it takes remaining space without overflow */}
      <div className="flex-1 min-h-0 flex flex-col px-5 pt-2 pb-5">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="flex-1 min-h-0 overflow-hidden"
          >
            <p className="font-mono text-[10px] font-bold tracking-eyebrow text-ink-3 mb-2">
              {slide.eyebrow}
            </p>
            <h1 className="font-display text-4xl leading-none mb-1">
              {slide.head.map((line, i) => (
                <span
                  key={i}
                  className="block"
                  style={{
                    color: i === 1 ? '#007A3E' : undefined,
                    transform: i % 2 === 1 ? 'translateX(8px)' : undefined,
                  }}
                >
                  {line}
                </span>
              ))}
            </h1>
            <p className="font-serif-it text-green-deep text-base mb-2">{slide.kicker}</p>
            <p className="text-ink-2 text-[13px] leading-relaxed">{slide.body}</p>
          </motion.div>
        </AnimatePresence>

        {/* Progress dots */}
        <div className="flex gap-1.5 mb-3 flex-shrink-0">
          {slides.map((_, i) => (
            <div
              key={i}
              className="h-0.5 flex-1 transition-colors duration-300"
              style={{ background: i <= step ? '#0D0D0D' : '#A9A89F' }}
            />
          ))}
        </div>

        {/* Buttons — always visible, never pushed off screen */}
        <div className="flex gap-2 flex-shrink-0">
          {step > 0 && (
            <button onClick={() => setStep(step - 1)} className="btn-ghost flex-1">
              ← VOLTAR
            </button>
          )}
          {step < slides.length - 1 ? (
            <button onClick={() => setStep(step + 1)} className="btn-ink flex-1">
              PRÓXIMO →
            </button>
          ) : (
            <button
              onClick={() => { localStorage.setItem('bolao-visited', '1'); navigate('/login') }}
              className="btn-yellow flex-1"
            >
              BORA JOGAR · ENTRAR
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Desktop ──────────────────────────────────────────────────────────────────

function OnboardingDesktop() {
  const navigate = useNavigate()

  return (
    <div className="h-dvh flex flex-col bg-paper overflow-hidden">
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div className="flex flex-col justify-between p-10 xl:p-12 flex-1 max-w-[52%] overflow-y-auto no-scrollbar">
          <div>
            <Logo height={64} />
            <div className="mt-10 xl:mt-16">
              <TourneyMark size="sm" className="mb-4 block" />
              <p className="font-serif-it text-green-deep text-xl xl:text-2xl mb-3">
                Copa do Mundo 2026
              </p>
              <h1 className="font-display leading-none mb-5" style={{ fontSize: 'clamp(60px, 7vw, 112px)' }}>
                <span className="block">O BOLÃO</span>
                <span className="block text-green-deep" style={{ transform: 'translateX(12px)' }}>DA</span>
                <span className="block">SUPREMA</span>
              </h1>
              <p className="text-ink-2 text-base xl:text-lg leading-relaxed max-w-md">
                Palpite nos jogos, monte sua chave e dispute com toda a firma quem manja mais de bola.
              </p>
            </div>
          </div>

          <div>
            <div className="grid grid-cols-4 gap-3 mb-6 border-t border-hairline pt-5">
              {[
                { val: '104',   label: 'partidas' },
                { val: '48',    label: 'seleções' },
                { val: '11 JUN', label: 'abertura · 16h BRT' },
                { val: '+25',   label: 'pts campeão' },
              ].map(({ val, label }) => (
                <div key={label}>
                  <div className="font-display text-3xl xl:text-4xl">{val}</div>
                  <div className="font-mono text-[10px] tracking-eyebrow text-ink-3">{label}</div>
                </div>
              ))}
            </div>
            <button
              onClick={() => { localStorage.setItem('bolao-visited', '1'); navigate('/login') }}
              className="btn-yellow w-full justify-center text-base"
            >
              ENTRAR NO BOLÃO →
            </button>
          </div>
        </div>

        <div className="relative flex-1 overflow-hidden">
          <img
            src={asset('assets/hero-onboarding.png')}
            alt="Copa do Mundo 2026"
            className="absolute inset-0 w-full h-full object-cover object-center"
          />
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-paper to-transparent"
            style={{ width: '30%' }}
          />
          <div className="absolute bottom-8 left-8">
            <Stamp color="#FFCB05" rotation={-1}>COPA 2026</Stamp>
          </div>
        </div>
      </div>

      <div className="border-t border-line bg-paper-white flex-shrink-0">
        <Marquee items={MARQUEE_ITEMS} color="#0D0D0D" bg="#FFF8E8" speed={30} />
      </div>
    </div>
  )
}
