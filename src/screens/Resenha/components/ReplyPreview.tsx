import type { ChatMessage } from '@/types'

interface ReplyPreviewProps {
  replyingTo: ChatMessage
  onCancel: () => void
}

export function ReplyPreview({ replyingTo, onCancel }: ReplyPreviewProps) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-hairline bg-paper-deep">
      <div className="flex-1 min-w-0">
        <span className="font-mono text-[9px] text-ink-4 tracking-eyebrow">RESPONDENDO A </span>
        <span className="font-mono text-[9px] font-bold text-ink">{replyingTo.who}</span>
        <p className="font-sans text-[11px] text-ink-3 truncate mt-0.5">
          {replyingTo.type === 'gif'   ? '🖼 GIF'   :
           replyingTo.type === 'image' ? '📷 Foto'  :
           replyingTo.type === 'audio' ? '🎤 Áudio' :
           replyingTo.text}
        </p>
      </div>
      <button
        onClick={onCancel}
        className="font-mono text-[11px] text-ink-4 hover:text-red transition-colors flex-shrink-0 px-1"
      >✕</button>
    </div>
  )
}
