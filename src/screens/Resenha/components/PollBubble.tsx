import { cn } from '@/lib/utils'
import type { ChatMessage } from '@/types'
import { Avatar } from '@/components/shared/Avatar'

interface PollBubbleProps {
  m: ChatMessage
  userId?: string
  onVote: (optId: string) => void
  onOpenProfile: (m: ChatMessage) => void
}

export function PollBubble({ m, userId, onVote, onOpenProfile }: PollBubbleProps) {
  const poll     = m.poll!
  const myVote   = userId ? poll.votes[userId] : null
  const hasVoted = !!myVote
  const total    = Object.keys(poll.votes).length

  return (
    <div className="flex gap-2.5 items-start">
      <button onClick={() => onOpenProfile(m)} className="flex-shrink-0 hover:opacity-80 transition-opacity">
        <Avatar initials={m.initials} color={m.color} src={m.avatarUrl} size={32} />
      </button>
      <div className="flex-1 max-w-sm">
        <button
          onClick={() => onOpenProfile(m)}
          className="font-mono text-[10px] text-ink-3 hover:text-ink transition-colors text-left leading-none mb-1.5"
        >
          <span className="font-bold text-ink">{m.who}</span>
          {m.dept && <span className="text-ink-4"> · {m.dept}</span>}
          <span className="text-ink-4"> · {m.time}</span>
        </button>
        <div className="border-2 border-ink bg-paper p-4">
          <p className="font-display text-[14px] leading-tight mb-4">{poll.question}</p>
          <div className="space-y-2">
            {poll.options.map(opt => {
              const count    = Object.values(poll.votes).filter(v => v === opt.id).length
              const pct      = total > 0 ? Math.round((count / total) * 100) : 0
              const isMyPick = myVote === opt.id
              return (
                <button
                  key={opt.id}
                  onClick={() => !hasVoted && onVote(opt.id)}
                  disabled={hasVoted && !isMyPick}
                  className={cn(
                    'w-full text-left relative overflow-hidden border transition-colors',
                    isMyPick ? 'border-ink' : 'border-hairline',
                    !hasVoted && 'hover:border-line cursor-pointer',
                  )}
                >
                  <div
                    className={cn('absolute inset-0 transition-all duration-700', isMyPick ? 'bg-yellow/50' : 'bg-paper-deep/70')}
                    style={{ width: hasVoted ? `${pct}%` : '0%' }}
                  />
                  <div className="relative flex items-center justify-between px-3 py-2.5">
                    <span className={cn('font-sans text-[12px]', isMyPick ? 'font-bold' : 'text-ink-2')}>
                      {isMyPick && '✓ '}{opt.text}
                    </span>
                    {hasVoted && <span className="font-mono text-[10px] text-ink-3 ml-2 flex-shrink-0">{pct}%</span>}
                  </div>
                </button>
              )
            })}
          </div>
          <p className="font-mono text-[10px] text-ink-4 mt-3">
            {total} {total === 1 ? 'voto' : 'votos'}
            {!hasVoted && ' · toque para votar'}
          </p>
        </div>
      </div>
    </div>
  )
}
