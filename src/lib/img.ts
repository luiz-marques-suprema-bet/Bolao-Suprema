// Otimização de imagens do Supabase Storage.
//
// As fotos (avatares, banners) são guardadas em tamanho original — podem ter
// vários MB — e a URL pública do Supabase NÃO redimensiona (a transformação
// nativa exige plano pago / dá 403 no free). Em listas com dezenas de fotos
// isso trava o carregamento.
//
// Solução: roteamos as imagens do storage por um proxy gratuito e com CDN
// (images.weserv.nl), que entrega um webp pequeno (ex.: 2.5MB → ~1KB). URLs que
// não são do storage público passam direto. Em caso de falha do proxy, o
// componente cai para a imagem original (ver Avatar.tsx).

interface ImgOpts {
  w: number
  h?: number
  fit?: 'cover' | 'inside'
}

export function optimizedImageUrl(src: string, opts: ImgOpts): string {
  try {
    const url = new URL(src)
    if (!url.pathname.includes('/storage/v1/object/public/')) return src
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 2 : 2
    const w = Math.min(1600, Math.ceil(opts.w * dpr))
    const h = opts.h ? Math.min(1600, Math.ceil(opts.h * dpr)) : undefined
    const source = encodeURIComponent(url.host + url.pathname + url.search)
    const params = [`url=${source}`, `w=${w}`]
    if (h) params.push(`h=${h}`)
    params.push(`fit=${opts.fit ?? 'cover'}`, 'output=webp', 'q=80')
    return `https://images.weserv.nl/?${params.join('&')}`
  } catch {
    return src
  }
}

export function optimizedAvatarUrl(src: string, px: number): string {
  return optimizedImageUrl(src, { w: px, h: px, fit: 'cover' })
}
