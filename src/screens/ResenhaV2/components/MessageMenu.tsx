import { cn } from '@/lib/utils'

interface MessageMenuProps {
  isMine: boolean
  isAdmin: boolean
  isPinned: boolean
  canDelete: boolean
  onReply: () => void
  onPin: () => void
  onDelete: () => void
}

export function MessageMenu({ isMine, isAdmin, isPinned, canDelete, onReply, onPin, onDelete }: MessageMenuProps) {
  return (
    <div
      onClick={e => e.stopPropagation()}
      className={cn(
        'absolute top-8 z-50 w-44 overflow-hidden',
        'ui-card',
        isMine ? 'right-0' : 'left-0',
      )}
    >
      <button
        onClick={onReply}
        className="w-full flex items-center gap-3 px-4 py-3 font-mono text-[11px] tracking-wide text-left text-ink hover:bg-surface-hover transition-colors"
      >
        <span className="w-4 flex-shrink-0 text-center text-ink-3">↩</span>
        RESPONDER
      </button>
      {isAdmin && (
        <button
          onClick={onPin}
          className="w-full flex items-center gap-3 px-4 py-3 font-mono text-[11px] tracking-wide text-left text-ink hover:bg-surface-hover transition-colors"
        >
          <span className="w-4 flex-shrink-0 text-center text-ink-3">{isPinned ? '◆' : '◇'}</span>
          {isPinned ? 'DESAFIXAR' : 'FIXAR'}
        </button>
      )}
      {canDelete && (
        <>
          <div className="h-px bg-hairline mx-3" />
          <button
            onClick={onDelete}
            className="w-full flex items-center gap-3 px-4 py-3 font-mono text-[11px] tracking-wide text-left text-red hover:bg-red/8 transition-colors"
          >
            <span className="w-4 flex-shrink-0 text-center text-red/60">×</span>
            APAGAR
          </button>
        </>
      )}
    </div>
  )
}
