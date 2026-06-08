import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { searchPlayers, type PlayerResult } from '@/lib/thesportsdb'

// Seletor de jogador com busca + foto (TheSportsDB). Mesma experiência usada
// na personalização de perfil; reaproveitado também na escolha do artilheiro.
interface PlayerSearchPickerProps {
  value: string
  imgUrl?: string
  onChange: (name: string, img: string | undefined) => void
  placeholder?: string
}

export function PlayerSearchPicker({ value, imgUrl, onChange, placeholder }: PlayerSearchPickerProps) {
  const [query, setQuery]     = useState(value)
  const [results, setResults] = useState<PlayerResult[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen]       = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const search = (q: string) => {
    clearTimeout(timer.current)
    if (!q.trim()) { setResults([]); setOpen(false); return }
    timer.current = setTimeout(async () => {
      setLoading(true)
      const res = await searchPlayers(q)
      setResults(res)
      setLoading(false)
      setOpen(res.length > 0)
    }, 500)
  }

  const select = (p: PlayerResult) => {
    setQuery(p.strPlayer)
    setOpen(false)
    onChange(p.strPlayer, p.strCutout ?? p.strThumb ?? undefined)
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        {imgUrl && (
          <div className="w-10 h-12 flex-shrink-0 overflow-hidden rounded-sm bg-paper-deep border border-hairline">
            <img src={imgUrl} alt="" className="w-full h-full object-contain object-bottom" />
          </div>
        )}
        <div className="flex-1 relative">
          <input
            value={query}
            onChange={e => { setQuery(e.target.value); search(e.target.value) }}
            onFocus={() => { if (results.length) setOpen(true) }}
            onBlur={() => setTimeout(() => setOpen(false), 200)}
            placeholder={placeholder ?? 'ex: Vini Jr, Mbappé, Haaland…'}
            className="w-full border-2 border-ink px-3 py-2.5 font-sans text-sm bg-transparent outline-none pr-8"
          />
          {loading && (
            <span className="absolute right-2 top-1/2 -translate-y-1/2 font-mono text-[9px] text-ink-3 animate-pulse">…</span>
          )}
          {query && !loading && (
            <button type="button" onClick={() => { setQuery(''); setOpen(false); onChange('', undefined) }}
              className="absolute right-2 top-1/2 -translate-y-1/2 font-mono text-[11px] text-ink-4 hover:text-ink">✕</button>
          )}
        </div>
      </div>
      <AnimatePresence>
        {open && results.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute z-50 left-0 right-0 mt-1 bg-paper border-2 border-ink shadow-card overflow-hidden max-h-64 overflow-y-auto"
          >
            {results.map(p => (
              <button key={p.idPlayer} type="button" onMouseDown={() => select(p)}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-paper-deep transition-colors text-left border-b border-hairline last:border-b-0">
                {(p.strThumb || p.strCutout) ? (
                  <img src={p.strThumb ?? p.strCutout ?? ''} alt=""
                    className="w-9 h-9 object-cover object-top rounded-sm flex-shrink-0 bg-paper-deep" />
                ) : (
                  <div className="w-9 h-9 bg-paper-deep flex-shrink-0 rounded-sm flex items-center justify-center">
                    <span className="font-mono text-[9px] text-ink-4">?</span>
                  </div>
                )}
                <div className="min-w-0">
                  <div className="font-mono text-[12px] font-bold truncate">{p.strPlayer}</div>
                  <div className="font-mono text-[10px] text-ink-3 truncate">{p.strTeam} · {p.strNationality}</div>
                </div>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
