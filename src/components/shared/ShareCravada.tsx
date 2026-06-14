import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { generateCravadaCard, shareCravadaCard, type CravadaCardData } from '@/lib/shareCard'
import { cn } from '@/lib/utils'

function buildCaption(d: CravadaCardData): string {
  return `Cravei o placar de ${d.home.code} ${d.homeScore}x${d.awayScore} ${d.away.code} no Bolão Suprema! 🎯 bolao.suprema.group`
}

function downloadBlob(blob: Blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'cravei-bolao-suprema.png'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

export function CravadaShareModal({
  data,
  open,
  onClose,
  celebrate = false,
}: {
  data: CravadaCardData
  open: boolean
  onClose: () => void
  celebrate?: boolean
}) {
  const [url, setUrl] = useState<string | null>(null)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let active = true
    setLoading(true); setMsg(null); setBlob(null); setUrl(null)
    generateCravadaCard(data)
      .then(b => {
        if (!active) return
        setBlob(b)
        setUrl(URL.createObjectURL(b))
        setLoading(false)
      })
      .catch(() => { if (active) { setLoading(false); setMsg('Não consegui gerar a imagem agora.') } })
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => () => { if (url) URL.revokeObjectURL(url) }, [url])

  const onShare = useCallback(async () => {
    if (!blob) return
    setBusy(true)
    const r = await shareCravadaCard(blob, buildCaption(data))
    setBusy(false)
    if (r === 'downloaded') setMsg('Imagem baixada! Abra o Instagram/WhatsApp e poste no story.')
    else if (r === 'error') setMsg('Não consegui compartilhar — tente o botão Baixar.')
    else onClose()
  }, [blob, data, onClose])

  if (!open) return null

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[80] grid place-items-center bg-black/75 px-4 py-6 overflow-y-auto"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 12 }}
          className="relative w-full max-w-sm ui-card p-4"
          onClick={e => e.stopPropagation()}
        >
          <button onClick={onClose} aria-label="Fechar"
            className="absolute top-3 right-3 z-10 grid h-7 w-7 place-items-center border border-hairline bg-card font-mono text-[11px] text-ink-3 hover:border-ink hover:text-ink">
            ✕
          </button>

          {celebrate && (
            <div className="text-center mb-3">
              <div className="font-display text-4xl text-green leading-none">VOCÊ CRAVOU! 🎯</div>
              <p className="font-mono text-[10px] tracking-eyebrow text-ink-3 mt-1">mostra pra geral — compartilhe</p>
            </div>
          )}
          {!celebrate && (
            <div className="font-mono text-[10px] tracking-eyebrow text-ink-3 mb-3">COMPARTILHAR CRAVADA</div>
          )}

          <div className="rounded-lg overflow-hidden bg-ink min-h-[260px] grid place-items-center">
            {loading ? (
              <span className="font-mono text-[11px] tracking-eyebrow text-paper/60 animate-pulse py-16">GERANDO IMAGEM…</span>
            ) : url ? (
              <img src={url} alt="Card de cravada" className="w-full max-h-[58vh] object-contain" />
            ) : (
              <span className="font-mono text-[11px] text-paper/60 py-16 px-4 text-center">{msg ?? 'Erro ao gerar.'}</span>
            )}
          </div>

          {msg && url && <p className="font-mono text-[10px] text-ink-3 mt-2 text-center leading-relaxed">{msg}</p>}

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              onClick={onShare}
              disabled={loading || busy || !blob}
              className="btn-yellow justify-center text-[11px] disabled:opacity-50"
            >
              {busy ? 'ABRINDO…' : 'COMPARTILHAR'}
            </button>
            <button
              onClick={() => blob && downloadBlob(blob)}
              disabled={loading || !blob}
              className={cn('border-2 border-line-strong bg-card py-3 font-mono text-[10px] font-bold tracking-eyebrow text-ink hover:bg-surface-hover disabled:opacity-50')}
            >
              BAIXAR
            </button>
          </div>
          <p className="font-mono text-[9px] text-ink-4 mt-2 text-center">No celular abre o Instagram/WhatsApp direto. No PC, baixa a imagem.</p>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  )
}

// Botão compacto que abre o modal — para listas (Meus Palpites, Espiadinha).
export function ShareCravadaButton({ data, className }: { data: CravadaCardData; className?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(true) }}
        className={cn(
          'inline-flex items-center gap-1 rounded-full border border-yellow bg-yellow/15 px-2 py-1 font-mono text-[8px] font-bold tracking-eyebrow text-ink hover:bg-yellow active:scale-95 transition',
          className,
        )}
        aria-label="Compartilhar cravada"
      >
        ↗ COMPARTILHAR
      </button>
      <CravadaShareModal data={data} open={open} onClose={() => setOpen(false)} />
    </>
  )
}
