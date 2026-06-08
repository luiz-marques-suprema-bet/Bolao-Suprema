import { useState, useEffect, KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Logo } from '@/components/shared/Logo'
import { TourneyMark } from '@/components/shared/TourneyMark'
import { useAuthStore } from '@/stores/auth.store'
import { useIsDesktop } from '@/hooks/useBreakpoint'
import { useForceLightMode } from '@/hooks/useForceLightMode'
import { isAllowedCorporateEmail, isPasswordLoginEmail } from '@/lib/emailDomains'
import { asset } from '@/lib/utils'

// ─── OTP logic (shared) ───────────────────────────────────────────────────────

type Step = 'email' | 'code'

const OTP_COOLDOWN_SECONDS = 60

function getOtpCooldownKey(email: string) {
  return `bolao-otp-cooldown:${email.trim().toLowerCase()}`
}

function getOtpCooldownLeft(email: string) {
  if (!email || typeof window === 'undefined') return 0
  const until = Number(window.localStorage.getItem(getOtpCooldownKey(email)))
  if (!Number.isFinite(until)) return 0
  const left = Math.ceil((until - Date.now()) / 1000)
  return Math.max(0, left)
}

function startOtpCooldown(email: string) {
  if (typeof window === 'undefined') return OTP_COOLDOWN_SECONDS
  const until = Date.now() + OTP_COOLDOWN_SECONDS * 1000
  window.localStorage.setItem(getOtpCooldownKey(email), String(until))
  return OTP_COOLDOWN_SECONDS
}

function useOtpFlow() {
  const { sendOtp, verifyOtp, signInWithPassword, rememberMe, setRememberMe } = useAuthStore()
  const navigate = useNavigate()

  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [password, setPassword] = useState('')
  const [passwordMode, setPasswordMode] = useState(false)

  // Cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return
    const t = setTimeout(() => setResendCooldown(getOtpCooldownLeft(email)), 1000)
    return () => clearTimeout(t)
  }, [email, resendCooldown])

  useEffect(() => {
    setResendCooldown(getOtpCooldownLeft(email))
  }, [email])

  const canSendEmail = isAllowedCorporateEmail(email)
  const codeComplete = code.length >= 6
  const showPasswordOption = isPasswordLoginEmail(email)

  const handleSendOtp = async () => {
    const activeCooldown = getOtpCooldownLeft(email)
    if (activeCooldown > 0) {
      setResendCooldown(activeCooldown)
      return
    }
    if (!canSendEmail || loading) return
    setLoading(true)
    setError('')
    const res = await sendOtp(email.trim())
    setLoading(false)
    if (res.error) {
      setError(res.error)
    } else {
      setStep('code')
      setResendCooldown(startOtpCooldown(email))
    }
  }

  const handleVerify = async () => {
    if (!codeComplete || loading) return
    setLoading(true)
    setError('')
    const res = await verifyOtp(email.trim(), code)
    setLoading(false)
    if (res.error) {
      setError(res.error)
      setCode('')
    } else {
      navigate('/home', { replace: true })
    }
  }

  const handleResend = async () => {
    const activeCooldown = getOtpCooldownLeft(email)
    if (activeCooldown > 0) {
      setResendCooldown(activeCooldown)
      return
    }
    if (loading) return
    setLoading(true)
    setError('')
    const res = await sendOtp(email.trim())
    setLoading(false)
    if (res.error) setError(res.error)
    else setResendCooldown(startOtpCooldown(email))
  }

  const handleBack = () => {
    setStep('email')
    setCode('')
    setError('')
  }

  const handlePasswordLogin = async () => {
    if (!password || loading) return
    setLoading(true)
    setError('')
    const res = await signInWithPassword(email.trim(), password)
    setLoading(false)
    if (res.error) {
      setError(res.error)
    } else {
      navigate('/home', { replace: true })
    }
  }

  return {
    step, email, setEmail, code, setCode,
    error, loading, canSendEmail, codeComplete,
    resendCooldown, rememberMe, setRememberMe,
    handleSendOtp, handleVerify, handleResend, handleBack,
    password, setPassword, passwordMode, setPasswordMode,
    showPasswordOption, handlePasswordLogin,
  }
}

// ─── Code input — aceita qualquer tamanho de OTP ──────────────────────────────

