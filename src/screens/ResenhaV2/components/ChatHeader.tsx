interface ChatHeaderProps {
  messageCount: number
  onlineCount: number
  typingLabel?: string
  onCreatePoll: () => void
}

export function ChatHeader({ messageCount, onlineCount, typingLabel, onCreatePoll }: ChatHeaderProps) {
  return (
    <div className="border-b border-line bg-paper px-4 py-3 flex items-center justify-between gap-3 flex-shrink-0">
      <div className="min-w-0 flex items-center gap-3">
        <span className="font-display text-2xl leading-none">#RESENHA</span>
        <div className="hidden sm:flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-green animate-pulse-live" />
          <span className="font-mono text-[10px] text-ink-3">
            {onlineCount > 0 ? `${onlineCount} online` : 'AO VIVO'}
          </span>
        </div>
        {typingLabel && (
          <span className="hidden md:inline truncate font-mono text-[10px] text-green max-w-[260px]">
            {typingLabel}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 sm:gap-3">
        {messageCount > 0 && (
          <span className="hidden sm:inline font-mono text-[10px] text-ink-4">{messageCount} msgs</span>
        )}
        <button
          onClick={onCreatePoll}
          className="font-mono text-[10px] font-bold px-3 py-1.5 bg-ink text-paper hover:bg-ink-2 transition-colors active:scale-95"
        >
          + ENQUETE
        </button>
      </div>
    </div>
  )
}
