import { useMemo } from 'react'
import type { ChatMessage } from '@/types'
import { formatDayLabel, minutesBetween } from '../utils/chatUi'
import { DateDivider } from './DateDivider'
import { EmptyChat, ChatSkeleton } from './EmptyChat'
import { MessageBubble } from './MessageBubble'

interface MessageListProps {
  messages: ChatMessage[]
  isLoaded: boolean
  currentUserId?: string
  pinnedId: string | null
  isAdmin: boolean
  scrollRef: React.RefObject<HTMLDivElement | null>
  bottomRef: React.RefObject<HTMLDivElement | null>
  onScroll: () => void
  onReply: (m: ChatMessage) => void
  onPin: (id: string) => void
  onDeleteRequest: (id: string) => void
  onVote: (msgId: string, optId: string) => void
  onOpenProfile: (m: ChatMessage) => void
}

type Item =
  | { kind: 'date'; label: string; key: string }
  | { kind: 'msg'; msg: ChatMessage; grouped: boolean }

export function MessageList({
  messages, isLoaded, currentUserId, pinnedId, isAdmin,
  scrollRef, bottomRef, onScroll,
  onReply, onPin, onDeleteRequest, onVote, onOpenProfile,
}: MessageListProps) {
  const items = useMemo<Item[]>(() => {
    const result: Item[] = []
    let lastDay  = ''
    let lastUser = ''
    let lastTime = ''

    for (let i = 0; i < messages.length; i++) {
      const m   = messages[i]
      const day = new Date(m.createdAt).toDateString()

      if (day !== lastDay) {
        result.push({ kind: 'date', label: formatDayLabel(m.createdAt), key: `sep-${m.createdAt}` })
        lastDay  = day
        lastUser = ''
        lastTime = ''
      }

      const grouped =
        m.userId === lastUser &&
        m.type !== 'poll' &&
        lastTime !== '' &&
        minutesBetween(lastTime, m.createdAt) <= 5

      result.push({ kind: 'msg', msg: m, grouped })
      lastUser = m.userId
      lastTime = m.createdAt
    }
    return result
  }, [messages])

  return (
    <div
      ref={scrollRef}
      onScroll={onScroll}
      className="flex-1 overflow-y-auto overscroll-contain min-h-0 py-2"
    >
      {!isLoaded && <ChatSkeleton />}
      {isLoaded && messages.length === 0 && <EmptyChat />}

      {isLoaded && items.map(item => {
        if (item.kind === 'date') {
          return <DateDivider key={item.key} label={item.label} />
        }
        const { msg: m, grouped } = item
        return (
          <div key={m.id} className={grouped ? 'mt-0.5' : 'mt-3'}>
            <MessageBubble
              message={m}
              grouped={grouped}
              isAdmin={isAdmin}
              isPinned={pinnedId === m.id}
              currentUserId={currentUserId}
              onReply={() => onReply(m)}
              onPin={() => onPin(m.id)}
              onDeleteRequest={() => onDeleteRequest(m.id)}
              onVote={optId => onVote(m.id, optId)}
              onOpenProfile={() => onOpenProfile(m)}
            />
          </div>
        )
      })}

      <div ref={bottomRef} />
    </div>
  )
}
