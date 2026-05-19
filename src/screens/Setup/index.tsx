import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Avatar } from '@/components/shared/Avatar'
import { Logo } from '@/components/shared/Logo'
import { TeamSearchPicker } from '@/components/shared/TeamSearchPicker'
import { useAuthStore } from '@/stores/auth.store'
import { searchPlayers } from '@/lib/thesportsdb'
import { AVATAR_COLORS, getInitials } from '@/lib/utils'
import type { PlayerResult } from '@/lib/thesportsdb'
import type { TeamCode } from '@/types'

// ─── Inline player picker (reusar lógica do Profile) ─────────────────────────

function SetupPlayerPicker({
  value, imgUrl, onChange,
}: {
  value: string
  imgUrl?: string
  onChange: (name: string, img: string | undefined) => void
}) {
  const [query, setQuery]     = useState(value)
  const [results, setResults] = useState<PlayerResult[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen]       = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const search = (q: string) => {
    clearTimeout(timer.current)
    if (!q.trim()) { setResults([]); setOpen(false); return }
    timer.current = setTimeout(async () => {
      setLoading(true)
      const res = await searchPlayers(q)
      setResults(res)
      setLoading(false)
      setOpen(res.length > 0)
    }, 500)
  }

  const select = (p: PlayerResult) => {
    setQuery(p.strPlayer)
    setOpen(false)
    onChange(p.strPlayer, p.strCutout ?? p.strThumb ?? undefined)
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        {imgUrl && (
          <div className="w-10 h-12 flex-shrink-0 overflow-hidden rounded-sm bg-paper-deep border border-hairline">
            <img src={imgUrl} alt="" className="w-full h-full object-contain object-bottom" />
          </div>
        )}
        <div className="flex-1 relative">
          <input
            value={query}
            onChange={e => { setQuery(e.target.value); search(e.target.value) }}
            onFocus={() => { if (results.length) setOpen(true) }}
            onBlur={() => setTimeout(() => setOpen(false), 200)}
            placeholder="ex: Vini Jr, Mbappé, Haaland…"
            className="w-full border-2 border-ink px-3 py-2.5 font-sans text-sm bg-transparent outline-none pr-8"
          />
          {loading && (
            <span className="absolute right-2 top-1/2 -translate-y-1/2 font-mono text-[9px] text-ink-3 animate-pulse">…</span>
          )}
          {query && !loading && (
            <button type="button" onClick={() => { setQuery(''); setOpen(false); onChange('', undefined) }}
              className="absolute right-2 top-1/2 -translate-y-1/2 font-mono text-[11px] text-ink-4 hover:text-ink">✕</button>
          )}
        </div>
      </div>
      <AnimatePresence>
        {open && results.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute z-50 left-0 right-0 mt-1 bg-paper border-2 border-ink shadow-card overflow-hidden max-h-64 overflow-y-auto"
          >
            {results.map(p => (
              <button key={p.idPlayer} type="button" onMouseDown={() => select(p)}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-paper-deep transition-colors text-left border-b border-hairline last:border-b-0">
                {(p.strThumb || p.strCutout) ? (
                  <img src={p.strThumb ?? p.strCutout ?? ''} alt=""
                    className="w-9 h-9 object-cover object-top rounded-sm flex-shrink-0 bg-paper-deep" />
                ) : (
                  <div className="w-9 h-9 bg-paper-deep flex-shrink-0 rounded-sm flex items-center justify-center">
                    <span className="font-mono text-[9px] text-ink-4">?</span>
                  </div>
                )}
                <div className="min-w-0">
                  <div className="font-mono text-[12px] font-bold truncate">{p.strPlayer}</div>
                  <div className="font-mono text-[10px] text-ink-3 truncate">{p.strTeam} · {p.strNationality}</div>
                </div>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Setup Screen ─────────────────────────────────────────────────────────────

type Step = 'name' | 'photo' | 'extras'
const STEPS: Step[] = ['name', 'photo', 'extras']

export function SetupScreen() {
  const { user, updateProfile } = useAuthStore()
  const navigate = useNavigate()

  // Form state — pre-fill from any partial profile already saved
  const [step, setStep]                         = useState<Step>('name')
  const [firstName, setFirstName]               = useState(user?.firstName ?? '')
  const [lastName, setLastName]                 = useState(user?.lastName ?? '')
  const [dept, setDept]                         = useState(user?.dept ?? '')
  const [bio, setBio]                           = useState(user?.bio ?? '')
  const [avatarColor, setAvatarColor]           = useState(user?.color ?? AVATAR_COLORS[0])
  const [favoriteTeam, setFavoriteTeam]         = useState<TeamCode | undefined>(user?.favoriteTeam)
  const [favoritePlayer, setFavoritePlayer]     = useState(user?.favoritePlayer ?? '')
  const [favoritePlayerImg, setFavoritePlayerImg] = useState<string | undefined>(user?.favoritePlayerImg)

  const [photoFile, setPhotoFile]         = useState<File | null>(null)
  const [photoPreview, setPhotoPreview]   = useState<string | null>(user?.avatarUrl ?? null)
  const [bannerFile, setBannerFile]       = useState<File | null>(null)
  const [bannerPreview, setBannerPreview] = useState<string | null>(user?.bannerUrl ?? null)

  const [saving, setSaving]       = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const photoRef  = useRef<HTMLInputElement>(null)
  const bannerRef = useRef<HTMLInputElement>(null)

  const initials       = getInitials(`${firstName} ${lastName}`) || '?'
  const canProceedName = firstName.trim().length > 0 && dept.trim().length > 0
  const hasPhoto       = !!photoPreview
  const stepIdx        = STEPS.indexOf(step)

  const handlePickPhoto = (file: File) => {
    setPhotoFile(file)
    const r = new FileReader()
    r.onload = e => setPhotoPreview(e.target?.result as string)
    r.readAsDataURL(file)
  }

  const handlePickBanner = (file: File) => {
    setBannerFile(file)
    const r = new FileReader()
    r.onload = e => setBannerPreview(e.target?.result as string)
    r.readAsDataURL(file)
  }

  const handleFinish = async () => {
    setSaving(true)
    setSaveError(null)
    try {
      await updateProfile(
        {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          dept: dept.trim(),
          bio,
          color: avatarColor,
          favoriteTeam,
          favoritePlayer,
          favoritePlayerImg,
        },
        photoFile ?? undefined,
        bannerFile ?? undefined,
      )
      navigate('/home', { replace: true })
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Erro ao salvar.')
      setSaving(false)
    }
  }

  const goNext = () => setStep(STEPS[stepIdx + 1])
  const goBack = () => setStep(STEPS[stepIdx - 1])

  return (
    <div className="min-h-dvh bg-paper flex flex-col">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 pt-5 pb-4 flex-shrink-0">
        <Logo height={32} />
        {/* Progress bars */}
        <div className="flex gap-1.5">
          {STEPS.map((s, i) => (
            <div key={s} className="h-0.5 w-10 transition-colors duration-300"
              style={{ background: i <= stepIdx ? '#0D0D0D' : '#C9C5B7' }} />
          ))}
        </div>
      </div>

      {/* ── Step content ───────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">

          {/* ── Step 1: Nome & Área ──────────────────────────────────── */}
          {step === 'name' && (
            <motion.div
              key="name"
              initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.22 }}
              className="px-5 pt-6 pb-6 max-w-md mx-auto"
            >
              <p className="font-mono text-[10px] tracking-eyebrow text-ink-3 mb-2">PASSO 1 DE 3</p>
              <h1 className="font-display text-5xl leading-none mb-1">
                QUEM É<br/>
                <span className="text-green-deep">VOCÊ?</span>
              </h1>
              <p className="font-serif-it text-ink-3 text-lg mb-8">conta pra gente quem está entrando</p>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-mono text-[9px] tracking-eyebrow text-ink-3 block mb-1.5">
                      NOME <span className="text-red/70">*</span>
                    </label>
                    <input
                      value={firstName}
                      onChange={e => setFirstName(e.target.value)}
                      placeholder="Felipe"
                      autoFocus
                      className="w-full border-2 border-ink px-3 py-3 font-sans text-sm bg-transparent outline-none"
                    />
                  </div>
                  <div>
                    <label className="font-mono text-[9px] tracking-eyebrow text-ink-3 block mb-1.5">SOBRENOME</label>
                    <input
                      value={lastName}
                      onChange={e => setLastName(e.target.value)}
                      placeholder="Souza"
                      className="w-full border-2 border-ink px-3 py-3 font-sans text-sm bg-transparent outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="font-mono text-[9px] tracking-eyebrow text-ink-3 block mb-1.5">
                    ÁREA NA FIRMA <span className="text-red/70">*</span>
                  </label>
                  <input
                    value={dept}
                    onChange={e => setDept(e.target.value)}
                    placeholder="ex: Design, Engenharia, Marketing…"
                    className="w-full border-2 border-ink px-3 py-3 font-sans text-sm bg-transparent outline-none"
                  />
                </div>
              </div>
            </motion.div>
          )}

          {/* ── Step 2: Foto ─────────────────────────────────────────── */}
          {step === 'photo' && (
            <motion.div
              key="photo"
              initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.22 }}
              className="px-5 pt-6 pb-6 max-w-md mx-auto"
            >
              <p className="font-mono text-[10px] tracking-eyebrow text-ink-3 mb-2">PASSO 2 DE 3</p>
              <h1 className="font-display text-5xl leading-none mb-1">
                SUA FOTO<br/>
                <span className="text-green-deep">DE PERFIL</span>
              </h1>
              <p className="font-serif-it text-ink-3 text-lg mb-6">
                obrigatório — o pessoal precisa te reconhecer no chat
              </p>

              {/* Color dots */}
              <div className="mb-6">
                <label className="font-mono text-[9px] tracking-eyebrow text-ink-3 block mb-2">COR DO AVATAR</label>
                <div className="flex gap-2 flex-wrap">
                  {AVATAR_COLORS.map(c => (
                    <button key={c} onClick={() => setAvatarColor(c)}
                      className="w-8 h-8 rounded-full border-2 transition-transform hover:scale-110"
                      style={{ background: c, borderColor: avatarColor === c ? '#0D0D0D' : 'transparent' }} />
                  ))}
                </div>
              </div>

              {/* Big circular avatar tap target */}
              <div className="flex flex-col items-center gap-4">
                <button
                  onClick={() => photoRef.current?.click()}
                  className="relative w-36 h-36 rounded-full overflow-hidden border-4 border-ink shadow-card hover:opacity-90 transition-opacity active:scale-95"
                  style={{ background: avatarColor }}
                >
                  {photoPreview
                    ? <img src={photoPreview} alt="" className="w-full h-full object-cover" />
                    : <Avatar initials={initials} color={avatarColor} size={144} />
                  }
                  <div className="absolute inset-0 flex items-end justify-center pb-4">
                    <span className="font-mono text-[8px] tracking-eyebrow text-white bg-ink/60 px-2.5 py-1 rounded-full">
                      {hasPhoto ? 'TROCAR FOTO ✎' : '+ ESCOLHER FOTO'}
                    </span>
                  </div>
                </button>

                {hasPhoto ? (
                  <div className="flex items-center gap-2 font-mono text-[11px] text-green-deep">
                    <span>✓</span>
                    <span>Foto escolhida — ficou show!</span>
                  </div>
                ) : (
                  <p className="font-mono text-[10px] text-ink-4 text-center max-w-[220px] leading-relaxed">
                    Toque na bolinha pra escolher da galeria ou tirar uma selfie
                  </p>
                )}
              </div>

              <input
                ref={photoRef}
                type="file"
                accept="image/*"
                capture="user"
                className="hidden"
                onChange={e => e.target.files?.[0] && handlePickPhoto(e.target.files[0])}
              />
            </motion.div>
          )}

          {/* ── Step 3: Personalização ───────────────────────────────── */}
          {step === 'extras' && (
            <motion.div
              key="extras"
              initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.22 }}
              className="px-5 pt-6 pb-6 max-w-md mx-auto"
            >
              <p className="font-mono text-[10px] tracking-eyebrow text-ink-3 mb-2">PASSO 3 DE 3</p>
              <h1 className="font-display text-5xl leading-none mb-1">
                PERSONALIZA<br/>
                <span className="text-green-deep">O PERFIL</span>
              </h1>
              <p className="font-serif-it text-ink-3 text-lg mb-8">
                quase lá — o resto é opcional, mas capricha
              </p>

              <div className="space-y-5">

                {/* Banner */}
                <div>
                  <label className="font-mono text-[9px] tracking-eyebrow text-ink-3 block mb-1.5">
                    BANNER
                    <span className="ml-1.5 font-sans normal-case text-[10px] text-ink-4">(opcional)</span>
                  </label>
                  <button
                    onClick={() => bannerRef.current?.click()}
                    className="w-full h-24 border-2 border-dashed border-hairline hover:border-ink transition-colors overflow-hidden relative"
                  >
                    {bannerPreview
                      ? <img src={bannerPreview} alt="" className="w-full h-full object-cover" />
                      : (
                        <div className="h-full flex items-center justify-center"
                          style={{ background: 'linear-gradient(135deg,#0D0D0D 0%,#2a2a2a 100%)' }}>
                          <span className="font-mono text-[10px] text-ink-4 tracking-eyebrow">+ ADICIONAR BANNER</span>
                        </div>
                      )
                    }
                    {bannerPreview && (
                      <div className="absolute inset-0 bg-ink/20 opacity-0 hover:opacity-100 transition-opacity flex items-end justify-end p-2">
                        <span className="font-mono text-[8px] text-white bg-ink/50 px-2 py-0.5">TROCAR ✎</span>
                      </div>
                    )}
                  </button>
                  <input ref={bannerRef} type="file" accept="image/*" className="hidden"
                    onChange={e => e.target.files?.[0] && handlePickBanner(e.target.files[0])} />
                </div>

                {/* Bio */}
                <div>
                  <label className="font-mono text-[9px] tracking-eyebrow text-ink-3 block mb-1.5">
                    BIO DESCONTRAÍDA
                    <span className="ml-1.5 font-sans normal-case text-[10px] text-ink-4">(opcional)</span>
                  </label>
                  <textarea
                    value={bio}
                    onChange={e => setBio(e.target.value)}
                    placeholder={`ex: "Mando bem no fut 5, no bolão sou gênio"`}
                    rows={2}
                    className="w-full border-2 border-ink px-3 py-2.5 font-sans text-sm bg-transparent outline-none resize-none"
                  />
                </div>

                {/* Seleção do coração */}
                <div>
                  <label className="font-mono text-[9px] tracking-eyebrow text-ink-3 block mb-1.5">
                    SELEÇÃO DO CORAÇÃO
                    <span className="ml-1.5 font-sans normal-case text-[10px] text-ink-4">(opcional)</span>
                  </label>
                  <TeamSearchPicker value={favoriteTeam} onChange={v => setFavoriteTeam(v as TeamCode)} />
                </div>

                {/* Jogador favorito */}
                <div>
                  <label className="font-mono text-[9px] tracking-eyebrow text-ink-3 block mb-1.5">
                    JOGADOR FAVORITO
                    <span className="ml-1.5 font-sans normal-case text-[10px] text-ink-4">(opcional)</span>
                  </label>
                  <SetupPlayerPicker
                    value={favoritePlayer}
                    imgUrl={favoritePlayerImg}
                    onChange={(name, img) => { setFavoritePlayer(name); setFavoritePlayerImg(img) }}
                  />
                </div>
              </div>

              {saveError && (
                <div className="mt-4 border border-red/40 bg-red/5 px-3 py-2 font-mono text-[10px] text-red">
                  ✕ {saveError}
                </div>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* ── Footer navigation ──────────────────────────────────────────── */}
      <div className="flex-shrink-0 px-5 pb-10 pt-3 max-w-md mx-auto w-full">
        <div className="flex gap-2">
          {stepIdx > 0 && (
            <button onClick={goBack} className="btn-ghost px-4 flex-shrink-0">
              ←
            </button>
          )}

          {step === 'name' && (
            <button
              onClick={goNext}
              disabled={!canProceedName}
              className="btn-yellow flex-1 justify-center disabled:opacity-40"
            >
              PRÓXIMO →
            </button>
          )}

          {step === 'photo' && (
            <button
              onClick={goNext}
              disabled={!hasPhoto}
              className="btn-yellow flex-1 justify-center disabled:opacity-40"
            >
              {hasPhoto ? 'PRÓXIMO →' : 'ESCOLHA UMA FOTO PRIMEIRO'}
            </button>
          )}

          {step === 'extras' && (
            <button
              onClick={handleFinish}
              disabled={saving}
              className="btn-yellow flex-1 justify-center disabled:opacity-40"
            >
              {saving ? 'SALVANDO…' : 'ENTRAR NO BOLÃO →'}
            </button>
          )}
        </div>
      </div>

    </div>
  )
}
