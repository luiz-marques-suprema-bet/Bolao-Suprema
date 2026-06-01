import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNavAlerts } from '@/hooks/useNavAlerts'
import { cn } from '@/lib/utils'

function BellIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </svg>
  )
}

export function NotificationBell() {
  const navigate = useNavigate()
  const { urgentPicks, unseenNoticeCount, totalCount, hasUrgentPick } = useNavAlerts()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label="Notificacoes"
        onClick={() => setOpen(value => !value)}
        className={cn(
          'relative grid h-8 w-8 place-items-center border border-hairline bg-surface-2 text-ink transition-colors hover:border-line-strong hover:bg-surface-hover',
          hasUrgentPick && 'border-red text-red',
        )}
      >
        <BellIcon className="h-4 w-4" />
        {totalCount > 0 && (
          <span className={cn(
            'absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center border border-paper px-1 font-mono text-[8px] font-bold leading-none text-white',
            hasUrgentPick ? 'bg-red' : 'bg-yellow text-[#0D0D0D]',
          )}>
            {totalCount > 9 ? '9+' : totalCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 border-2 border-line-strong bg-card shadow-card">
          <div className="border-b border-hairline bg-inverse px-4 py-3 text-inverse-text">
            <div className="font-display text-xl leading-none">ALERTAS</div>
            <div className="mt-1 font-mono text-[9px] text-inverse-text/55">
              palpites vencendo e avisos novos
            </div>
          </div>

          <div className="divide-y divide-hairline">
            {urgentPicks.length > 0 ? urgentPicks.map(item => (
              <button
                key={item.matchId}
                type="button"
                onClick={() => { setOpen(false); navigate(`/prediction/${item.matchId}`) }}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-red/5"
              >
                <div>
                  <div className="font-mono text-[10px] font-bold text-red">PALPITE FECHANDO</div>
                  <div className="font-display text-xl leading-none">{item.label}</div>
                  <div className="mt-1 font-mono text-[9px] text-ink-4">{item.detail}</div>
                </div>
                <span className="font-mono text-[9px] font-bold text-red">{item.hoursLeft}h</span>
              </button>
            )) : (
              <div className="px-4 py-3 font-mono text-[10px] text-ink-4">
                Nenhum palpite fechando nas proximas 72h.
              </div>
            )}

            {unseenNoticeCount > 0 && (
              <button
                type="button"
                onClick={() => { setOpen(false); navigate('/notificacoes') }}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-yellow/15"
              >
                <div>
                  <div className="font-mono text-[10px] font-bold text-ink">AVISO NOVO</div>
                  <div className="mt-1 font-mono text-[9px] text-ink-4">comunicado publicado pela organizacao</div>
                </div>
                <span className="bg-yellow px-2 py-1 font-mono text-[9px] font-bold text-[#0D0D0D]">
                  {unseenNoticeCount}
                </span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => { setOpen(false); navigate('/notificacoes') }}
            className="w-full border-t border-hairline px-4 py-3 text-left font-mono text-[10px] font-bold tracking-eyebrow hover:bg-surface-hover"
          >
            VER CENTRAL DE AVISOS →
          </button>
        </div>
      )}
    </div>
  )
}

