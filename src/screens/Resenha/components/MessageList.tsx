import { useMemo } from 'react'
import type { ChatMessage } from '@/types'
import { formatDayLabel } from '../utils/chatFormat'
import { DateSeparator } from './DateSeparator'
import { EmptyState, SkeletonList } from './EmptyState'
import { MessageBubble } from './MessageBubble'
import { PollBubble } from './PollBubble'
import { cn } from '@/lib/utils'

interface MessageListProps {
  messages: ChatMessage[]
  isLoaded: boolean
  currentUserId?: string
  pinnedId: string | null
  menuOpenId: string | null
  isAdmin: boolean
  scrollRef: React.RefObject<HTMLDivElement | null>
  bottomRef: React.RefObject<HTMLDivElement | null>
  onScroll: () => void
  onOpenMenu: (id: string | null) => void
  onReply: (message: ChatMessage) => void
  onPin: (id: string) => void
  onDeleteRequest: (id: string) => void
  onVote: (messageId: string, optionId: string) => void
  onOpenProfile: (message: ChatMessage) => void
}

type EnrichedItem =
  | { kind: 'date'; label: string; key: string }
  | { kind: 'msg'; msg: ChatMessage; grouped: boolean; isGroupEnd: boolean }

export function MessageList({
  messages, isLoaded, currentUserId, pinnedId, menuOpenId, isAdmin,
  scrollRef, bottomRef, onScroll, onOpenMenu, onReply, onPin, onDeleteRequest, onVote, onOpenProfile,
}: MessageListProps) {
  const enriched = useMemo<EnrichedItem[]>(() => {
    const items: EnrichedItem[] = []
    let lastDay  = ''
    let lastUser = ''

    for (let i = 0; i < messages.length; i++) {
      const m   = messages[i]
      const day = new Date(m.createdAt).toDateString()

      if (day !== lastDay) {
        items.push({ kind: 'date', label: formatDayLabel(m.createdAt), key: `sep-${m.createdAt}` })
        lastDay  = day
        lastUser = ''
      }

      const grouped    = m.userId === lastUser && m.type !== 'poll'
      const nextMsg    = messages[i + 1]
      const isGroupEnd = !nextMsg ||
        new Date(nextMsg.createdAt).toDateString() !== day ||
        nextMsg.userId !== m.userId ||
        nextMsg.type === 'poll'

      items.push({ kind: 'msg', msg: m, grouped, isGroupEnd })
      lastUser = m.userId
    }
    return items
  }, [messages])

  return (
    <div
      ref={scrollRef}
      onScroll={onScroll}
      className="flex-1 overflow-y-auto overscroll-contain py-3 min-h-0"
    >
      {!isLoaded && <SkeletonList />}

      {isLoaded && messages.length === 0 && <EmptyState />}

      {enriched.map(item => {
        if (item.kind === 'date') {
          return <DateSeparator key={item.key} label={item.label} />
        }

        const { msg: m, grouped, isGroupEnd } = item
        const menuOpen = menuOpenId === m.id

        return (
          <div
            key={m.id}
            className={cn('px-3 md:px-5', grouped ? 'mt-0.5' : 'mt-4', isGroupEnd && 'mb-1')}
          >
            {m.type === 'poll' && m.poll ? (
              <PollBubble
                m={m}
                userId={currentUserId}
                onVote={optId => onVote(m.id, optId)}
                onOpenProfile={onOpenProfile}
              />
            ) : (
              <MessageBubble
                message={m}
                grouped={grouped}
                menuOpen={menuOpen}
                isAdmin={isAdmin}
                isPinned={pinnedId === m.id}
                canDelete={isAdmin || (m.isYou ?? false)}
                onToggleMenu={e => { e.stopPropagation(); onOpenMenu(menuOpen ? null : m.id) }}
                onReply={() => { onReply(m); onOpenMenu(null) }}
                onPin={() => { onPin(m.id); onOpenMenu(null) }}
                onDeleteRequest={() => { onDeleteRequest(m.id); onOpenMenu(null) }}
                onOpenProfile={() => onOpenProfile(m)}
              />
            )}
          </div>
        )
      })}

      <div ref={bottomRef} />
    </div>
  )
}
