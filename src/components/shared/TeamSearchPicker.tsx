import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Flag } from '@/components/shared/Flag'
import { TEAMS } from '@/data/teams'

export function TeamSearchPicker({
  value,
  onChange,
}: {
  value?: string
  onChange: (code: string) => void
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen]   = useState(false)

  const selectedTeam = value ? TEAMS[value] : null

  const filtered = (() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return Object.entries(TEAMS)
      .filter(([code, team]) =>
        team.name.toLowerCase().includes(q) ||
        code.toLowerCase().includes(q),
      )
      .slice(0, 10)
  })()

  const select = (code: string) => {
    onChange(code)
    setQuery('')
    setOpen(false)
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-2.5 border-2 border-line-strong bg-surface-2 px-3 py-2.5">
        {selectedTeam && !query && <Flag team={selectedTeam} size={20} />}
        <input
          value={open ? query : (selectedTeam?.name ?? '')}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => { setQuery(''); setOpen(true) }}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          placeholder="ex: Brasil, França, Argentina…"
          className="flex-1 font-sans text-sm bg-transparent outline-none placeholder:text-ink-4 min-w-0"
        />
        {value && (
          <button
            type="button"
            onClick={() => { onChange(''); setQuery('') }}
            className="font-mono text-[11px] text-ink-4 hover:text-ink flex-shrink-0"
          >✕</button>
        )}
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute z-50 left-0 right-0 mt-1 ui-card max-h-56 overflow-y-auto"
          >
            {filtered.length === 0 ? (
              <div className="px-4 py-3 font-mono text-[10px] text-ink-4">
                {query.trim() ? 'Nenhuma seleção encontrada' : 'Digite o nome da seleção…'}
              </div>
            ) : (
              filtered.map(([code, team]) => (
                <button
                  key={code}
                  type="button"
                  onMouseDown={() => select(code)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-surface-hover transition-colors text-left border-b border-hairline last:border-b-0"
                >
                  <Flag team={team} size={22} />
                  <div>
                    <div className="font-mono text-[12px] font-bold">{team.name}</div>
                    <div className="font-mono text-[9px] text-ink-4">{code} · GRUPO {team.group}</div>
                  </div>
                </button>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
