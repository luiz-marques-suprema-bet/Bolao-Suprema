import { cn } from '@/lib/utils'

interface AvatarProps {
  initials: string
  color?: string
  size?: number
  className?: string
  src?: string
}

function optimizeUrl(src: string, px: number): string {
  try {
    const url = new URL(src)
    // Only transform Supabase storage URLs
    if (!url.pathname.includes('/storage/v1/object/public/')) return src
    const renderSize = Math.ceil(px * (window.devicePixelRatio || 2))
    url.searchParams.set('width', String(renderSize))
    url.searchParams.set('height', String(renderSize))
    url.searchParams.set('resize', 'cover')
    return url.toString()
  } catch {
    return src
  }
}

export function Avatar({ initials, color = '#0D0D0D', size = 36, className, src }: AvatarProps) {
  if (src) {
    return (
      <img
        src={optimizeUrl(src, size)}
        alt={initials}
        loading="lazy"
        decoding="async"
        className={cn('rounded-full object-cover flex-shrink-0 select-none', className)}
        style={{ width: size, height: size }}
        onError={e => {
          const el = e.currentTarget
          el.style.display = 'none'
          const parent = el.parentElement
          if (parent) parent.dataset.fallback = 'true'
        }}
      />
    )
  }

  return (
    <div
      className={cn(
        'rounded-full flex items-center justify-center font-mono font-bold flex-shrink-0 select-none',
        className
      )}
      style={{
        width: size,
        height: size,
        background: color,
        fontSize: size * 0.35,
        color: '#fff',
        letterSpacing: '-0.02em',
      }}
    >
      {initials}
    </div>
  )
}
