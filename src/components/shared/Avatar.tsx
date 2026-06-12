import { useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { optimizedAvatarUrl } from '@/lib/img'

interface AvatarProps {
  initials: string
  color?: string
  size?: number
  className?: string
  src?: string
}

// Foto via proxy de imagem (ver @/lib/img). Em caso de falha do proxy, cai para
// a imagem original; se essa tambem falhar, mostramos as iniciais.
export function Avatar({ initials, color = '#0D0D0D', size = 36, className, src }: AvatarProps) {
  // 0 = proxy otimizado · 1 = original (fallback) · 2 = iniciais (falhou tudo)
  const [stage, setStage] = useState<0 | 1 | 2>(0)
  useEffect(() => { setStage(0) }, [src])

  const optimized = useMemo(() => (src ? optimizedAvatarUrl(src, size) : ''), [src, size])

  if (src && stage < 2) {
    return (
      <img
        src={stage === 0 ? optimized : src}
        alt={initials}
        loading="lazy"
        decoding="async"
        className={cn('rounded-full object-cover flex-shrink-0 select-none bg-paper-deep', className)}
        style={{ width: size, height: size }}
        onError={() => setStage(s => (s + 1) as 0 | 1 | 2)}
      />
    )
  }

  return (
    <div
      className={cn(
        'rounded-full flex items-center justify-center font-mono font-bold flex-shrink-0 select-none',
        className,
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
