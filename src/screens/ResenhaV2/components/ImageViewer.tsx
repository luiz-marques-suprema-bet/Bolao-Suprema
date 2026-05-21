import { motion } from 'framer-motion'
import { isSafeHttpUrl } from '@/lib/security'

export function ImageViewer({ url, onClose }: { url: string; onClose: () => void }) {
  if (!isSafeHttpUrl(url)) return null
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] bg-black flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 flex-shrink-0 bg-black/60">
        <button
          onClick={onClose}
          className="font-mono text-[10px] tracking-eyebrow text-white/60 hover:text-white transition-colors"
        >
          ← FECHAR
        </button>
        <a
          href={url}
          download
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-[10px] tracking-eyebrow text-white/40 hover:text-white transition-colors"
          onClick={e => e.stopPropagation()}
        >
          SALVAR ↓
        </a>
      </div>

      {/* Image — tap outside to close */}
      <div className="flex-1 flex items-center justify-center p-4 min-h-0" onClick={onClose}>
        <motion.img
          initial={{ scale: 0.94, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.94, opacity: 0 }}
          transition={{ duration: 0.18 }}
          src={url}
          alt="Foto"
          className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
          onClick={e => e.stopPropagation()}
        />
      </div>
    </motion.div>
  )
}
