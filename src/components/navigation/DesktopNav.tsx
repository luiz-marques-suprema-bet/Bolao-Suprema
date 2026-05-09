import { useNavigate, useLocation } from 'react-router-dom'
import { Logo } from '@/components/shared/Logo'
import { Avatar } from '@/components/shared/Avatar'
import { useAuthStore } from '@/stores/auth.store'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { id: 'home',       label: 'HOME',     path: '/home' },
  { id: 'boletim',   label: 'BOLETIM',  path: '/boletim' },
  { id: 'bracket',   label: 'CHAVE',    path: '/bracket' },
  { id: 'prediction',label: 'PALPITAR', path: '/prediction' },
  { id: 'ranking',   label: 'RANKING',  path: '/ranking' },
  { id: 'resenha',   label: 'RESENHA',  path: '/resenha' },
]

export function DesktopNav() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const user = useAuthStore((s) => s.user)

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-paper/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-screen-xl items-center gap-8 px-6 h-14">
        {/* Logo */}
        <button onClick={() => navigate('/home')} className="flex-shrink-0">
          <Logo height={32} />
        </button>

        {/* Nav links */}
        <nav className="flex items-center gap-1 flex-1">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.path
            return (
              <button
                key={item.id}
                onClick={() => navigate(item.path)}
                className={cn(
                  'px-3 py-1.5 font-mono text-[11px] font-bold tracking-eyebrow uppercase transition-colors rounded-sm',
                  active
                    ? 'bg-ink text-paper'
                    : 'text-ink-3 hover:text-ink hover:bg-hairline'
                )}
              >
                {item.label}
              </button>
            )
          })}
        </nav>

        {/* Right: Admin + User */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {user?.isAdmin && (
            <button
              onClick={() => navigate('/admin')}
              className={cn(
                'px-3 py-1.5 font-mono text-[11px] font-bold tracking-eyebrow uppercase transition-colors rounded-sm',
                pathname === '/admin' ? 'bg-red text-white' : 'text-red hover:bg-red/10'
              )}
            >
              ADMIN
            </button>
          )}
          {user && (
            <Avatar initials={user.initials} color={user.color} size={32} />
          )}
        </div>
      </div>
    </header>
  )
}
