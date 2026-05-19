interface ResenhaHeaderProps {
  messageCount: number
  isAdmin: boolean
  onCreatePoll: () => void
}

export function ResenhaHeader({ messageCount, isAdmin, onCreatePoll }: ResenhaHeaderProps) {
  return (
    <div className="border-b border-hairline px-4 py-3 flex items-center justify-between flex-shrink-0 bg-paper">
      <div className="flex items-center gap-3">
        <span className="font-display text-2xl">#RESENHA</span>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-green animate-pulse-live" />
          <span className="font-mono text-[10px] text-ink-3">AO VIVO</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {messageCount > 0 && (
          <span className="font-mono text-[10px] text-ink-4">{messageCount} msgs</span>
        )}
        {isAdmin && (
          <button
            onClick={onCreatePoll}
            className="font-mono text-[10px] font-bold px-3 py-1.5 bg-ink text-paper hover:bg-ink-2 transition-colors active:scale-95"
          >
            + ENQUETE
          </button>
        )}
      </div>
    </div>
  )
}
