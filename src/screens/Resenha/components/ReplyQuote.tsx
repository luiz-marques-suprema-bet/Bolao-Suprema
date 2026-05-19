import { cn } from '@/lib/utils'
import { getReplyPreview } from '../utils/chatFormat'

interface ReplyQuoteProps {
  r: { who: string; text: string; type: string }
  isYou: boolean
}

export function ReplyQuote({ r, isYou }: ReplyQuoteProps) {
  return (
    <div className={cn(
      'flex flex-col gap-0.5 mb-1.5 px-2.5 py-1.5 border-l-2 rounded-sm text-[11px] max-w-full overflow-hidden',
      isYou ? 'bg-ink/10 border-ink/50' : 'bg-ink/6 border-ink/30',
    )}>
      <span className="font-mono text-[9px] font-bold text-ink-2 truncate">↩ {r.who}</span>
      <span className="font-sans text-[11px] text-ink-3 truncate">
        {getReplyPreview({ type: r.type as 'text' | 'gif' | 'image' | 'audio', text: r.text })}
      </span>
    </div>
  )
}