function CodeInput({
  value,
  onChange,
  onSubmit,
  light,
}: {
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
  light?: boolean
}) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.replace(/\D/g, '').slice(0, 8)
    onChange(v)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && value.length >= 6) onSubmit()
  }

  const base = light
    ? 'border-line-strong bg-card text-ink focus:border-yellow caret-yellow placeholder:text-ink-4'
    : 'border-line bg-paper-deep text-ink focus:border-ink caret-ink placeholder:text-ink-4'

  return (
    <input
      type="text"
      inputMode="numeric"
      autoFocus
      autoComplete="one-time-code"
      value={value}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      placeholder="●●●●●●●●"
      className={`w-full text-center font-display text-4xl tracking-[0.25em] border-2 outline-none transition-colors py-4 ${base}`}
    />
  )
}

// ─── Screen router ────────────────────────────────────────────────────────────

export function LoginScreen() {
  useForceLightMode()
  const isDesktop = useIsDesktop()
  return isDesktop ? <LoginDesktop /> : <LoginMobile />
}

// ─── Mobile ───────────────────────────────────────────────────────────────────

function LoginMobile() {
  const f = useOtpFlow()

  return (
    <div className="min-h-dvh flex flex-col relative bg-paper text-ink">
      <div className="absolute inset-x-0 top-0 h-[48%] overflow-hidden">
        <img
          src={asset('assets/hero-portrait.png')}
          alt=""
          className="w-full h-full object-cover object-center opacity-55"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-ink/35 via-paper/25 to-paper" />
      </div>

      <div className="relative flex-1 flex flex-col justify-end p-5 pb-10">
        <div className="mb-8 border border-hairline bg-card/95 rounded-xl px-4 py-2 self-start shadow-card">
          <Logo height={44} />
        </div>

        <AnimatePresence mode="wait">
          {f.step === 'email' ? (
            <motion.div
              key="email"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
            >
              <h1 className="font-display text-5xl text-ink leading-none mb-2">
                ACESSO<br />RESTRITO
              </h1>
              <p className="font-serif-it text-green-deep text-lg mb-8">
                só pra galera da firma
              </p>

              <div className="mb-3">
                <p className="font-mono text-[9px] tracking-eyebrow text-ink-3 mb-1.5">
                  E-MAIL CORPORATIVO
                </p>
                <input
                  type="email"
                  value={f.email}
                  onChange={e => f.setEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && f.handleSendOtp()}
                  placeholder="seu.email@empresa.com"
                  autoFocus
                  autoComplete="email"
                  className="w-full bg-card border border-line focus:border-ink px-3 py-3 font-sans text-[14px] text-ink placeholder:text-ink-4 outline-none transition-colors"
                />
              </div>

              {f.error && (
                <p className="font-mono text-[11px] text-red bg-red/10 border border-red/20 px-3 py-2 mb-3">
                  {f.error}
                </p>
              )}

              <button
                onClick={f.handleSendOtp}
                disabled={!f.canSendEmail || f.loading || f.resendCooldown > 0}
                className="btn-yellow w-full justify-center disabled:opacity-50"
              >
                {f.loading ? 'ENVIANDO…' : f.resendCooldown > 0 ? `AGUARDE ${f.resendCooldown}S` : 'RECEBER CÓDIGO →'}
              </button>

              <label className="flex items-center gap-2 mt-4 cursor-pointer">
                <input
                  type="checkbox"
                  checked={f.rememberMe}
                  onChange={e => f.setRememberMe(e.target.checked)}
                  className="w-4 h-4 accent-yellow"
                />
                <span className="font-mono text-[10px] text-ink-3">Manter conectado</span>
              </label>

              {f.showPasswordOption && (
                f.passwordMode ? (
                  <div className="mt-5 border-t border-hairline pt-4">
                    <p className="font-mono text-[9px] tracking-eyebrow text-ink-3 mb-1.5">SENHA</p>
                    <input
                      type="password"
                      value={f.password}
                      onChange={e => f.setPassword(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && f.handlePasswordLogin()}
                      placeholder="••••••••"
                      autoFocus
                      autoComplete="current-password"
                      className="w-full bg-card border border-line focus:border-ink px-3 py-3 font-sans text-[14px] text-ink placeholder:text-ink-4 outline-none transition-colors"
                    />
                    <button
                      onClick={f.handlePasswordLogin}
                      disabled={!f.password || f.loading}
                      className="btn-yellow w-full justify-center disabled:opacity-50 mt-3"
                    >
                      {f.loading ? 'ENTRANDO…' : 'ENTRAR COM SENHA →'}
                    </button>
                    <button
                      onClick={() => f.setPasswordMode(false)}
                      className="font-mono text-[10px] text-ink-4 hover:text-ink text-center w-full mt-3 transition-colors"
                    >
                      USAR CÓDIGO POR E-MAIL
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => f.setPasswordMode(true)}
                    className="font-mono text-[10px] text-ink-3 hover:text-ink underline underline-offset-2 mt-4 transition-colors"
                  >
                    Entrar com senha
                  </button>
                )
              )}

              <p className="font-mono text-[10px] text-ink-4 tracking-eyebrow text-center mt-5">
                ACESSO RESTRITO À SUPREMA GAMING · USO INTERNO
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="code"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <button
                onClick={f.handleBack}
                className="font-mono text-[10px] text-ink-3 hover:text-ink mb-6 flex items-center gap-1"
              >
                ← VOLTAR
              </button>

              <h1 className="font-display text-4xl text-ink leading-none mb-2">
                CÓDIGO<br />ENVIADO
              </h1>
              <p className="font-serif-it text-green-deep text-base mb-1">
                verifique seu e-mail
              </p>
              <p className="font-mono text-[10px] text-ink-3 mb-6 truncate">
                {f.email}
              </p>

              <div className="mb-4">
                <p className="font-mono text-[9px] tracking-eyebrow text-ink-3 mb-2">
                  CÓDIGO DO E-MAIL
                </p>
                <CodeInput
                  value={f.code}
                  onChange={f.setCode}
                  onSubmit={f.handleVerify}
                  light
                />
              </div>

              {f.error && (
                <p className="font-mono text-[11px] text-red bg-red/10 border border-red/20 px-3 py-2 mb-3">
                  {f.error}
                </p>
              )}

              <button
                onClick={f.handleVerify}
                disabled={!f.codeComplete || f.loading}
                className="btn-yellow w-full justify-center disabled:opacity-50 mb-4"
              >
                {f.loading ? 'VERIFICANDO…' : 'ENTRAR →'}
              </button>

              <button
                onClick={f.handleResend}
                disabled={f.resendCooldown > 0 || f.loading}
                className="font-mono text-[10px] text-ink-4 hover:text-ink disabled:opacity-40 text-center w-full transition-colors"
              >
                {f.resendCooldown > 0
                  ? `REENVIAR EM ${f.resendCooldown}S`
                  : 'NÃO RECEBEU? REENVIAR CÓDIGO'}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

// ─── Desktop ──────────────────────────────────────────────────────────────────

function LoginDesktop() {
  const f = useOtpFlow()

  return (
    <div className="min-h-dvh flex bg-paper">
      {/* Left — Photo */}
      <div className="relative flex-1 hidden lg:flex flex-col justify-end p-10 overflow-hidden">
        <img
          src={asset('assets/hero-portrait.png')}
          alt=""
          className="absolute inset-0 w-full h-full object-cover object-[30%_center]"
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
      <div className="w-full lg:w-[480px] flex flex-col justify-center px-10 py-12 bg-paper overflow-hidden">
        <Logo height={72} className="mb-8" />
        <TourneyMark size="sm" className="mb-6 block" />

        <AnimatePresence mode="wait">
          {f.step === 'email' ? (
            <motion.div
              key="email"
              initial={{ opacity: 0, x: -24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 24 }}
              transition={{ duration: 0.2 }}
            >
              <h1 className="font-display text-5xl leading-none mb-2">
                ENTRAR<br />NO BOLÃO
              </h1>
              <p className="font-serif-it text-green-deep text-xl mb-8">
                só pra galera da Suprema
              </p>

              <div className="mb-4">
                <p className="font-mono text-[9px] tracking-eyebrow text-ink-4 mb-1.5">
                  E-MAIL CORPORATIVO
                </p>
                <input
                  type="email"
                  value={f.email}
                  onChange={e => f.setEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && f.handleSendOtp()}
                  placeholder="seu.email@empresa.com"
                  autoFocus
                  autoComplete="email"
                  className="w-full bg-paper-deep border border-line focus:border-ink px-3 py-3 font-sans text-[14px] outline-none transition-colors placeholder:text-ink-4"
                />
                <p className="font-mono text-[9px] text-ink-4 mt-1.5">
                  Você receberá um código de acesso por e-mail.
                </p>
              </div>

              {f.error && (
                <p className="font-mono text-[11px] text-red bg-red/10 border border-red/30 px-3 py-2 mb-4">
                  {f.error}
                </p>
              )}

              <button
                onClick={f.handleSendOtp}
                disabled={!f.canSendEmail || f.loading || f.resendCooldown > 0}
                className="btn-yellow w-full justify-center disabled:opacity-50"
              >
                {f.loading ? 'ENVIANDO…' : f.resendCooldown > 0 ? `AGUARDE ${f.resendCooldown}S` : 'RECEBER CÓDIGO →'}
              </button>

              <label className="flex items-center gap-2 mt-4 cursor-pointer">
                <input
                  type="checkbox"
                  checked={f.rememberMe}
                  onChange={e => f.setRememberMe(e.target.checked)}
                  className="w-4 h-4 accent-yellow"
                />
                <span className="font-mono text-[10px] text-ink-4">Manter conectado</span>
              </label>

              {f.showPasswordOption && (
                f.passwordMode ? (
                  <div className="mt-5 border-t border-hairline pt-4">
                    <p className="font-mono text-[9px] tracking-eyebrow text-ink-4 mb-1.5">SENHA</p>
                    <input
                      type="password"
                      value={f.password}
                      onChange={e => f.setPassword(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && f.handlePasswordLogin()}
                      placeholder="••••••••"
                      autoFocus
                      autoComplete="current-password"
                      className="w-full bg-paper-deep border border-line focus:border-ink px-3 py-3 font-sans text-[14px] outline-none transition-colors placeholder:text-ink-4"
                    />
                    <button
                      onClick={f.handlePasswordLogin}
                      disabled={!f.password || f.loading}
                      className="btn-yellow w-full justify-center disabled:opacity-50 mt-3"
                    >
                      {f.loading ? 'ENTRANDO…' : 'ENTRAR COM SENHA →'}
                    </button>
                    <button
                      onClick={() => f.setPasswordMode(false)}
                      className="font-mono text-[10px] text-ink-4 hover:text-ink text-center w-full mt-3 transition-colors"
                    >
                      USAR CÓDIGO POR E-MAIL
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => f.setPasswordMode(true)}
                    className="font-mono text-[10px] text-ink-4 hover:text-ink underline underline-offset-2 mt-4 transition-colors"
                  >
                    Entrar com senha
                  </button>
                )
              )}

              <p className="font-mono text-[10px] text-ink-4 text-center mt-4">
                Acesso restrito a colaboradores da Suprema Gaming.
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="code"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.2 }}
            >
              <button
                onClick={f.handleBack}
                className="font-mono text-[10px] text-ink-4 hover:text-ink mb-8 flex items-center gap-1"
              >
                ← VOLTAR
              </button>

              <h1 className="font-display text-5xl leading-none mb-2">
                CÓDIGO<br />ENVIADO
              </h1>
              <p className="font-serif-it text-green-deep text-xl mb-2">
                verifique seu e-mail
              </p>
              <p className="font-mono text-[10px] text-ink-4 mb-6 truncate">
                {f.email}
              </p>

              <div className="mb-4">
                <p className="font-mono text-[9px] tracking-eyebrow text-ink-4 mb-2">
                  CÓDIGO DO E-MAIL
                </p>
                <CodeInput
                  value={f.code}
                  onChange={f.setCode}
                  onSubmit={f.handleVerify}
                />
              </div>

              {f.error && (
                <p className="font-mono text-[11px] text-red bg-red/10 border border-red/30 px-3 py-2 mb-4">
                  {f.error}
                </p>
              )}

              <button
                onClick={f.handleVerify}
                disabled={!f.codeComplete || f.loading}
                className="btn-yellow w-full justify-center disabled:opacity-50 mb-4"
              >
                {f.loading ? 'VERIFICANDO…' : 'ENTRAR NO BOLÃO →'}
              </button>

              <button
                onClick={f.handleResend}
                disabled={f.resendCooldown > 0 || f.loading}
                className="font-mono text-[10px] text-ink-4 hover:text-ink disabled:opacity-40 text-center w-full transition-colors"
              >
                {f.resendCooldown > 0
                  ? `REENVIAR EM ${f.resendCooldown}S`
                  : 'NÃO RECEBEU? REENVIAR CÓDIGO'}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
