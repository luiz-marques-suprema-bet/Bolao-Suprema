import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { fetchGifs, type GifResult } from '../utils/gifApi'

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
