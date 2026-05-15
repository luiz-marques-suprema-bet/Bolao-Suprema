import { useMemo, useState } from 'react'
import { cn } from '@/lib/utils'

interface SafeImageProps {
  src?: string | null
  fallbackSrc?: string
  alt: string
  className?: string
  imgClassName?: string
  fit?: 'cover' | 'contain'
}

export function SafeImage({
  src,
  fallbackSrc,
  alt,
  className,
  imgClassName,
  fit = 'cover',
}: SafeImageProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const activeSrc = useMemo(() => {
    if (src && src !== failedSrc) return src
    if (fallbackSrc && fallbackSrc !== failedSrc) return fallbackSrc
    return null
  }, [fallbackSrc, failedSrc, src])

  if (!activeSrc) {
    return <div aria-label={alt} className={cn('bg-hairline', className)} />
  }

  return (
    <div className={cn('relative overflow-hidden bg-hairline', className)}>
      {!loaded && <div className="absolute inset-0 animate-pulse bg-ink/10" />}
      <img
        src={activeSrc}
        alt={alt}
        className={cn(
          'absolute inset-0 h-full w-full transition-opacity duration-300',
          fit === 'cover' ? 'object-cover' : 'object-contain',
          loaded ? 'opacity-100' : 'opacity-0',
          imgClassName,
        )}
        onLoad={() => setLoaded(true)}
        onError={() => {
          setLoaded(false)
          setFailedSrc(activeSrc)
        }}
      />
    </div>
  )
}
