import { cn } from '@/lib/utils'
import type { ChatReaction } from '@/types'

const QUICK_REACTIONS = ['👍', '😂', '🔥', '👏', '😮', '💚']

interface ReactionStripProps {
  reactions?: ChatReaction[]
  currentUserId?: string
  onReact: (emoji: string) => void
  compact?: boolean
}

export function ReactionStrip({ reactions = [], currentUserId, onReact, compact }: ReactionStripProps) {
  const grouped = QUICK_REACTIONS
    .map(emoji => ({
      emoji,
      count: reactions.filter(reaction => reaction.emoji === emoji).length,
      mine: reactions.some(reaction => reaction.emoji === emoji && reaction.userId === currentUserId),
    }))
    .filter(group => group.count > 0)

  return (
    <div className={cn('mt-1 flex flex-wrap items-center gap-1', compact && 'justify-end')}>
      {grouped.map(group => (
        <button
          key={group.emoji}
          type="button"
          onClick={() => onReact(group.emoji)}
          className={cn(
            'flex h-7 items-center gap-1 rounded-full border px-2 text-[12px] leading-none transition',
            group.mine ? 'border-ink bg-yellow text-ink' : 'border-hairline bg-paper text-ink-2 hover:border-ink',
          )}
          title="Reagir"
        >
          <span>{group.emoji}</span>
          <span className="font-mono text-[10px]">{group.count}</span>
        </button>
      ))}
      <div className="flex h-7 overflow-hidden rounded-full border border-hairline bg-paper">
        {QUICK_REACTIONS.slice(0, compact ? 3 : 6).map(emoji => (
          <button
            key={emoji}
            type="button"
            onClick={() => onReact(emoji)}
            className="h-7 w-7 text-[13px] hover:bg-yellow/40 transition"
            title={`Reagir com ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  )
}
