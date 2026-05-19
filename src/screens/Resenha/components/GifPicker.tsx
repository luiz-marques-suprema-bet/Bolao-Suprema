import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'

const TENOR_V1_KEY = 'LIVDSRZULELA'
const TENOR_V2_KEY = import.meta.env.VITE_TENOR_KEY as string | undefined

interface GifResult { id: string; url: string; preview: string }

async function fetchGifs(query: string): Promise<GifResult[]> {
  const q = query.trim()
  try {
    const base   = 'https://g.tenor.com/v1'
    const params = new URLSearchParams({ key: TENOR_V1_KEY, limit: '24', contentfilter: 'medium', media_filter: 'minimal' })
    if (q) params.set('q', q)
    const url = q ? `${base}/search?${params}` : `${base}/trending?${params}`
    const res = await fetch(url)
    if (res.ok) {
      const data = await res.json() as { results: { id: string; media: { gif?: { url: string }; tinygif?: { url: string } }[] }[] }
      const gifs = (data.results ?? []).map(r => ({
        id: r.id, url: r.media[0]?.gif?.url ?? '', preview: r.media[0]?.tinygif?.url ?? r.media[0]?.gif?.url ?? '',
      })).filter(g => g.url)
      if (gifs.length > 0) return gifs
    }
  } catch { /* fall through */ }

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

interface GifPickerProps {
  onSelect: (url: string) => void
  onClose: () => void
}

export function GifPicker({ onSelect, onClose }: GifPickerProps) {
  const [query, setQuery]     = useState('')
  const [gifs, setGifs]       = useState<GifResult[]>([])
  const [loading, setLoading] = useState(true)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    setLoading(true)
    fetchGifs('').then(g => { setGifs(g); setLoading(false) })
  }, [])

  useEffect(() => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      setLoading(true)
      fetchGifs(query).then(g => { setGifs(g); setLoading(false) })
    }, query.trim() ? 420 : 0)
    return () => clearTimeout(timer.current)
  }, [query])

  return (
    <motion.div
      initial={{ height: 0 }} animate={{ height: 300 }} exit={{ height: 0 }}
      transition={{ type: 'spring', damping: 28, stiffness: 320 }}
      className="overflow-hidden border-t border-hairline bg-paper-deep flex-shrink-0"
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b border-hairline bg-paper">
        <span className="font-mono text-[10px] text-ink-4 flex-shrink-0">GIF</span>
        <input
          value={query} onChange={e => setQuery(e.target.value)}
          placeholder="pesquisar gif..."
          autoFocus
          className="flex-1 bg-transparent font-sans text-[13px] outline-none placeholder:text-ink-4"
        />
        <button onClick={onClose} className="font-mono text-[10px] text-ink-3 hover:text-red px-1 flex-shrink-0">✕</button>
      </div>
      <div className="h-[calc(300px-41px)] overflow-y-auto overscroll-contain">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <span className="font-mono text-[10px] text-ink-4 animate-pulse">BUSCANDO...</span>
          </div>
        ) : gifs.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <span className="font-mono text-[10px] text-ink-4">NENHUM GIF ENCONTRADO</span>
          </div>
        ) : (
          <div className="grid grid-cols-3 md:grid-cols-4 gap-0.5 p-1">
            {gifs.map(g => (
              <button
                key={g.id}
                onClick={() => { onSelect(g.url); onClose() }}
                className="aspect-square overflow-hidden bg-hairline hover:opacity-80 transition-opacity"
              >
                <img src={g.preview} alt="" className="w-full h-full object-cover" loading="lazy" />
              </button>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  )
}
