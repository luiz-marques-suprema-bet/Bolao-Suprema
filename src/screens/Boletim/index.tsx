import { useState, useEffect, useRef, type ReactNode } from 'react'
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

const URL_PATTERN = /https?:\/\/[^\s<]+/g
const TRAILING_URL_PUNCTUATION = /[.,!?;:)\]}]+$/

function renderLinkedText(text: string, linkClassName: string): ReactNode[] {
  const parts: ReactNode[] = []
  let lastIndex = 0

  for (const match of text.matchAll(URL_PATTERN)) {
    const rawUrl = match[0]
    const index = match.index ?? 0
    const trailing = rawUrl.match(TRAILING_URL_PUNCTUATION)?.[0] ?? ''
    const href = rawUrl.slice(0, rawUrl.length - trailing.length)

    if (index > lastIndex) parts.push(text.slice(lastIndex, index))

    parts.push(
      <a
        key={`${href}-${index}`}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={event => event.stopPropagation()}
        className={linkClassName}
      >
        {href}
      </a>,
    )

    if (trailing) parts.push(trailing)
    lastIndex = index + rawUrl.length
  }

  if (lastIndex < text.length) parts.push(text.slice(lastIndex))

  return parts
}

// ─── Boletim card ─────────────────────────────────────────────────────────────

