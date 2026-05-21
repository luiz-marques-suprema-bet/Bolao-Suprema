import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuthStore } from '@/stores/auth.store'
import { useBoletimStore } from '@/stores/boletim.store'
import { isMockMode } from '@/lib/supabase'
import { USER_MEDIA_MAX_BYTES, validateUserMediaImage, uploadBulletinImage } from '@/lib/storage'
import { SafeImage } from '@/components/shared/SafeImage'
import type { Boletim, ImageFitMode } from '@/types'

// ─── Label colour map ─────────────────────────────────────────────────────────

const LABEL_COLORS: Record<string, string> = {
  REGRAS:   'bg-ink text-paper',
  BRASIL:   'bg-green text-paper',
  AGENDA:   'bg-yellow text-ink',
  DESTAQUE: 'bg-red text-paper',
  AVISO:    'bg-yellow text-ink',
  'PRÊMIO': 'bg-green text-paper',
}
const labelColor = (l: string) => LABEL_COLORS[l.toUpperCase()] ?? 'bg-ink text-paper'

// ─── Boletim card ─────────────────────────────────────────────────────────────

export function BoletimCard({
  b,
  canEdit,
  onDelete,
  onTogglePin,
  featured = false,
}: {
  b: Boletim
  canEdit: boolean
  onDelete: (id: string) => void
  onTogglePin: (id: string) => void
  featured?: boolean
}) {
  const [expanded, setExpanded] = useState(featured)
  const date = new Date(b.createdAt).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric',
  }).toUpperCase()

  if (featured) {
    return (
      <div className="border-2 border-ink bg-ink text-paper p-6 md:p-8">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <span className={`inline-block font-mono text-[9px] tracking-eyebrow px-2 py-0.5 mb-3 ${labelColor(b.label)}`}>
              {b.label}
            </span>
            {b.isPinned && (
              <span className="inline-block font-mono text-[9px] tracking-eyebrow px-2 py-0.5 mb-3 ml-2 bg-yellow text-ink">
                · FIXADO
              </span>
            )}
            <div className="font-display text-3xl md:text-5xl leading-tight text-paper">
              {b.title.toUpperCase()}
            </div>
            {b.subtitle && (
              <div className="font-serif-it text-lg md:text-2xl text-paper/70 mt-1">
                {b.subtitle}
              </div>
            )}
          </div>
          {canEdit && (
            <div className="flex flex-col gap-1 flex-shrink-0">
              <button
                onClick={() => onTogglePin(b.id)}
                className="font-mono text-[8px] px-2 py-1 border border-paper/30 hover:border-paper text-paper/60 hover:text-paper transition-colors"
              >
                {b.isPinned ? 'DESAFIXAR' : 'FIXAR'}
              </button>
              <button
                onClick={() => onDelete(b.id)}
                className="font-mono text-[8px] px-2 py-1 border border-red/50 hover:border-red text-red/70 hover:text-red transition-colors"
              >
                EXCLUIR
              </button>
            </div>
          )}
        </div>

        {b.imageUrl && (
          <div className="w-full overflow-hidden mb-4 opacity-90" style={{ paddingBottom: '56.25%', position: 'relative' }}>
            <SafeImage src={b.imageUrl} alt={b.title} fit={b.imageFitMode ?? 'contain'} className="absolute inset-0 w-full h-full bg-ink/20" />
          </div>
        )}

        <p className="font-sans text-[14px] text-paper/80 leading-relaxed">{b.body}</p>

        <p className="font-mono text-[9px] text-paper/40 mt-4">
          {b.authorName} · {date}
        </p>
      </div>
    )
  }

  return (
    <div className="border-2 border-hairline hover:border-ink transition-colors">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full p-4 text-left"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <span className={`font-mono text-[8px] tracking-eyebrow px-1.5 py-0.5 ${labelColor(b.label)}`}>
                {b.label}
              </span>
              {b.isPinned && <span className="text-[10px] font-bold">·</span>}
            </div>
            <div className="font-display text-lg leading-tight">{b.title.toUpperCase()}</div>
            {b.subtitle && (
              <div className="font-serif-it text-sm text-ink-3 mt-0.5">{b.subtitle}</div>
            )}
          </div>
          <span className="font-mono text-[10px] text-ink-4 flex-shrink-0 mt-0.5">
            {expanded ? '▲' : '▼'}
          </span>
        </div>
        <p className="font-mono text-[9px] text-ink-4 mt-2">{b.authorName} · {date}</p>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            key="body"
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            transition={{ type: 'spring', damping: 32, stiffness: 380 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 border-t border-hairline pt-3">
              {b.imageUrl && (
                <div className="w-full overflow-hidden mb-3" style={{ paddingBottom: '56.25%', position: 'relative' }}>
                  <SafeImage src={b.imageUrl} alt={b.title} fit={b.imageFitMode ?? 'contain'} className="absolute inset-0 w-full h-full bg-paper-deep" />
                </div>
              )}
              <p className="font-sans text-[13px] text-ink-2 leading-relaxed">{b.body}</p>
              {canEdit && (
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => onTogglePin(b.id)}
                    className="font-mono text-[9px] px-3 py-1.5 border border-hairline hover:border-ink transition-colors"
                  >
                    {b.isPinned ? 'DESAFIXAR' : 'FIXAR'}
                  </button>
                  <button
                    onClick={() => onDelete(b.id)}
                    className="font-mono text-[9px] px-3 py-1.5 border border-red/30 hover:border-red text-red/70 hover:text-red transition-colors"
                  >
                    EXCLUIR
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Create modal ─────────────────────────────────────────────────────────────

const PRESET_LABELS = ['REGRAS', 'BRASIL', 'AGENDA', 'DESTAQUE', 'AVISO', 'PRÊMIO']

export type NewBoletim = Omit<Boletim, 'id' | 'createdAt'>

export function CreateModal({
  onClose,
  onCreate,
}: {
  onClose: () => void
  onCreate: (b: NewBoletim) => void
}) {
  const { user } = useAuthStore()
  const [label, setLabel] = useState('DESTAQUE')
  const [title, setTitle] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [body, setBody] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageFitMode, setImageFitMode] = useState<ImageFitMode>('contain')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const valid = title.trim().length > 0 && body.trim().length > 0

  async function handleImageFile(file: File) {
    setUploadError(null)
    const validation = validateUserMediaImage(file)
    if (validation) {
      setUploadError(validation)
      return
    }
    setImagePreview(URL.createObjectURL(file))
    if (isMockMode || !user?.id) return
    setUploading(true)
    const url = await uploadBulletinImage(user.id, file)
    setUploading(false)
    if (url) {
      setImageUrl(url)
    } else {
      setUploadError('Erro ao fazer upload. Tente novamente.')
    }
  }

  const handleCreate = async () => {
    if (!valid) return
    setSaving(true)
    await onCreate({
      label,
      title:      title.trim(),
      subtitle:   subtitle.trim() || undefined,
      body:       body.trim(),
      imageUrl:   imageUrl || undefined,
      imageFitMode,
      authorId:   user?.id   ?? 'admin',
      authorName: user ? `${user.firstName} ${user.lastName}` : 'Admin',
      isPinned:   false,
    })
    setSaving(false)
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-ink/60 px-0 md:px-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
        className="w-full md:max-w-lg bg-paper border-2 border-ink p-6 max-h-[90dvh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="font-display text-2xl">NOVO BOLETIM</div>
            <div className="font-serif-it text-sm text-green-deep">escreva para a firma</div>
          </div>
          <button onClick={onClose} className="font-mono text-[10px] text-ink-3 hover:text-ink">
            FECHAR
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <p className="font-mono text-[9px] tracking-eyebrow text-ink-3 mb-1.5">CATEGORIA</p>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_LABELS.map(l => (
                <button
                  key={l}
                  onClick={() => setLabel(l)}
                  className={[
                    'font-mono text-[9px] px-2.5 py-1.5 border-2 transition-colors',
                    label === l ? 'bg-ink border-ink text-paper' : 'border-hairline hover:border-ink',
                  ].join(' ')}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Título do boletim *"
            className="w-full bg-paper-deep border border-line px-3 py-2.5 font-sans text-[14px] outline-none focus:border-ink placeholder:text-ink-4"
          />
          <input
            value={subtitle}
            onChange={e => setSubtitle(e.target.value)}
            placeholder="Subtítulo (opcional)"
            className="w-full bg-paper-deep border border-line px-3 py-2.5 font-sans text-[14px] outline-none focus:border-ink placeholder:text-ink-4"
          />
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder="Conteúdo do boletim *"
            rows={4}
            className="w-full bg-paper-deep border border-line px-3 py-2.5 font-sans text-[14px] outline-none focus:border-ink placeholder:text-ink-4 resize-none"
          />
          {/* Image upload */}
          <div>
            <p className="font-mono text-[9px] tracking-eyebrow text-ink-3 mb-1.5">
              IMAGEM (opcional) — proporção ideal 16:9 · máx. {USER_MEDIA_MAX_BYTES / 1024 / 1024} MB
            </p>
            <div className="flex gap-1.5 mb-2">
              {(['contain', 'cover'] as const).map(mode => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setImageFitMode(mode)}
                  className={[
                    'font-mono text-[9px] px-2.5 py-1 border-2 transition-colors',
                    imageFitMode === mode ? 'bg-ink border-ink text-paper' : 'border-hairline hover:border-ink',
                  ].join(' ')}
                >
                  {mode === 'contain' ? 'CONTER' : 'COBRIR'}
                </button>
              ))}
            </div>

            {imagePreview ? (
              <div className="relative">
                {/* 16:9 preview */}
                <div className="relative w-full overflow-hidden bg-paper-deep" style={{ paddingBottom: '56.25%' }}>
                  <img
                    src={imagePreview}
                    alt="preview"
                    className="absolute inset-0 w-full h-full"
                    style={{ objectFit: imageFitMode }}
                  />
                  {uploading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-ink/40">
                      <span className="font-mono text-[10px] text-paper animate-pulse">ENVIANDO…</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  {imageUrl
                    ? <span className="font-mono text-[9px] text-green">✓ Upload concluído</span>
                    : uploadError
                      ? <span className="font-mono text-[9px] text-red">{uploadError}</span>
                      : <span className="font-mono text-[9px] text-ink-3 animate-pulse">Enviando…</span>
                  }
                  <button
                    type="button"
                    onClick={() => { setImagePreview(null); setImageUrl(''); setUploadError(null) }}
                    className="ml-auto font-mono text-[9px] text-ink-4 hover:text-ink"
                  >
                    REMOVER ✕
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-line hover:border-ink transition-colors py-6 flex flex-col items-center gap-1.5"
              >
                <span className="font-mono text-[20px] text-ink-4">↑</span>
                <span className="font-mono text-[10px] text-ink-3">Clique para selecionar imagem</span>
                <span className="font-mono text-[8px] text-ink-4">JPG · PNG · WEBP · GIF · máx. {USER_MEDIA_MAX_BYTES / 1024 / 1024} MB</span>
              </button>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleImageFile(f) }}
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 btn-ghost text-[11px]">
            CANCELAR
          </button>
          <button
            onClick={handleCreate}
            disabled={!valid || saving}
            className="btn-yellow text-[11px] disabled:opacity-40"
            style={{ flex: 2 }}
          >
            {saving ? 'PUBLICANDO…' : 'PUBLICAR BOLETIM'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export function BoletimScreen() {
  const { bulletins, isLoaded, init, destroy, addBoletim, togglePin, deleteBoletim } = useBoletimStore()
  const { user } = useAuthStore()
  const canEdit = (user?.isAdmin || user?.isMarketing) ?? false
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    init()
    return () => { destroy() }
  }, [init, destroy])

  const sorted = [...bulletins].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1
    if (!a.isPinned && b.isPinned) return 1
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  const featured = sorted[0]
  const rest     = sorted.slice(1)

  const handleCreate = async (b: NewBoletim) => {
    await addBoletim(b)
    setCreating(false)
  }

  if (!isLoaded) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <span className="font-mono text-[11px] tracking-eyebrow text-ink-3 animate-pulse">CARREGANDO…</span>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-paper pb-24">
      {/* ── Masthead ── */}
      <div className="border-b-2 border-ink px-4 py-6 md:px-8 md:py-8">
        <div className="max-w-screen-lg mx-auto flex items-end justify-between">
          <div>
            <p className="font-mono text-[9px] tracking-eyebrow text-ink-3 mb-2">
              SUPREMA GAMING · BOLETIM OFICIAL
            </p>
            <div className="font-display text-5xl md:text-7xl leading-none text-ink">BOLETIM</div>
            <div className="font-serif-it text-2xl md:text-3xl text-green-deep mt-1">
              da firma
            </div>
          </div>
          {canEdit && (
            <button
              onClick={() => setCreating(true)}
              className="btn-ink text-[11px] px-5 py-3 flex-shrink-0"
            >
              + PUBLICAR
            </button>
          )}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="max-w-screen-lg mx-auto px-4 py-6 md:px-8 space-y-4">
        {bulletins.length === 0 ? (
          <div className="py-20 text-center">
            <div className="font-display text-3xl text-ink-3">SEM BOLETINS</div>
            <div className="font-serif-it text-lg text-ink-4 mt-1">ainda não há nada por aqui</div>
          </div>
        ) : (
          <>
            {featured && (
              <BoletimCard
                b={featured}
                canEdit={canEdit}
                onDelete={deleteBoletim}
                onTogglePin={togglePin}
                featured
              />
            )}

            {rest.length > 0 && (
              <div className="flex items-center gap-3 py-1">
                <div className="flex-1 h-px bg-hairline" />
                <span className="font-mono text-[9px] tracking-eyebrow text-ink-3">ANTERIORES</span>
                <div className="flex-1 h-px bg-hairline" />
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {rest.map(b => (
                <BoletimCard
                  key={b.id}
                  b={b}
                  canEdit={canEdit}
                  onDelete={deleteBoletim}
                  onTogglePin={togglePin}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <AnimatePresence>
        {creating && (
          <CreateModal onClose={() => setCreating(false)} onCreate={handleCreate} />
        )}
      </AnimatePresence>
    </div>
  )
}
