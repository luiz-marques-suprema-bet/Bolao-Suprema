import { useEffect } from 'react'
import { createHashRouter, RouterProvider, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useAuthStore } from '@/stores/auth.store'
import { useChatStore } from '@/stores/chat.store'
import { useMatchStore } from '@/stores/match.store'
import { useIsDesktop } from '@/hooks/useBreakpoint'
import { MobileNav } from '@/components/navigation/MobileNav'
import { DesktopNav } from '@/components/navigation/DesktopNav'
import { Marquee } from '@/components/shared/Marquee'
import { OnboardingScreen } from '@/screens/Onboarding'
import { LoginScreen } from '@/screens/Login'
import { RegisterScreen } from '@/screens/Register'
import { ProfileScreen } from '@/screens/Profile'
import { HomeScreen } from '@/screens/Home'
import { PredictionScreen } from '@/screens/Prediction'
import { RankingScreen } from '@/screens/Ranking'
import { ResenhaScreen } from '@/screens/Resenha'
import { AdminScreen } from '@/screens/Admin'
import { BoletimScreen } from '@/screens/Boletim'
import { UserProfileScreen } from '@/screens/UserProfile'
import { RegulamentoScreen } from '@/screens/Regulamento'
import { MyPredictionsScreen } from '@/screens/MyPredictions'
import { NotificationsScreen } from '@/screens/Notifications'

// ─── Root redirect — onboarding for first visit ───────────────────────────────

function RootRedirect() {
  const { isAuthenticated, isLoading } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    if (isLoading) return
    if (isAuthenticated) {
      navigate('/home', { replace: true })
    } else {
      const visited = localStorage.getItem('bolao-visited')
      navigate(visited ? '/login' : '/onboarding', { replace: true })
    }
  }, [isAuthenticated, isLoading, navigate])

  return null
}

// ─── Auth Guard ───────────────────────────────────────────────────────────────

function RequireAuth() {
  const { isAuthenticated, isLoading, profileComplete, user } = useAuthStore()
  const { pathname } = useLocation()

  if (isLoading) {
    return (
      <div className="flex h-dvh items-center justify-center bg-paper">
        <span className="font-mono text-[11px] tracking-eyebrow text-ink-3 animate-pulse">
          CARREGANDO…
        </span>
      </div>
    )
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (!profileComplete && pathname !== '/profile') return <Navigate to="/profile" replace />
  if (user?.participantStatus === 'pending' && !['/profile', '/regulamento'].includes(pathname)) return <ParticipantStatusScreen status="pending" />
  if ((user?.participantStatus === 'blocked' || user?.participantStatus === 'removed') && pathname !== '/profile') return <ParticipantStatusScreen status={user.participantStatus} />

  return <Outlet />
}

function ParticipantStatusScreen({ status }: { status: 'pending' | 'blocked' | 'removed' }) {
  const copy = {
    pending: ['Cadastro em aprovacao', 'Seu acesso ao bolao ja foi criado, mas um admin precisa aprovar sua participacao.'],
    blocked: ['Participante bloqueado', 'Seu acesso a palpites e Resenha esta bloqueado. Procure T.I. ou o admin do bolao.'],
    removed: ['Participante removido', 'Seu usuario foi removido do bolao. Procure T.I. se isso parecer errado.'],
  }[status]
  return (
    <div className="min-h-dvh bg-paper flex items-center justify-center p-6">
      <div className="border-2 border-ink p-6 max-w-md">
        <div className="font-mono text-[10px] tracking-eyebrow text-ink-3">STATUS DO PARTICIPANTE</div>
        <h1 className="font-display text-4xl mt-2">{copy[0]}</h1>
        <p className="font-mono text-[12px] text-ink-3 mt-3 leading-relaxed">{copy[1]}</p>
      </div>
    </div>
  )
}

// ─── Marquee content ─────────────────────────────────────────────────────────

const MARQUEE_ITEMS = [
  'FAÇA JÁ SEU PALPITE →',
  'COPA DO MUNDO 2026',
  'USA · CAN · MEX',
  '48 SELEÇÕES · 102 PARTIDAS',
  'FASE DE GRUPOS · 11 JUN',
  'OITAVAS · 27 JUN',
  'QUARTAS · 4 JUL',
  'SEMIFINAIS · 14 JUL',
  'FINAL · 19 JUL',
]

// ─── App Layout (with nav) ────────────────────────────────────────────────────

function AppLayout() {
  const isDesktop = useIsDesktop()
  const user = useAuthStore(s => s.user)
  const initChat = useChatStore(s => s.init)
  const destroyChat = useChatStore(s => s.destroy)
  const initMatches = useMatchStore(s => s.init)
  const destroyMatches = useMatchStore(s => s.destroy)

  useEffect(() => {
    if (user?.id) {
      initChat(user.id)
      initMatches()
      return () => {
        destroyChat()
        destroyMatches()
      }
    }
  }, [user?.id, initChat, destroyChat, initMatches, destroyMatches])

  return (
    <div className="min-h-dvh flex flex-col">
      {isDesktop && <DesktopNav />}
      <main
        className="flex-1"
        style={isDesktop ? { paddingBottom: '2.5rem' } : undefined}
      >
        <AnimatedOutlet />
      </main>

      {/* Fixed ticker — always visible above mobile nav or at viewport bottom on desktop */}
      <div
        className="fixed left-0 right-0 z-40 border-t border-line bg-ink"
        style={
          isDesktop
            ? { bottom: 0 }
            : { bottom: 'calc(3.5rem + env(safe-area-inset-bottom, 0px))' }
        }
      >
        <Marquee items={MARQUEE_ITEMS} color="#FFCB05" bg="#0D0D0D" speed={35} />
      </div>

      {!isDesktop && <MobileNav />}
    </div>
  )
}

function AnimatedOutlet() {
  const { pathname } = useLocation()
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
      >
        <Outlet />
      </motion.div>
    </AnimatePresence>
  )
}

// ─── Router ───────────────────────────────────────────────────────────────────

const router = createHashRouter([
  { path: '/', element: <RootRedirect /> },
  { path: '/onboarding', element: <OnboardingScreen /> },
  { path: '/login', element: <LoginScreen /> },
  { path: '/register', element: <RegisterScreen /> }, // redirects to /login

  // Protected routes
  {
    element: <RequireAuth />,
    children: [
      { path: '/profile', element: <ProfileScreen /> },
      {
        element: <AppLayout />,
        children: [
          { path: '/home', element: <HomeScreen /> },
          { path: '/regulamento', element: <RegulamentoScreen /> },
          { path: '/notificacoes', element: <NotificationsScreen /> },
          { path: '/meus-palpites', element: <MyPredictionsScreen /> },
          { path: '/boletim', element: <BoletimScreen /> },
          { path: '/bracket', element: <Navigate to="/prediction" state={{ tab: 'knockout' }} replace /> },
          { path: '/prediction', element: <PredictionScreen /> },
          { path: '/prediction/:matchId', element: <PredictionScreen /> },
          { path: '/ranking', element: <RankingScreen /> },
          { path: '/resenha', element: <ResenhaScreen /> },
          { path: '/u/:userId', element: <UserProfileScreen /> },
          { path: '/admin', element: <AdminScreen /> },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/home" replace /> },
])

// ─── Root ─────────────────────────────────────────────────────────────────────

export function App() {
  const loadSession = useAuthStore((s) => s.loadSession)

  useEffect(() => {
    loadSession()
  }, [loadSession])

  return <RouterProvider router={router} />
}
