import { useNavigate, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { id: 'home',       label: 'HOME',     icon: '⚽', path: '/home' },
  { id: 'boletim',   label: 'BOLETIM',  icon: '◧', path: '/boletim' },
  { id: 'prediction',label: 'PALPITAR', icon: '✦', path: '/prediction' },
  { id: 'ranking',   label: 'RANKING',  icon: '▲', path: '/ranking' },
  { id: 'resenha',   label: 'RESENHA',  icon: '◉', path: '/resenha' },
]

export function MobileNav() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-line bg-paper"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="grid grid-cols-5">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.path
          return (
            <button
              key={item.id}
              onClick={() => navigate(item.path)}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 py-3 transition-colors',
                active ? 'text-ink' : 'text-ink-4'
              )}
            >
              <span className="text-lg leading-none">{item.icon}</span>
              <span
                className={cn(
                  'font-mono text-[8px] font-bold tracking-eyebrow',
                  active && 'text-ink'
                )}
              >
                {item.label}
              </span>
              {active && (
                <span className="absolute top-0 h-0.5 w-8 bg-ink rounded-full" />
              )}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
