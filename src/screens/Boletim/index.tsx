import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuthStore } from '@/stores/auth.store'
import { useBoletimStore } from '@/stores/boletim.store'
import type { Boletim } from '@/types'

// ─── Label colour map ─────────────────────────────────────────────────────────

const LABEL_COLORS: Record<string, string> = {
  REGRAS:    'bg-ink text-paper',
  BRASIL:    'bg-green text-paper',
  AGENDA:    'bg-yellow text-ink',
  DESTAQUE:  'bg-red text-paper',
  AVISO:     'bg-yellow text-ink',
  PRÊMIO:    'bg-green text-paper',
}
const labelColor = (l: string) => LABEL_COLORS[l.toUpperCase()] ?? 'bg-ink text-paper'

// ─── Boletim card ─────────────────────────────────────────────────────────────

function BoletimCard({
  b,
  isAdmin,
  onDelete,
  onTogglePin,
  featured = false,
}: {
  b: Boletim
  isAdmin: boolean
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
          {isAdmin && (
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
          <img src={b.imageUrl} alt={b.title} className="w-full h-48 object-cover mb-4 opacity-80" />
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
                <img src={b.imageUrl} alt={b.title} className="w-full h-36 object-cover mb-3" />
              )}
              <p className="font-sans text-[13px] text-ink-2 leading-relaxed">{b.body}</p>
              {isAdmin && (
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

function CreateModal({
  onClose,
  onCreate,
}: {
  onClose: () => void
  onCreate: (b: Boletim) => void
}) {
  const { user } = useAuthStore()
  const [label, setLabel] = useState('DESTAQUE')
  const [title, setTitle] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [body, setBody] = useState('')
  const [imageUrl, setImageUrl] = useState('')

  const valid = title.trim().length > 0 && body.trim().length > 0

  const handleCreate = () => {
    if (!valid) return
    onCreate({
      id: `b-${Date.now()}`,
      label,
      title: title.trim(),
      subtitle: subtitle.trim() || undefined,
      body: body.trim(),
      imageUrl: imageUrl.trim() || undefined,
      authorId: user?.id ?? 'admin',
      authorName: user ? `${user.firstName} ${user.lastName}` : 'Admin',
      createdAt: new Date().toISOString(),
    })
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
          {/* Label selector */}
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
          <input
            value={imageUrl}
            onChange={e => setImageUrl(e.target.value)}
            placeholder="URL da imagem (opcional)"
            className="w-full bg-paper-deep border border-line px-3 py-2.5 font-mono text-[12px] outline-none focus:border-ink placeholder:text-ink-4"
          />
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 btn-ghost text-[11px]">
            CANCELAR
          </button>
          <button
            onClick={handleCreate}
            disabled={!valid}
            className="btn-yellow text-[11px] disabled:opacity-40"
            style={{ flex: 2 }}
          >
            PUBLICAR BOLETIM
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export function BoletimScreen() {
  const { bulletins, addBoletim, togglePin, deleteBoletim } = useBoletimStore()
  const { user } = useAuthStore()
  const isAdmin = user?.isAdmin ?? false
  const [creating, setCreating] = useState(false)

  const sorted = [...bulletins].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1
    if (!a.isPinned && b.isPinned) return 1
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  const featured = sorted[0]
  const rest = sorted.slice(1)

  const handleCreate = (b: Boletim) => {
    addBoletim(b)
    setCreating(false)
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
          {isAdmin && (
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
            {/* Featured (first/pinned) */}
            {featured && (
              <BoletimCard
                b={featured}
                isAdmin={isAdmin}
                onDelete={deleteBoletim}
                onTogglePin={togglePin}
                featured
              />
            )}

            {/* Horizontal rule with date */}
            {rest.length > 0 && (
              <div className="flex items-center gap-3 py-1">
                <div className="flex-1 h-px bg-hairline" />
                <span className="font-mono text-[9px] tracking-eyebrow text-ink-3">ANTERIORES</span>
                <div className="flex-1 h-px bg-hairline" />
              </div>
            )}

            {/* Rest — two columns on desktop */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {rest.map(b => (
                <BoletimCard
                  key={b.id}
                  b={b}
                  isAdmin={isAdmin}
                  onDelete={deleteBoletim}
                  onTogglePin={togglePin}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Create modal ── */}
      <AnimatePresence>
        {creating && (
          <CreateModal onClose={() => setCreating(false)} onCreate={handleCreate} />
        )}
      </AnimatePresence>
    </div>
  )
}
