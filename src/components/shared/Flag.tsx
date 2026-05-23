import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { isPlaceholderTeam } from '@/lib/matchGuards'
import type { Team } from '@/types'

interface FlagProps {
  team?: Team | null
  size?: number
  ring?: boolean
  className?: string
  placeholderLabel?: string
}

export function Flag({ team, size = 32, ring = false, className, placeholderLabel = 'A definir' }: FlagProps) {
  const [failed, setFailed] = useState(false)
  const placeholder = failed || isPlaceholderTeam(team)

  useEffect(() => {
    setFailed(false)
  }, [team?.code, team?.flag])

  if (placeholder) {
    return (
      <span
        role="img"
        aria-label={placeholderLabel}
        title={placeholderLabel}
        className={cn(
          'inline-flex items-center justify-center rounded-full border border-dashed border-hairline bg-paper-deep font-mono font-bold text-ink-4 flex-shrink-0',
          ring && 'ring-2 ring-white/40',
          className,
        )}
        style={{ width: size, height: size, fontSize: Math.max(8, Math.round(size * 0.28)) }}
      >
        AD
      </span>
    )
  }

  return (
    <img
      src={team!.flag}
      alt={team!.name}
      width={size}
      height={size}
      onError={() => setFailed(true)}
      className={cn(
        'object-cover rounded-full flex-shrink-0',
        ring && 'ring-2 ring-white/40',
        className
      )}
      style={{ width: size, height: size }}
    />
  )
}
