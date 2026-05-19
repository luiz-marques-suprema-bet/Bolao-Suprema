import { motion } from 'framer-motion'
import type { ChatMessage } from '@/types'
import { getReplyPreview } from '../utils/chatFormat'

interface PinnedMessageProps {
  msg: ChatMessage
  isAdmin: boolean
  onUnpin: () => void
}

export function PinnedMessage({ msg, isAdmin, onUnpin }: PinnedMessageProps) {
  const preview = getReplyPreview(msg)
  return (
    <motion.div
      initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
      transition={{ duration: 0.18 }}
      className="overflow-hidden flex-shrink-0"
    >
      <div className="border-b border-yellow/40 bg-yellow/8 px-4 py-2 flex items-center gap-2">
        <span className="font-mono text-[8px] text-ink-4 flex-shrink-0">📌</span>
        <p className="flex-1 font-sans text-[12px] text-ink-2 truncate min-w-0">
          <span className="font-bold text-ink">{msg.who}: </span>
          {preview}
        </p>
        {isAdmin && (
          <button
            onClick={onUnpin}
            className="font-mono text-[9px] text-ink-4 hover:text-ink flex-shrink-0 ml-2"
          >
            DESAFIXAR
          </button>
        )}
      </div>
    </motion.div>
  )
}
