import { isSafeHttpUrl } from '@/lib/security'

interface VideoBubbleProps {
  src?: string
  isNote?: boolean
}

export function VideoBubble({ src, isNote }: VideoBubbleProps) {
  if (!isSafeHttpUrl(src)) return null

  if (isNote) {
    return (
      <video
        src={src}
        controls
        playsInline
        preload="metadata"
        className="aspect-square h-44 w-44 rounded-full border-2 border-ink object-cover bg-ink"
      />
    )
  }

  return (
    <video
      src={src}
      controls
      playsInline
      preload="metadata"
      className="max-h-72 w-full rounded bg-ink object-contain"
    />
  )
}
