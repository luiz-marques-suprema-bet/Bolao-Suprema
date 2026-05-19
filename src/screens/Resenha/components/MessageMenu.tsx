import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

interface MessageMenuProps {
  open: boolean
  isAdmin: boolean
  isPinned: boolean
  canDelete: boolean
  onToggle: (e: React.MouseEvent) => void
  onReply: () => void
  onPin: () => void
  onDelete: () => void
}

function MenuItem({ icon, label, danger, onClick }: {
  icon: string; label: string; danger?: boolean; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 px-4 py-3 font-mono text-[11px] tracking-wide text-left transition-colors',
        danger ? 'text-red hover:bg-red/8' : 'text-ink hover:bg-hairline',
      )}
    >
      <span className="w-4 flex-shrink-0 text-center leading-none text-ink-3">{icon}</span>
      {label}
    </button>
  )
}

export function MessageMenu({ open, isAdmin, isPinned, canDelete, onToggle, onReply, onPin, onDelete }: MessageMenuProps) {
  return (
    <>
      <button
        type="button"
        aria-label="Opções da mensagem"
        onClick={onToggle}
        className={cn(
          'absolute right-1 top-1 z-10 w-6 h-6 flex items-center justify-center font-mono text-[11px] rounded-full transition-all',
          'opacity-0 group-hover/bubble:opacity-100 focus:opacity-100',
          open ? 'opacity-100 bg-black/15' : 'bg-black/0 hover:bg-black/15',
        )}
      >
        ⌄
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ type: 'spring', damping: 24, stiffness: 420 }}
            onClick={e => e.stopPropagation()}
            className="absolute top-7 right-0 z-50 w-44 overflow-hidden bg-paper border-2 border-ink shadow-[4px_4px_0_#0D0D0D]"
          >
            <MenuItem icon="↩" label="RESPONDER" onClick={onReply} />
            {isAdmin && (
              <MenuItem
                icon={isPinned ? '◆' : '◇'}
                label={isPinned ? 'DESAFIXAR' : 'FIXAR'}
                onClick={onPin}
              />
            )}
            {canDelete && (
              <>
                <div className="h-px bg-hairline mx-3" />
                <MenuItem icon="×" label="APAGAR" danger onClick={onDelete} />
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
