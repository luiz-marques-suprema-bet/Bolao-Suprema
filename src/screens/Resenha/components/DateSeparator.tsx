export function DateSeparator({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="flex-1 h-px bg-hairline" />
      <span className="font-mono text-[9px] text-ink-4 tracking-eyebrow">{label}</span>
      <div className="flex-1 h-px bg-hairline" />
    </div>
  )
}
