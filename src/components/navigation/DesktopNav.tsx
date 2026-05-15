import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Logo } from '@/components/shared/Logo'
import { Avatar } from '@/components/shared/Avatar'
import { useAuthStore } from '@/stores/auth.store'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { id: 'home',       label: 'HOME',     path: '/home' },
  { id: 'boletim',   label: 'BOLETIM',  path: '/boletim' },
  { id: 'prediction',label: 'PALPITAR', path: '/prediction' },
  { id: 'mine',      label: 'MEUS',     path: '/meus-palpites' },
  { id: 'ranking',   label: 'RANKING',  path: '/ranking' },
  { id: 'rules',     label: 'REGRAS',   path: '/regulamento' },
  { id: 'alerts',    label: 'AVISOS',   path: '/notificacoes' },
  { id: 'resenha',   label: 'RESENHA',  path: '/resenha' },
]

export function DesktopNav() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const user = useAuthStore(s => s.user)
  const signOut = useAuthStore(s => s.signOut)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    if (menuOpen) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [menuOpen])

  const handleSignOut = async () => {
    setMenuOpen(false)
    await signOut()
    navigate('/login')
  }

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-paper/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-screen-xl items-center gap-8 px-6 h-14">

        <button onClick={() => navigate('/home')} className="flex-shrink-0">
          <Logo height={48} />
        </button>

        <nav className="flex items-center gap-1 flex-1">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.path
            return (
              <button
                key={item.id}
                onClick={() => navigate(item.path)}
                className={cn(
                  'px-3 py-1.5 font-mono text-[11px] font-bold tracking-eyebrow uppercase transition-colors rounded-sm',
                  active ? 'bg-ink text-paper' : 'text-ink-3 hover:text-ink hover:bg-hairline'
                )}
              >
                {item.label}
              </button>
            )
          })}
        </nav>

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
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen(v => !v)}
                className="flex items-center gap-2 hover:opacity-80 transition-opacity"
              >
                <Avatar initials={user.initials} color={user.color} src={user.avatarUrl} size={32} />
                <span className="font-mono text-[10px] text-ink-3 tracking-eyebrow">
                  {user.firstName || 'PERFIL'}
                </span>
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-full mt-2 w-40 bg-paper border-2 border-ink shadow-card z-50">
                  <button
                    onClick={() => { setMenuOpen(false); navigate('/profile') }}
                    className="w-full px-4 py-3 font-mono text-[11px] font-bold tracking-eyebrow text-left hover:bg-yellow transition-colors"
                  >
                    MEU PERFIL
                  </button>
                  <div className="border-t border-hairline" />
                  <button
                    onClick={handleSignOut}
                    className="w-full px-4 py-3 font-mono text-[11px] font-bold tracking-eyebrow text-left hover:bg-red/10 text-red transition-colors"
                  >
                    SAIR
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
