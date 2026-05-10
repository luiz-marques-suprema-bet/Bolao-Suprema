import { cn } from '@/lib/utils'

interface AvatarProps {
  initials: string
  color?: string
  size?: number
  className?: string
  src?: string
}

export function Avatar({ initials, color = '#0D0D0D', size = 36, className, src }: AvatarProps) {
  if (src) {
    return (
      <img
        src={src}
        alt={initials}
        className={cn('rounded-full object-cover flex-shrink-0 select-none', className)}
        style={{ width: size, height: size }}
        onError={e => {
          // fallback to initials on broken image
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
