import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Avatar } from '@/components/shared/Avatar'
import type { ChatMessage } from '@/types'
import type { ChatProfile } from '@/stores/chat.store'
import { MessageContent } from './MessageContent'
import { MessageMenu } from './MessageMenu'
import { ReactionStrip } from './ReactionStrip'

export interface MessageBubbleProps {
  message: ChatMessage
  grouped: boolean
  isAdmin: boolean
  isPinned: boolean
  currentUserId?: string
  profiles: ChatProfile[]
  onReply: () => void
  onPin: () => void
  onDeleteRequest: () => void
  onVote: (optId: string) => void
  onOpenProfile: () => void
  onReact: (emoji: string) => void
}

export function MessageBubble({
  message: m,
  grouped,
  isAdmin,
  isPinned,
  currentUserId,
  profiles,
  onReply,
  onPin,
  onDeleteRequest,
  onVote,
  onOpenProfile,
  onReact,
}: MessageBubbleProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const isMine   = m.isYou ?? false
  const canDelete = isAdmin || isMine

  return (
    <div
      className={cn('flex w-full px-3 py-0.5', isMine ? 'justify-end' : 'justify-start')}
      onClick={() => menuOpen && setMenuOpen(false)}
    >
      {/* Avatar column — others only */}
      {!isMine && (
        <div className="mr-2 w-9 shrink-0 self-end mb-0.5">
          {!grouped ? (
            <button onClick={onOpenProfile} className="hover:opacity-80 transition-opacity">
              <Avatar initials={m.initials} color={m.color} src={m.avatarUrl} size={32} />
            </button>
          ) : null}
        </div>
      )}

      {/* Bubble wrapper — max width enforced here */}
      <div className={cn(
        'group/message relative min-w-0',
        'max-w-[84%] sm:max-w-[78%] md:max-w-[560px]',
      )}>
        {/* Bubble shell */}
        <div className={cn(
          'relative break-words shadow-sm',
          m.type === 'gif' || m.type === 'image' ? 'overflow-hidden' : 'px-3.5 py-2.5',
          isMine
            ? 'rounded-2xl rounded-br-sm bg-yellow text-ink'
            : 'rounded-2xl rounded-bl-sm border border-line bg-paper-deep text-ink',
        )}>
          {/* Author name — inside bubble, first line, aligned with content */}
          {!isMine && !grouped && (
            <button
              onClick={onOpenProfile}
              className={cn(
                'block font-mono text-[9px] font-bold text-ink hover:underline text-left leading-none truncate max-w-full mb-1',
                (m.type === 'gif' || m.type === 'image') && 'px-2.5 pt-2',
              )}
            >
              {m.who}
              {m.dept && <span className="font-normal text-ink-4"> · {m.dept}</span>}
            </button>
          )}

          <MessageContent
            message={m}
            isMine={isMine}
            userId={currentUserId}
            profiles={profiles}
            onVote={onVote}
          />

          {/* Timestamp */}
          {m.type !== 'poll' && (
            <div className={cn(
              'font-mono text-[9px] text-right mt-1',
              isMine ? 'text-ink/40' : 'text-ink-4',
              (m.type === 'gif' || m.type === 'image') && 'px-2 pb-1',
            )}>
              {m.time}
            </div>
          )}

          {/* Menu toggle button — hidden on desktop until hover */}
          <button
            type="button"
            aria-label="Opções da mensagem"
            onClick={e => { e.stopPropagation(); setMenuOpen(v => !v) }}
            className={cn(
              'absolute right-1 top-1 z-20 flex h-6 w-6 items-center justify-center rounded-full',
              'font-mono text-[11px] text-ink-4 transition-all',
              'opacity-100 hover:bg-ink/10 md:opacity-0 md:group-hover/message:opacity-100 md:focus:opacity-100',
              menuOpen && 'opacity-100 bg-ink/10',
            )}
          >
            ⌄
          </button>

          {/* Dropdown menu — positioned inside bubble */}
          {menuOpen && (
            <MessageMenu
              isMine={isMine}
              isAdmin={isAdmin}
              isPinned={isPinned}
              canDelete={canDelete}
              onReply={() => { onReply(); setMenuOpen(false) }}
              onPin={() => { onPin(); setMenuOpen(false) }}
              onDelete={() => { onDeleteRequest(); setMenuOpen(false) }}
            />
          )}
        </div>
        <ReactionStrip
          reactions={m.reactions}
          currentUserId={currentUserId}
          onReact={onReact}
          compact={isMine}
        />
      </div>
    </div>
  )
}
