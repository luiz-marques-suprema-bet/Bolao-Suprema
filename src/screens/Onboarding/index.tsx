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
    kicker: 'Copa do Mundo 2026',
    body: 'Palpite nos jogos, monte sua chave e dispute com toda a firma quem manja mais de bola.',
  },
  {
    eyebrow: '02 · COMO PONTUAR',
    stamp: 'AO VIVO',
    head: ['PALPITA,', 'PONTUA,', 'DOMINA'],
    kicker: 'Cada jogo, novos pontos',
    body: 'Placar exato? +10 pts. Acertou o resultado? +5 pts. Apostou no campeão? +25 pts. É a Copa toda valendo.',
  },
  {
    eyebrow: '03 · BORA',
    stamp: '11 JUN',
    head: ['72 JOGOS,', '48 SELEÇÕES,', '1 CAMPEÃO'],
    kicker: 'Fase de grupos a partir de 11 Jun · 16:00 BRT',
    body: 'Cria seu perfil, faz suas apostas gerais e entra na disputa. Quem sabe mais de futebol aqui?',
  },
]

const MARQUEE_ITEMS = [
  'COPA DO MUNDO 2026',
  'USA · CAN · MEX',
  '48 SELEÇÕES',
  '72 JOGOS NA FASE DE GRUPOS',
  'APOSTAS ABERTAS',
  'FASE DE GRUPOS · 11 JUN · 16:00 BRT',
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
      <div className="relative h-72 overflow-hidden flex-shrink-0">
        <img
          src={asset('assets/hero-jogadores.webp')}
          alt="Copa do Mundo 2026"
          className="w-full h-full object-cover object-top"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-paper" />
        <div className="absolute bottom-4 left-4">
          <Stamp color="#FFCB05" rotation={-2}>{slide.stamp}</Stamp>
        </div>
        <div className="absolute top-4 right-4">
          <Logo height={44} />
        </div>
      </div>

      <div className="flex-1 flex flex-col px-5 pt-2 pb-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="flex-1"
          >
            <p className="font-mono text-[10px] font-bold tracking-eyebrow text-ink-3 mb-3">
              {slide.eyebrow}
            </p>
            <h1 className="font-display text-5xl leading-none mb-1">
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
            <p className="font-serif-it text-green-deep text-lg mb-3">{slide.kicker}</p>
            <p className="text-ink-2 text-[14px] leading-relaxed">{slide.body}</p>
          </motion.div>
        </AnimatePresence>

        <div className="flex gap-1.5 mb-4">
          {slides.map((_, i) => (
            <div
              key={i}
              className="h-0.5 flex-1 transition-colors duration-300"
              style={{ background: i <= step ? '#0D0D0D' : '#A9A89F' }}
            />
          ))}
        </div>

        <div className="flex gap-2">
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
            <button onClick={() => { localStorage.setItem('bolao-visited', '1'); navigate('/login') }} className="btn-yellow flex-1">
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
      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-col justify-between p-12 flex-1 max-w-[52%]">
          <div>
            <Logo height={72} />
            <div className="mt-16">
              <TourneyMark size="sm" className="mb-4 block" />
              <p className="font-serif-it text-green-deep text-2xl mb-4">
                Copa do Mundo 2026
              </p>
              <h1 className="font-display leading-none mb-6" style={{ fontSize: 'clamp(72px, 8vw, 120px)' }}>
                <span className="block">O BOLÃO</span>
                <span className="block text-green-deep" style={{ transform: 'translateX(12px)' }}>DA</span>
                <span className="block">SUPREMA</span>
              </h1>
                      <p className="text-ink-2 text-lg leading-relaxed max-w-md">
                Palpite nos jogos, monte sua chave e dispute com toda a firma quem manja mais de bola.
              </p>
            </div>
          </div>

          <div>
            <div className="grid grid-cols-4 gap-4 mb-8 border-t border-hairline pt-6">
              {[
                { val: '72',    label: 'na fase de grupos' },
                { val: '48',    label: 'seleções' },
                { val: '16:00', label: '11 Jun · BRT' },
                { val: '+25',   label: 'pts campeão' },
              ].map(({ val, label }) => (
                <div key={label}>
                  <div className="font-display text-4xl">{val}</div>
                  <div className="font-mono text-[10px] tracking-eyebrow text-ink-3">{label}</div>
                </div>
              ))}
            </div>
            <button onClick={() => { localStorage.setItem('bolao-visited', '1'); navigate('/login') }} className="btn-yellow w-full justify-center text-base">
              ENTRAR NO BOLÃO →
            </button>
          </div>
        </div>

        <div className="relative flex-1 overflow-hidden">
          <img
            src={asset('assets/hero-jogadores.webp')}
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

      <div className="border-t border-line bg-paper-white">
        <Marquee items={MARQUEE_ITEMS} color="#0D0D0D" bg="#FFF8E8" speed={30} />
      </div>
    </div>
  )
}