export function BoletimCard({
  b,
  canEdit,
  onDelete,
  onTogglePin,
  featured = false,
  compactHome = false,
}: {
  b: Boletim
  canEdit: boolean
  onDelete: (id: string) => void
  onTogglePin: (id: string) => void
  featured?: boolean
  compactHome?: boolean
}) {
  const [expanded, setExpanded] = useState(featured)
  const date = new Date(b.createdAt).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric',
  }).toUpperCase()

  if (featured && compactHome) {
    return (
      <div className="grid overflow-hidden border-2 border-line bg-inverse text-inverse-text shadow-card md:grid-cols-[minmax(220px,340px)_1fr] lg:grid-cols-[minmax(260px,380px)_1fr]">
        <div className="relative aspect-[4/5] min-h-[260px] bg-inverse-text/10 md:min-h-0">
          {b.imageUrl ? (
            <SafeImage src={b.imageUrl} alt={b.title} fit={b.imageFitMode ?? 'cover'} className="absolute inset-0 h-full w-full" />
          ) : (
            <div className="absolute inset-0 grid place-items-center bg-yellow text-[#0D0D0D]">
              <span className="font-display text-4xl leading-none">BS</span>
            </div>
          )}
          <div className="absolute left-3 top-3 flex flex-wrap gap-2">
            <span className={`inline-block px-2 py-0.5 font-mono text-[9px] tracking-eyebrow ${labelColor(b.label)}`}>
              {b.label}
            </span>
            {b.isPinned && (
              <span className="inline-block bg-yellow px-2 py-0.5 font-mono text-[9px] tracking-eyebrow text-[#0D0D0D]">
                FIXADO
              </span>
            )}
          </div>
        </div>

        <div className="flex min-w-0 flex-col justify-between gap-5 p-4 md:p-5 lg:p-6">
          <div>
            <div className="mb-3 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="mb-2 font-mono text-[9px] tracking-eyebrow text-inverse-text/45">BOLETIM DA FIRMA</p>
                <div className="font-display text-3xl leading-tight text-inverse-text md:text-4xl lg:text-5xl">
                  {b.title.toUpperCase()}
                </div>
                {b.subtitle && (
                  <div className="mt-1 font-serif-it text-lg leading-snug text-inverse-text/70 md:text-xl">
                    {b.subtitle}
                  </div>
                )}
              </div>
              {canEdit && (
                <div className="flex flex-col gap-1.5">
                  <button
                    onClick={() => onTogglePin(b.id)}
                    className="border border-inverse-text/30 px-2 py-1 font-mono text-[8px] text-inverse-text/60 transition-colors hover:border-inverse-text hover:text-inverse-text"
                  >
                    {b.isPinned ? 'DESAFIXAR' : 'FIXAR'}
                  </button>
                  <button
                    onClick={() => onDelete(b.id)}
                    className="border border-red/50 px-2 py-1 font-mono text-[8px] text-red/70 transition-colors hover:border-red hover:text-red"
                  >
                    EXCLUIR
                  </button>
                </div>
              )}
            </div>

            <p className="font-sans text-[14px] leading-relaxed text-inverse-text/80 line-clamp-4">
              {renderLinkedText(b.body, 'break-all text-yellow underline underline-offset-2 hover:text-inverse-text')}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-inverse-text/15 pt-3">
            <p className="font-mono text-[9px] text-inverse-text/45">
              {b.authorName} · {date}
            </p>
            <span className="font-mono text-[9px] font-bold tracking-eyebrow text-yellow">
              LER BOLETIM
            </span>
          </div>
        </div>
      </div>
    )
  }

  if (featured) {
    return (
      <div className={compactHome ? 'border-2 border-line bg-inverse text-inverse-text p-4 shadow-card md:p-5' : 'border-2 border-line bg-inverse text-inverse-text p-5 shadow-card md:p-8'}>
        <div className={compactHome ? 'flex items-start justify-between gap-4 mb-3' : 'flex items-start justify-between gap-4 mb-4'}>
          <div>
            <span className={`inline-block font-mono text-[9px] tracking-eyebrow px-2 py-0.5 ${compactHome ? 'mb-2' : 'mb-3'} ${labelColor(b.label)}`}>
              {b.label}
            </span>
            {b.isPinned && (
              <span className="inline-block font-mono text-[9px] tracking-eyebrow px-2 py-0.5 mb-3 ml-2 bg-yellow text-[#0D0D0D]">
                · FIXADO
              </span>
            )}
            <div className={compactHome ? 'font-display text-2xl md:text-4xl leading-tight text-inverse-text' : 'font-display text-3xl md:text-5xl leading-tight text-inverse-text'}>
              {b.title.toUpperCase()}
            </div>
            {b.subtitle && (
              <div className={compactHome ? 'font-serif-it text-base md:text-xl text-inverse-text/70 mt-0.5' : 'font-serif-it text-lg md:text-2xl text-inverse-text/70 mt-1'}>
                {b.subtitle}
              </div>
            )}
          </div>
          {canEdit && (
            <div className="flex flex-col gap-1 flex-shrink-0">
              <button
                onClick={() => onTogglePin(b.id)}
                className="font-mono text-[8px] px-2 py-1 border border-inverse-text/30 hover:border-inverse-text text-inverse-text/60 hover:text-inverse-text transition-colors"
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
          <div className={compactHome ? 'relative mb-3 aspect-[21/8] max-h-[220px] w-full overflow-hidden bg-inverse-text/10' : 'relative mb-4 aspect-video w-full overflow-hidden bg-inverse-text/10'}>
            <SafeImage src={b.imageUrl} alt={b.title} fit={b.imageFitMode ?? 'cover'} className="absolute inset-0 h-full w-full" />
          </div>
        )}

        <p className={compactHome ? 'font-sans text-[13px] text-inverse-text/80 leading-relaxed line-clamp-3' : 'font-sans text-[14px] text-inverse-text/80 leading-relaxed'}>
          {renderLinkedText(b.body, 'break-all text-yellow underline underline-offset-2 hover:text-inverse-text')}
        </p>

        <p className={compactHome ? 'font-mono text-[9px] text-inverse-text/45 mt-3' : 'font-mono text-[9px] text-inverse-text/45 mt-4'}>
          {b.authorName} · {date}
        </p>
      </div>
    )
  }

  return (
    <div className="border-2 border-hairline bg-paper-white hover:border-ink transition-colors">
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
                <div className="relative mb-3 aspect-video w-full overflow-hidden bg-paper-deep">
                  <SafeImage src={b.imageUrl} alt={b.title} fit={b.imageFitMode ?? 'contain'} className="absolute inset-0 h-full w-full" />
                </div>
              )}
              <p className="font-sans text-[13px] text-ink-2 leading-relaxed">
                {renderLinkedText(b.body, 'break-all text-green-deep underline underline-offset-2 hover:text-ink')}
              </p>
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
  const [imageFitMode, setImageFitMode] = useState<ImageFitMode>('cover')
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
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/70 px-0 md:px-4 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
        className="w-full md:max-w-lg ui-card p-6 max-h-[90dvh] overflow-y-auto"
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
                    label === l ? 'bg-yellow border-yellow text-[#0D0D0D]' : 'border-hairline hover:border-line-strong',
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
              IMAGEM (opcional) — ideal 4:5 ou 1:1 · estilo Instagram · máx. {USER_MEDIA_MAX_BYTES / 1024 / 1024} MB
            </p>
            <div className="flex gap-1.5 mb-2">
              {(['contain', 'cover'] as const).map(mode => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setImageFitMode(mode)}
                  className={[
                    'font-mono text-[9px] px-2.5 py-1 border-2 transition-colors',
                    imageFitMode === mode ? 'bg-yellow border-yellow text-[#0D0D0D]' : 'border-hairline hover:border-line-strong',
                  ].join(' ')}
                >
                  {mode === 'contain' ? 'CONTER' : 'COBRIR'}
                </button>
              ))}
            </div>

            {imagePreview ? (
              <div className="relative">
                <div className="relative mx-auto aspect-[4/5] max-h-[420px] w-full max-w-[336px] overflow-hidden border border-hairline bg-paper-deep">
                  <img
                    src={imagePreview}
                    alt="preview"
                    className="absolute inset-0 h-full w-full"
                    style={{ objectFit: imageFitMode }}
                  />
                  {uploading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-ink/40">
                      <span className="font-mono text-[10px] text-paper animate-pulse">ENVIANDO…</span>
                    </div>
                  )}
                </div>
                <p className="mt-1.5 text-center font-mono text-[8px] text-ink-4">
                  Preview no formato principal da Home · use COBRIR para preencher o card
                </p>
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
                className="w-full border-2 border-dashed border-line hover:border-line-strong bg-surface-2 transition-colors py-6 flex flex-col items-center gap-1.5"
              >
                <span className="font-mono text-[20px] text-ink-4">↑</span>
                <span className="font-mono text-[10px] text-ink-3">Clique para selecionar imagem</span>
                <span className="font-mono text-[8px] text-ink-4">JPG · PNG · WEBP · GIF · 4:5 / 1:1 · máx. {USER_MEDIA_MAX_BYTES / 1024 / 1024} MB</span>
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
      <div className="border-b-2 border-line-strong bg-paper px-4 py-6 md:px-8 md:py-8">
        <div className="app-shell flex items-end justify-between">
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
      <div className="app-shell py-6 space-y-4">
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
