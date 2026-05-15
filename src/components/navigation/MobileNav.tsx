import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth.store'
import { Avatar } from '@/components/shared/Avatar'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { id: 'home',       label: 'HOME',    icon: '○',  path: '/home' },
  { id: 'boletim',   label: 'BOLETIM', icon: '≡',  path: '/boletim' },
  { id: 'prediction',label: 'PALPITAR',icon: '✦',  path: '/prediction' },
  { id: 'mine',      label: 'MEUS',    icon: '✓',  path: '/meus-palpites' },
  { id: 'ranking',   label: 'RANKING', icon: '▲',  path: '/ranking' },
  { id: 'alerts',    label: 'AVISOS',  icon: '!',   path: '/notificacoes' },
  { id: 'resenha',   label: 'RESENHA', icon: '◎',  path: '/resenha' },
  { id: 'profile',   label: 'EU',      icon: '◈',  path: '/profile' },
]

export function MobileNav() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const user = useAuthStore(s => s.user)

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-line bg-paper"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="grid grid-cols-8">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.path
          const isProfile = item.id === 'profile'

          return (
            <button
              key={item.id}
              onClick={() => navigate(item.path)}
              className={cn(
                'relative flex flex-col items-center justify-center gap-0.5 py-2.5 transition-colors',
                active ? 'text-ink' : 'text-ink-4'
              )}
            >
              {isProfile && user ? (
                <Avatar
                  initials={user.initials}
                  color={user.color}
                  src={user.avatarUrl}
                  size={20}
                />
              ) : (
                <span className="text-base leading-none">{item.icon}</span>
              )}
              <span className={cn('font-mono text-[7px] font-bold tracking-eyebrow', active && 'text-ink')}>
                {isProfile && user ? (user.firstName?.toUpperCase() || 'EU') : item.label}
              </span>
              {active && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-6 bg-ink" />
              )}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
