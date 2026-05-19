import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Logo } from '@/components/shared/Logo'
import { Avatar } from '@/components/shared/Avatar'
import { Flag } from '@/components/shared/Flag'
import { Stamp } from '@/components/shared/Stamp'
import { useAuthStore } from '@/stores/auth.store'
import { usePredictionStore } from '@/stores/prediction.store'
import { useIsDesktop } from '@/hooks/useBreakpoint'
import { TEAMS } from '@/data/teams'
import { TeamSearchPicker } from '@/components/shared/TeamSearchPicker'
import { getInitials, fmtPts, AVATAR_COLORS } from '@/lib/utils'
import { searchPlayers } from '@/lib/thesportsdb'
import { supabase, isMockMode } from '@/lib/supabase'
import type { PlayerResult } from '@/lib/thesportsdb'
import type { TeamCode } from '@/types'

interface UserStats { pts: number; correct: number; exact: number; rank: number | null }

// ─── Player Picker ────────────────────────────────────────────────────────────

function PlayerPicker({
  value, imgUrl, onChange,
}: {
  value: string
  imgUrl?: string
  onChange: (name: string, img: string | undefined) => void
}) {
  const [query, setQuery] = useState(value)
  const [results, setResults] = useState<PlayerResult[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => { setQuery(value) }, [value])

  const search = useCallback((q: string) => {
    clearTimeout(timer.current)
    if (!q.trim()) { setResults([]); setOpen(false); return }
    timer.current = setTimeout(async () => {
      setLoading(true)
      const res = await searchPlayers(q)
      setResults(res)
      setLoading(false)
      setOpen(res.length > 0)
    }, 500)
  }, [])

  const select = (p: PlayerResult) => {
    setQuery(p.strPlayer)
    setOpen(false)
    setResults([])
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
                  <img src={p.strThumb ?? p.strCutout ?? ''} alt="" className="w-9 h-9 object-cover object-top rounded-sm flex-shrink-0 bg-paper-deep" />
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


// ─── Apostas gerais summary ──────────────────────────────────────────────────

function ApostasGeraisSummary({ championPick, vicePick, scorerPick, onEdit }: {
  championPick: string | null; vicePick: string | null; scorerPick: string | null; onEdit: () => void
}) {
  const allSet = championPick && vicePick && scorerPick
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="font-mono text-[10px] tracking-eyebrow text-ink-3">APOSTAS GERAIS</p>
        <button onClick={onEdit} className="font-mono text-[10px] text-ink-4 hover:text-ink tracking-eyebrow">
          {allSet ? 'ALTERAR →' : 'FAZER →'}
        </button>
      </div>
      {allSet ? (
        <div className="grid grid-cols-3 gap-2">
          <div className="border-2 border-green/60 bg-green/5 p-2 flex flex-col items-center gap-1 text-center">
            <Flag team={TEAMS[championPick!]} size={22} />
            <span className="font-mono text-[7px] text-ink-3 tracking-eyebrow">CAMPEÃO</span>
            <span className="font-mono text-[8px] font-bold">{TEAMS[championPick!]?.code}</span>
          </div>
          <div className="border-2 border-hairline p-2 flex flex-col items-center gap-1 text-center">
            <Flag team={TEAMS[vicePick!]} size={22} />
            <span className="font-mono text-[7px] text-ink-3 tracking-eyebrow">VICE</span>
            <span className="font-mono text-[8px] font-bold">{TEAMS[vicePick!]?.code}</span>
          </div>
          <div className="border-2 border-hairline p-2 flex flex-col items-center justify-center text-center gap-0.5">
            <span className="font-mono text-[9px] font-bold leading-tight">{scorerPick}</span>
            <span className="font-mono text-[7px] text-ink-3 tracking-eyebrow">ARTILHEIRO</span>
          </div>
        </div>
      ) : (
        <div className="border-2 border-dashed border-hairline p-3 flex items-center justify-between gap-3">
          <p className="font-mono text-[11px] text-ink-3 leading-relaxed">
            Obrigatório antes de 11 Jun. Vale +50 pts no total.
          </p>
          <button onClick={onEdit} className="btn-yellow text-[10px] px-3 py-2 flex-shrink-0">FAZER →</button>
        </div>
      )}
    </div>
  )
}

// ─── Form hook ───────────────────────────────────────────────────────────────

function useProfileForm() {
  const { user, updateProfile, signOut } = useAuthStore()
  const { championPick, vicePick, scorerPick, clearAllPredictions } = usePredictionStore()
  const navigate = useNavigate()

  const [firstName, setFirstName]               = useState(user?.firstName ?? '')
  const [lastName, setLastName]                 = useState(user?.lastName ?? '')
  const [dept, setDept]                         = useState(user?.dept ?? '')
  const [bio, setBio]                           = useState(user?.bio ?? '')
  const [avatarColor, setAvatarColor]           = useState(user?.color ?? '#00A651')
  const [favoriteTeam, setFavoriteTeam]         = useState<TeamCode | undefined>(user?.favoriteTeam)
  const [favoritePlayer, setFavoritePlayer]     = useState(user?.favoritePlayer ?? '')
  const [favoritePlayerImg, setFavoritePlayerImg] = useState<string | undefined>(user?.favoritePlayerImg)
  const [saving, setSaving]                     = useState(false)
  const [saveError, setSaveError]               = useState<string | null>(null)
  const [stats, setStats]                       = useState<UserStats>({ pts: 0, correct: 0, exact: 0, rank: null })

  useEffect(() => {
    if (!user?.id || isMockMode) return
    supabase
      .from('ranking_snapshots')
      .select('pts, correct, exact_score, rank')
      .eq('user_id', user.id)
      .order('snapshot_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setStats({ pts: data.pts, correct: data.correct, exact: data.exact_score, rank: data.rank })
      })
  }, [user?.id])

  const [photoFile, setPhotoFile]       = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(user?.avatarUrl ?? null)
  const [bannerFile, setBannerFile]     = useState<File | null>(null)
  const [bannerPreview, setBannerPreview] = useState<string | null>(user?.bannerUrl ?? null)

  const photoRef  = useRef<HTMLInputElement>(null)
  const bannerRef = useRef<HTMLInputElement>(null)

  const initials = getInitials(`${firstName} ${lastName}`) || user?.initials || 'FS'

  const handlePickPhoto = (file: File) => {
    setPhotoFile(file)
    const r = new FileReader(); r.onload = e => setPhotoPreview(e.target?.result as string); r.readAsDataURL(file)
  }
  const handlePickBanner = (file: File) => {
    setBannerFile(file)
    const r = new FileReader(); r.onload = e => setBannerPreview(e.target?.result as string); r.readAsDataURL(file)
  }

  const handleSave = async () => {
    setSaving(true)
    setSaveError(null)
    try {
      await updateProfile(
        { firstName, lastName, dept, bio, color: avatarColor, initials, favoriteTeam, favoritePlayer, favoritePlayerImg },
        photoFile ?? undefined,
        bannerFile ?? undefined,
      )
      navigate('/home')
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Erro ao salvar perfil.')
    } finally {
      setSaving(false)
    }
  }

  const handleSignOut = async () => { await signOut(); navigate('/login') }
  const handleClearPredictions = () => {
    if (window.confirm('Apagar todos os palpites? Esta ação não pode ser desfeita.')) clearAllPredictions()
  }

  return {
    user, firstName, setFirstName, lastName, setLastName,
    dept, setDept, bio, setBio, avatarColor, setAvatarColor,
    favoriteTeam, setFavoriteTeam,
    favoritePlayer, setFavoritePlayer, favoritePlayerImg, setFavoritePlayerImg,
    photoPreview, bannerPreview,
    photoRef, bannerRef,
    saveError,
    handlePickPhoto, handlePickBanner,
    initials, saving,
    handleSave, handleSignOut, handleClearPredictions,
    championPick, vicePick, scorerPick, stats,
  }
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export function ProfileScreen() {
  const isDesktop = useIsDesktop()
  return isDesktop ? <ProfileDesktop /> : <ProfileMobile />
}

// ─── Mobile ───────────────────────────────────────────────────────────────────

function ProfileMobile() {
  const f = useProfileForm()
  const navigate = useNavigate()

  return (
    <div className="min-h-dvh bg-paper pb-28">

      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-hairline">
        <button
          onClick={() => navigate(-1)}
          className="font-mono text-[10px] tracking-eyebrow text-ink-3 hover:text-ink transition-colors"
        >
          ← VOLTAR
        </button>
        <span className="font-mono text-[10px] tracking-eyebrow text-ink-4">MEU PERFIL</span>
        <button
          onClick={f.handleSignOut}
          className="font-mono text-[10px] tracking-eyebrow text-red/70 hover:text-red transition-colors"
        >
          DESCONECTAR
        </button>
      </div>

      {/* Banner + avatar header — avatar is OUTSIDE overflow-hidden */}
      <div className="relative">
        {/* Banner */}
        <div className="h-44 bg-ink overflow-hidden">
          {f.bannerPreview
            ? <img src={f.bannerPreview} alt="" className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#0D0D0D 0%,#2a2a2a 100%)' }} />
          }
          {/* dark overlay with edit cue */}
          <button
            onClick={() => f.bannerRef.current?.click()}
            className="absolute inset-0 flex items-end justify-end p-3 bg-gradient-to-t from-ink/60 to-transparent"
          >
            <span className="font-mono text-[8px] tracking-eyebrow text-paper/60 bg-ink/40 px-2 py-1">
              {f.bannerPreview ? 'TROCAR BANNER ✎' : '+ BANNER'}
            </span>
          </button>
          <input ref={f.bannerRef} type="file" accept="image/*" className="hidden"
            onChange={e => e.target.files?.[0] && f.handlePickBanner(e.target.files[0])} />
        </div>

        {/* Avatar — positioned relative to outer container, NOT inside overflow-hidden */}
        <div className="absolute left-4 bottom-0 translate-y-1/2 z-10">
          <button
            onClick={() => f.photoRef.current?.click()}
            className="relative w-20 h-20 rounded-full overflow-hidden border-[3px] border-paper shadow-card"
            style={{ background: f.avatarColor }}
          >
            {f.photoPreview
              ? <img src={f.photoPreview} alt="" className="w-full h-full object-cover" />
              : <Avatar initials={f.initials} color={f.avatarColor} size={80} />
            }
            <div className="absolute inset-0 bg-ink/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
              <span className="font-mono text-[7px] text-white">TROCAR</span>
            </div>
          </button>
          <input ref={f.photoRef} type="file" accept="image/*" className="hidden"
            onChange={e => e.target.files?.[0] && f.handlePickPhoto(e.target.files[0])} />
        </div>
      </div>

      {/* Name row — pt-14 leaves room for the avatar that's half-outside */}
      <div className="px-5 pt-14 pb-4 border-b border-hairline">
        <div className="font-display text-2xl leading-none">{f.firstName || 'NOME'} {f.lastName}</div>
        <div className="font-mono text-[11px] text-ink-3 mt-1">{f.dept || '—'}</div>
        {f.bio && <p className="font-sans text-[12px] text-ink-2 mt-1 leading-snug">{f.bio}</p>}
      </div>

      <div className="px-5 pt-5 space-y-5">

        {/* Color dots */}
        <div>
          <label className="font-mono text-[10px] tracking-eyebrow text-ink-3 block mb-2">COR DO AVATAR</label>
          <div className="flex gap-2 flex-wrap">
            {AVATAR_COLORS.map(c => (
              <button key={c} onClick={() => f.setAvatarColor(c)}
                className="w-8 h-8 rounded-full border-2 transition-transform hover:scale-110"
                style={{ background: c, borderColor: f.avatarColor === c ? '#0D0D0D' : 'transparent' }} />
            ))}
          </div>
        </div>

        <div>
          <label className="font-mono text-[10px] tracking-eyebrow text-ink-3 block mb-1.5">NOME</label>
          <div className="grid grid-cols-2 gap-2">
            <input value={f.firstName} onChange={e => f.setFirstName(e.target.value)} placeholder="Felipe"
              className="border-2 border-ink px-3 py-2.5 font-sans text-sm bg-transparent outline-none" />
            <input value={f.lastName} onChange={e => f.setLastName(e.target.value)} placeholder="Souza"
              className="border-2 border-ink px-3 py-2.5 font-sans text-sm bg-transparent outline-none" />
          </div>
        </div>

        <div>
          <label className="font-mono text-[10px] tracking-eyebrow text-ink-3 block mb-1.5">ÁREA NA FIRMA</label>
          <input value={f.dept} onChange={e => f.setDept(e.target.value)} placeholder="ex: Design, Engenharia…"
            className="w-full border-2 border-ink px-3 py-2.5 font-sans text-sm bg-transparent outline-none" />
        </div>

        <div>
          <label className="font-mono text-[10px] tracking-eyebrow text-ink-3 block mb-1.5">BIO</label>
          <textarea value={f.bio} onChange={e => f.setBio(e.target.value)} placeholder="Conte um pouco sobre você…"
            rows={2} className="w-full border-2 border-ink px-3 py-2.5 font-sans text-sm bg-transparent outline-none resize-none" />
        </div>

        <div>
          <label className="font-mono text-[10px] tracking-eyebrow text-ink-3 block mb-1.5">JOGADOR FAVORITO</label>
          <PlayerPicker value={f.favoritePlayer} imgUrl={f.favoritePlayerImg}
            onChange={(name, img) => { f.setFavoritePlayer(name); f.setFavoritePlayerImg(img) }} />
        </div>

        <div>
          <label className="font-mono text-[10px] tracking-eyebrow text-ink-3 block mb-2">
            SELEÇÃO DO CORAÇÃO
            {f.favoriteTeam && TEAMS[f.favoriteTeam] && (
              <span className="ml-2 text-green">· {TEAMS[f.favoriteTeam].name}</span>
            )}
          </label>
          <TeamSearchPicker value={f.favoriteTeam} onChange={f.setFavoriteTeam} />
        </div>

        <ApostasGeraisSummary
          championPick={f.championPick} vicePick={f.vicePick} scorerPick={f.scorerPick}
          onEdit={() => navigate('/prediction', { state: { tab: 'champion' } })}
        />

        {f.saveError && (
          <div className="border border-red/40 bg-red/5 px-3 py-2 font-mono text-[10px] text-red">
            ✕ {f.saveError}
          </div>
        )}
        <button onClick={f.handleSave} disabled={f.saving} className="btn-yellow w-full justify-center">
          {f.saving ? 'SALVANDO…' : 'SALVAR PERFIL →'}
        </button>

        <div className="grid grid-cols-2 gap-2">
          <button onClick={f.handleClearPredictions}
            className="py-3 font-mono text-[10px] tracking-eyebrow text-ink-4 hover:text-red transition-colors border-2 border-hairline hover:border-red">
            LIMPAR PALPITES
          </button>
          <button onClick={f.handleSignOut}
            className="py-3 font-mono text-[10px] tracking-eyebrow text-red/60 hover:text-red transition-colors border-2 border-red/30 hover:border-red">
            DESCONECTAR
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Desktop ──────────────────────────────────────────────────────────────────

function ProfileDesktop() {
  const f = useProfileForm()
  const navigate = useNavigate()

  return (
    <div className="min-h-dvh bg-paper">
      <div className="max-w-screen-lg mx-auto px-8 py-10">

        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-1.5 font-mono text-[10px] tracking-eyebrow text-ink-3 hover:text-ink transition-colors"
            >
              ← VOLTAR
            </button>
            <span className="text-hairline select-none">|</span>
            <Logo height={40} />
          </div>
          <button
            onClick={f.handleSignOut}
            className="font-mono text-[10px] tracking-eyebrow text-red/70 hover:text-red transition-colors border border-red/30 hover:border-red px-3 py-1.5 rounded"
          >
            DESCONECTAR
          </button>
        </div>

        <div className="grid grid-cols-[1fr_300px] gap-10">

          {/* Form column */}
          <div className="space-y-6">

            {/* Banner + avatar header */}
            <div className="relative">
              {/* Banner */}
              <div className="h-40 bg-ink overflow-hidden rounded-sm cursor-pointer"
                onClick={() => f.bannerRef.current?.click()}>
                {f.bannerPreview
                  ? <img src={f.bannerPreview} alt="" className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#0D0D0D 0%,#2a2a2a 100%)' }}>
                      <span className="font-mono text-[10px] text-ink-4 tracking-eyebrow">+ ADICIONAR BANNER</span>
                    </div>
                }
                <div className="absolute inset-0 bg-ink/20 opacity-0 hover:opacity-100 transition-opacity flex items-end justify-end p-3">
                  <span className="font-mono text-[9px] text-white tracking-eyebrow bg-ink/50 px-2 py-1">
                    {f.bannerPreview ? 'TROCAR BANNER ✎' : '+ BANNER'}
                  </span>
                </div>
              </div>
              <input ref={f.bannerRef} type="file" accept="image/*" className="hidden"
                onChange={e => e.target.files?.[0] && f.handlePickBanner(e.target.files[0])} />

              {/* Avatar — outside overflow-hidden */}
              <div className="absolute left-5 bottom-0 translate-y-1/2 z-10">
                <button onClick={() => f.photoRef.current?.click()}
                  className="relative w-20 h-20 rounded-full overflow-hidden border-[3px] border-paper shadow-card"
                  style={{ background: f.avatarColor }}>
                  {f.photoPreview
                    ? <img src={f.photoPreview} alt="" className="w-full h-full object-cover" />
                    : <Avatar initials={f.initials} color={f.avatarColor} size={80} />
                  }
                  <div className="absolute inset-0 bg-ink/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="font-mono text-[7px] text-white">TROCAR</span>
                  </div>
                </button>
                <input ref={f.photoRef} type="file" accept="image/*" className="hidden"
                  onChange={e => e.target.files?.[0] && f.handlePickPhoto(e.target.files[0])} />
              </div>
            </div>

            {/* Fields below banner — pt-14 for avatar */}
            <div className="pt-12 space-y-5">

              <div>
                <label className="font-mono text-[10px] tracking-eyebrow text-ink-3 block mb-2">COR DO AVATAR</label>
                <div className="flex items-center gap-3">
                  <Avatar initials={f.initials} color={f.avatarColor} size={44} />
                  <div className="flex gap-2">
                    {AVATAR_COLORS.map(c => (
                      <button key={c} onClick={() => f.setAvatarColor(c)}
                        className="w-8 h-8 rounded-full border-2 transition-transform hover:scale-110"
                        style={{ background: c, borderColor: f.avatarColor === c ? '#0D0D0D' : '#ECE6D6' }} />
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-mono text-[10px] tracking-eyebrow text-ink-3 block mb-1.5">NOME</label>
                  <input value={f.firstName} onChange={e => f.setFirstName(e.target.value)} placeholder="Felipe"
                    className="w-full border-2 border-ink px-4 py-3 font-sans text-sm bg-transparent outline-none" />
                </div>
                <div>
                  <label className="font-mono text-[10px] tracking-eyebrow text-ink-3 block mb-1.5">SOBRENOME</label>
                  <input value={f.lastName} onChange={e => f.setLastName(e.target.value)} placeholder="Souza"
                    className="w-full border-2 border-ink px-4 py-3 font-sans text-sm bg-transparent outline-none" />
                </div>
              </div>

              <div>
                <label className="font-mono text-[10px] tracking-eyebrow text-ink-3 block mb-1.5">ÁREA NA FIRMA</label>
                <input value={f.dept} onChange={e => f.setDept(e.target.value)} placeholder="ex: Design, Engenharia, Marketing…"
                  className="w-full border-2 border-ink px-4 py-3 font-sans text-sm bg-transparent outline-none" />
              </div>

              <div>
                <label className="font-mono text-[10px] tracking-eyebrow text-ink-3 block mb-1.5">BIO</label>
                <textarea value={f.bio} onChange={e => f.setBio(e.target.value)}
                  placeholder="Conte um pouco sobre você…" rows={2}
                  className="w-full border-2 border-ink px-4 py-3 font-sans text-sm bg-transparent outline-none resize-none" />
              </div>

              <div>
                <label className="font-mono text-[10px] tracking-eyebrow text-ink-3 block mb-1.5">JOGADOR FAVORITO</label>
                <PlayerPicker value={f.favoritePlayer} imgUrl={f.favoritePlayerImg}
                  onChange={(name, img) => { f.setFavoritePlayer(name); f.setFavoritePlayerImg(img) }} />
              </div>

              <div>
                <label className="font-mono text-[10px] tracking-eyebrow text-ink-3 block mb-2">
                  SELEÇÃO DO CORAÇÃO
                  {f.favoriteTeam && TEAMS[f.favoriteTeam] && (
                    <span className="ml-2 text-green normal-case">· {TEAMS[f.favoriteTeam].name}</span>
                  )}
                </label>
                <TeamSearchPicker value={f.favoriteTeam} onChange={f.setFavoriteTeam} />
              </div>

              <ApostasGeraisSummary
                championPick={f.championPick} vicePick={f.vicePick} scorerPick={f.scorerPick}
                onEdit={() => navigate('/prediction', { state: { tab: 'champion' } })}
              />

              {f.saveError && (
                <div className="border border-red/40 bg-red/5 px-3 py-2 font-mono text-[10px] text-red">
                  ✕ {f.saveError}
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button onClick={f.handleSave} disabled={f.saving}
                  className="btn-yellow flex-1 justify-center text-base">
                  {f.saving ? 'SALVANDO…' : 'SALVAR PERFIL →'}
                </button>
                <button onClick={f.handleClearPredictions}
                  className="px-4 py-3 font-mono text-[10px] tracking-eyebrow text-ink-4 hover:text-red transition-colors border-2 border-hairline hover:border-red">
                  LIMPAR PALPITES
                </button>
                <button onClick={f.handleSignOut}
                  className="px-4 py-3 font-mono text-[10px] tracking-eyebrow text-red/60 hover:text-red transition-colors border-2 border-red/30 hover:border-red">
                  DESCONECTAR
                </button>
              </div>
            </div>
          </div>

          {/* Preview card */}
          <div className="sticky top-24 self-start">
            <label className="font-mono text-[10px] tracking-eyebrow text-ink-3 block mb-3">COMO VOCÊ APARECE</label>
            <motion.div animate={{ rotate: -1 }} className="bg-paper border-2 border-ink shadow-card overflow-visible">

              {/* Banner in preview */}
              <div className="h-24 bg-ink overflow-hidden relative">
                {f.bannerPreview
                  ? <img src={f.bannerPreview} alt="" className="w-full h-full object-cover opacity-90" />
                  : <div className="w-full h-full" style={{ background: 'linear-gradient(135deg,#0D0D0D 0%,#2a2a2a 100%)' }} />
                }
              </div>

              {/* Avatar overlapping — outside overflow-hidden via relative wrapper trick */}
              <div className="relative px-4 pb-4">
                <div className="absolute -top-7 left-4">
                  <div className="w-14 h-14 rounded-full overflow-hidden border-[3px] border-paper shadow-md"
                    style={{ background: f.avatarColor }}>
                    {f.photoPreview
                      ? <img src={f.photoPreview} alt="" className="w-full h-full object-cover" />
                      : <Avatar initials={f.initials} color={f.avatarColor} size={56} />
                    }
                  </div>
                </div>

                <div className="pt-9">
                  <div className="font-display text-xl leading-none">
                    {f.firstName || 'NOME'} {f.lastName || 'SOBRENOME'}
                  </div>
                  <div className="font-mono text-[10px] text-ink-3 mt-0.5">{f.dept || 'ÁREA'}</div>
                  {f.bio && <p className="font-sans text-[11px] text-ink-2 mt-1.5 leading-snug line-clamp-2">{f.bio}</p>}

                  <div className="border-t border-hairline mt-3 pt-3 grid grid-cols-3 gap-1 text-center">
                    <div><div className="font-display text-xl">{fmtPts(f.stats.pts)}</div><div className="font-mono text-[8px] text-ink-4">PTS</div></div>
                    <div><div className="font-display text-xl">{f.stats.correct || '—'}</div><div className="font-mono text-[8px] text-ink-4">ACERTOS</div></div>
                    <div><div className="font-display text-xl">{f.stats.exact || '—'}</div><div className="font-mono text-[8px] text-ink-4">EXATOS</div></div>
                  </div>

                  {f.favoriteTeam && TEAMS[f.favoriteTeam] && (
                    <div className="mt-3 flex items-center gap-2 border-t border-hairline pt-2">
                      <Flag team={TEAMS[f.favoriteTeam]} size={14} />
                      <span className="font-mono text-[8px] text-ink-3 tracking-eyebrow truncate">
                        {TEAMS[f.favoriteTeam].name.toUpperCase()}
                      </span>
                    </div>
                  )}
                  {f.favoritePlayer && (
                    <div className="mt-1 flex items-center gap-1.5">
                      {f.favoritePlayerImg
                        ? <img src={f.favoritePlayerImg} alt="" className="w-5 h-5 object-contain object-bottom" />
                        : <span className="text-[10px]">○</span>
                      }
                      <span className="font-mono text-[8px] text-ink-3 truncate">{f.favoritePlayer}</span>
                    </div>
                  )}

                  <div className="mt-3 flex justify-between items-center">
                    <Stamp color="#6B6B66" rotation={-1}>NOVATO '26</Stamp>
                    <span className="font-mono text-[9px] text-ink-4">BOLÃO DA SUPREMA</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

        </div>
      </div>
    </div>
  )
}
