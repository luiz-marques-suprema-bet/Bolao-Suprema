export interface GifResult { id: string; url: string; preview: string }

const TENOR_V1_KEY = 'LIVDSRZULELA'
const TENOR_V2_KEY = import.meta.env.VITE_TENOR_KEY as string | undefined

export async function fetchGifs(query: string): Promise<GifResult[]> {
  const q = query.trim()

  try {
    const base   = 'https://g.tenor.com/v1'
    const params = new URLSearchParams({ key: TENOR_V1_KEY, limit: '24', contentfilter: 'medium', media_filter: 'minimal' })
    if (q) params.set('q', q)
    const url  = q ? `${base}/search?${params}` : `${base}/trending?${params}`
    const res  = await fetch(url)
    if (res.ok) {
      const data = await res.json() as { results: { id: string; media: { gif?: { url: string }; tinygif?: { url: string } }[] }[] }
      const gifs = (data.results ?? []).map(r => ({
        id: r.id, url: r.media[0]?.gif?.url ?? '', preview: r.media[0]?.tinygif?.url ?? r.media[0]?.gif?.url ?? '',
      })).filter(g => g.url)
      if (gifs.length > 0) return gifs
    }
  } catch { /* fall through to v2 */ }

  if (TENOR_V2_KEY) {
    try {
      const params = new URLSearchParams({ key: TENOR_V2_KEY, client_key: 'bolao_suprema', limit: '24', contentfilter: 'medium', media_filter: 'gif,tinygif' })
      if (q) params.set('q', q)
      const base = 'https://tenor.googleapis.com/v2'
      const url  = q ? `${base}/search?${params}` : `${base}/featured?${params}`
      const res  = await fetch(url)
      if (res.ok) {
        const data = await res.json() as { results: { id: string; media_formats: { gif?: { url: string }; tinygif?: { url: string } } }[] }
        const gifs = (data.results ?? []).map(r => ({
          id: r.id, url: r.media_formats.gif?.url ?? '', preview: r.media_formats.tinygif?.url ?? r.media_formats.gif?.url ?? '',
        })).filter(g => g.url)
        if (gifs.length > 0) return gifs
      }
    } catch { /* fall through */ }
  }

  return []
}
