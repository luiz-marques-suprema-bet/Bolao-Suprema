import { useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { optimizedImageUrl } from '@/lib/img'

interface SafeImageProps {
  src?: string | null
  fallbackSrc?: string
  alt: string
  className?: string
  imgClassName?: string
  fit?: 'cover' | 'contain'
  width?: number
}

export function SafeImage({
  src,
  fallbackSrc,
  alt,
  className,
  imgClassName,
  fit = 'cover',
  width = 1000,
}: SafeImageProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const [proxyFailed, setProxyFailed] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const activeSrc = useMemo(() => {
    if (src && src !== failedSrc) return src
    if (fallbackSrc && fallbackSrc !== failedSrc) return fallbackSrc
    return null
  }, [fallbackSrc, failedSrc, src])

  // Reseta o estado de proxy/carregamento quando a imagem-alvo muda.
  useEffect(() => { setProxyFailed(false); setLoaded(false) }, [activeSrc])

  if (!activeSrc) {
    return <div aria-label={alt} className={cn('bg-hairline', className)} />
  }

  // Serve uma versão leve via proxy (conter egress); se o proxy falhar, cai
  // para o arquivo original antes de desistir.
  const display = proxyFailed
    ? activeSrc
    : optimizedImageUrl(activeSrc, { w: width, fit: fit === 'contain' ? 'inside' : 'cover' })

  return (
    <div className={cn('relative overflow-hidden bg-hairline', className)}>
      {!loaded && <div className="absolute inset-0 animate-pulse bg-ink/10" />}
      <img
        src={display}
        alt={alt}
        className={cn(
          'absolute inset-0 h-full w-full transition-opacity duration-300',
          fit === 'cover' ? 'object-cover' : 'object-contain',
          loaded ? 'opacity-100' : 'opacity-0',
          imgClassName,
        )}
        onLoad={() => setLoaded(true)}
        onError={() => {
          if (!proxyFailed) { setProxyFailed(true); return }
          setLoaded(false)
          setFailedSrc(activeSrc)
        }}
      />
    </div>
  )
}
