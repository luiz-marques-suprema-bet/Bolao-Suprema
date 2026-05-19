import { cn } from '@/lib/utils'
import { Avatar } from '@/components/shared/Avatar'
import type { ChatMessage } from '@/types'
import { MessageMenu } from './MessageMenu'
import { MessageContent } from './MessageContent'

export interface MessageBubbleProps {
  message: ChatMessage
  grouped: boolean
  menuOpen: boolean
  isAdmin: boolean
  isPinned: boolean
  canDelete: boolean
  onToggleMenu: (e: React.MouseEvent) => void
  onReply: () => void
  onPin: () => void
  onDeleteRequest: () => void
  onOpenProfile: () => void
}

export function MessageBubble({
  message: m,
  grouped,
  menuOpen,
  isAdmin,
  isPinned,
  canDelete,
  onToggleMenu,
  onReply,
  onPin,
  onDeleteRequest,
  onOpenProfile,
}: MessageBubbleProps) {
  const isMine = m.isYou ?? false

  const menuProps: React.ComponentProps<typeof MessageMenu> = {
    open: menuOpen,
    isAdmin,
    isPinned,
    canDelete,
    onToggle: onToggleMenu,
    onReply,
    onPin,
    onDelete: onDeleteRequest,
  }

  return (
    <div className={cn('group/bubble flex gap-2 items-end w-full', isMine ? 'justify-end' : 'justify-start')}>
      {/* Avatar — others only, spacer when grouped */}
      {!isMine && (
        grouped
          ? <div className="w-8 flex-shrink-0" />
          : (
            <button onClick={onOpenProfile} className="flex-shrink-0 hover:opacity-80 transition-opacity self-end mb-0.5">
              <Avatar initials={m.initials} color={m.color} src={m.avatarUrl} size={32} />
            </button>
          )
      )}

      {/* Bubble */}
      <div className={cn('max-w-[84%] md:max-w-[560px]', isMine ? '' : '')}>
        <MessageContent m={m} grouped={grouped} onOpenProfile={onOpenProfile} menuProps={menuProps} />
      </div>
    </div>
  )
}
