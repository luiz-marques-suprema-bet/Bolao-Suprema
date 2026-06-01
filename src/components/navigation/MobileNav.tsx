import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth.store'
import { useTheme } from '@/context/ThemeContext'
import { Avatar } from '@/components/shared/Avatar'
import { useNavAlerts } from '@/hooks/useNavAlerts'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { id: 'home',       label: 'HOME',    icon: '⌂',  path: '/home' },
  { id: 'prediction', label: 'PALPITAR',icon: '⊕',  path: '/prediction' },
  { id: 'mine',       label: 'PALPITES',icon: '≡',  path: '/meus-palpites' },
  { id: 'ranking',    label: 'RANKING', icon: '★',  path: '/ranking' },
  { id: 'alerts',     label: 'AVISOS',  icon: '◈',  path: '/notificacoes' },
  { id: 'resenha',    label: 'RESENHA', icon: '◉',  path: '/resenha' },
  { id: 'profile',    label: 'EU',      icon: '◈',  path: '/profile' },
]

export function MobileNav() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const user = useAuthStore(s => s.user)
  const { theme, toggleTheme } = useTheme()
  const { totalCount, hasUrgentPick } = useNavAlerts()
  const isDark = theme === 'dark'

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-hairline bg-paper/95 shadow-[0_-16px_34px_rgba(0,0,0,0.18)] backdrop-blur-md"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="grid h-14 grid-cols-8">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.path
          const isProfile = item.id === 'profile'
          const showAlertBadge = item.id === 'alerts' && totalCount > 0

          return (
            <button
              key={item.id}
              onClick={() => navigate(item.path)}
              className={cn(
                'relative flex min-w-0 flex-col items-center justify-center gap-0.5 py-2.5 transition-all active:scale-90 active:opacity-60',
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
                <span className="text-[13px] leading-none">{item.icon}</span>
              )}
              <span className={cn('max-w-full truncate px-0.5 font-mono text-[6.5px] font-bold tracking-eyebrow', active && 'text-ink')}>
                {isProfile && user ? (user.firstName?.toUpperCase() || 'EU') : item.label}
              </span>
              {active && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-6 bg-ink" />
              )}
              {showAlertBadge && (
                <span className={cn(
                  'absolute right-2 top-1 grid h-3.5 min-w-3.5 place-items-center px-0.5 font-mono text-[7px] font-bold leading-none text-white',
                  hasUrgentPick ? 'bg-red' : 'bg-yellow text-[#0D0D0D]',
                )}>
                  {totalCount > 9 ? '9+' : totalCount}
                </span>
              )}
            </button>
          )
        })}

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          aria-label={isDark ? 'Ativar tema claro' : 'Ativar tema escuro'}
          className="flex min-w-0 flex-col items-center justify-center gap-0.5 py-2.5 text-ink-4 transition-all active:scale-90 active:opacity-60"
        >
          <span className="text-[13px] leading-none">{isDark ? '☾' : '☀'}</span>
          <span className="font-mono text-[6.5px] font-bold tracking-eyebrow">TEMA</span>
        </button>
      </div>
    </nav>
  )
}
