import { cn } from '@/lib/utils'
import type { ChatPoll } from '@/types'

interface PollCardProps {
  poll: ChatPoll
  userId?: string
  onVote: (optId: string) => void
}

export function PollCard({ poll, userId, onVote }: PollCardProps) {
  const myVote = userId ? poll.votes[userId] : null
  const hasVoted = !!myVote
  const total = Object.keys(poll.votes).length

  return (
    <div className="min-w-[220px] rounded-2xl border border-ink/20 bg-paper p-4">
      <p className="font-display text-[15px] leading-tight mb-4">{poll.question}</p>
      <div className="space-y-2">
        {poll.options.map(option => {
          const count = Object.values(poll.votes).filter(vote => vote === option.id).length
          const pct = total > 0 ? Math.round((count / total) * 100) : 0
          const isMyPick = myVote === option.id
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onVote(option.id)}
              className={cn(
                'w-full text-left relative overflow-hidden rounded-xl border transition-colors',
                isMyPick ? 'border-green' : 'border-hairline',
                'hover:border-ink',
              )}
            >
              <div
                className={cn('absolute inset-0 transition-all duration-700', isMyPick ? 'bg-green/15' : 'bg-yellow/20')}
                style={{ width: hasVoted ? `${pct}%` : '0%' }}
              />
              <div className="relative flex items-center justify-between px-3 py-2.5">
                <span className={cn('font-sans text-[12px]', isMyPick ? 'font-bold text-green' : 'text-ink-2')}>
                  {isMyPick && 'OK '}
                  {option.text}
                </span>
                {hasVoted && (
                  <span className="font-mono text-[10px] text-ink-3 ml-2 flex-shrink-0">{pct}%</span>
                )}
              </div>
            </button>
          )
        })}
      </div>
      <p className="font-mono text-[10px] text-ink-4 mt-3">
        {total} {total === 1 ? 'voto' : 'votos'}
        {!hasVoted && ' - toque para votar'}
      </p>
    </div>
  )
}
