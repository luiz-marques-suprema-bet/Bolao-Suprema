import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Avatar } from '@/components/shared/Avatar'
import type { ChatPoll } from '@/types'
import type { ChatProfile } from '@/stores/chat.store'

interface PollCardProps {
  poll: ChatPoll
  userId?: string
  profiles?: ChatProfile[]
  onVote: (optId: string) => void
}

export function PollCard({ poll, userId, profiles = [], onVote }: PollCardProps) {
  const [showVoters, setShowVoters] = useState(false)
  const myVote = userId ? poll.votes[userId] : null
  const hasVoted = !!myVote
  const total = Object.keys(poll.votes).length

  const voterName = (uid: string) => {
    const profile = profiles.find(item => item.id === uid)
    return profile ? (`${profile.firstName} ${profile.lastName}`.trim() || profile.initials) : 'Participante'
  }

  return (
    <div className="min-w-[220px] rounded-2xl border border-ink/20 bg-paper p-4">
      <p className="font-display text-[15px] leading-tight mb-4">{poll.question}</p>
      <div className="space-y-2">
        {poll.options.map(option => {
          const voters = Object.entries(poll.votes).filter(([, opt]) => opt === option.id).map(([uid]) => uid)
          const count = voters.length
          const pct = total > 0 ? Math.round((count / total) * 100) : 0
          const isMyPick = myVote === option.id
          return (
            <div key={option.id}>
              <button
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

              {showVoters && count > 0 && (
                <div className="mt-1.5 mb-0.5 flex flex-wrap items-center gap-1.5 pl-1">
                  {voters.map(uid => {
                    const profile = profiles.find(item => item.id === uid)
                    return (
                      <span key={uid} className="inline-flex items-center gap-1 rounded-full border border-hairline bg-surface-2 px-1.5 py-0.5">
                        <Avatar initials={profile?.initials ?? '?'} color={profile?.color ?? '#777'} src={profile?.avatarUrl} size={14} />
                        <span className="font-mono text-[9px] text-ink-3">{voterName(uid)}</span>
                      </span>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <p className="font-mono text-[10px] text-ink-4">
          {total} {total === 1 ? 'voto' : 'votos'}
          {!hasVoted && ' - toque para votar'}
        </p>
        {total > 0 && (
          <button
            type="button"
            onClick={() => setShowVoters(value => !value)}
            className="font-mono text-[10px] font-bold text-green-deep hover:underline"
          >
            {showVoters ? 'ocultar quem votou' : 'ver quem votou'}
          </button>
        )}
      </div>
    </div>
  )
}
