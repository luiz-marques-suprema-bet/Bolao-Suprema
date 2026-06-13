import { useEffect, lazy, Suspense } from 'react'
import { createHashRouter, RouterProvider, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ThemeProvider } from '@/context/ThemeContext'
import { useAuthStore } from '@/stores/auth.store'
import { useChatStore } from '@/stores/chat.store'
import { useMatchStore } from '@/stores/match.store'
import { canParticipate } from '@/lib/participantStatus'
import { useIsDesktop } from '@/hooks/useBreakpoint'
import { useTabResync } from '@/hooks/useTabResync'
import { MobileNav } from '@/components/navigation/MobileNav'
import { DesktopNav } from '@/components/navigation/DesktopNav'
import { Marquee } from '@/components/shared/Marquee'
// Entry screens — eager (carregam de cara).
import { OnboardingScreen } from '@/screens/Onboarding'
import { LoginScreen } from '@/screens/Login'
import { RegisterScreen } from '@/screens/Register'

// Demais telas — code-splitting por rota (cada uma vira um chunk próprio,
// carregado só quando acessada → bundle inicial bem menor no 1º load).
const ProfileScreen        = lazy(() => import('@/screens/Profile').then(m => ({ default: m.ProfileScreen })))
const SetupScreen          = lazy(() => import('@/screens/Setup').then(m => ({ default: m.SetupScreen })))
const HomeScreen           = lazy(() => import('@/screens/Home').then(m => ({ default: m.HomeScreen })))
const PredictionScreen     = lazy(() => import('@/screens/Prediction').then(m => ({ default: m.PredictionScreen })))
const RankingScreen        = lazy(() => import('@/screens/Ranking').then(m => ({ default: m.RankingScreen })))
const EspiadinhaScreen     = lazy(() => import('@/screens/Espiadinha').then(m => ({ default: m.EspiadinhaScreen })))
const ResenhaScreen        = lazy(() => import('@/screens/Resenha').then(m => ({ default: m.ResenhaScreen })))
const AdminScreen          = lazy(() => import('@/screens/Admin').then(m => ({ default: m.AdminScreen })))
const UserProfileScreen    = lazy(() => import('@/screens/UserProfile').then(m => ({ default: m.UserProfileScreen })))
const RegulamentoScreen    = lazy(() => import('@/screens/Regulamento').then(m => ({ default: m.RegulamentoScreen })))
const MyPredictionsScreen  = lazy(() => import('@/screens/MyPredictions').then(m => ({ default: m.MyPredictionsScreen })))
const NotificationsScreen  = lazy(() => import('@/screens/Notifications').then(m => ({ default: m.NotificationsScreen })))

function ScreenLoading() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-paper">
      <span className="font-mono text-[11px] tracking-eyebrow text-ink-3 animate-pulse">CARREGANDO…</span>
    </div>
  )
}

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
  if (!profileComplete && pathname !== '/setup') return <Navigate to="/setup" replace />
  if (!canParticipate(user?.participantStatus) && pathname !== '/setup' && pathname !== '/profile') {
    return <ParticipantStatusScreen status={user?.participantStatus} />
  }

  return <Outlet />
}

function ParticipantStatusScreen({ status }: { status?: string }) {
  const isRemoved = status === 'removed'

  return (
    <div className="min-h-dvh bg-paper flex items-center justify-center p-6">
      <div className="border-2 border-ink p-6 max-w-md">
        <div className="font-mono text-[10px] tracking-eyebrow text-ink-3">
          {isRemoved ? 'ACESSO REMOVIDO' : 'ACESSO BLOQUEADO'}
        </div>
        <h1 className="font-display text-4xl mt-2">
          {isRemoved ? 'Participante removido' : 'Participante bloqueado'}
        </h1>
        <p className="font-mono text-[12px] text-ink-3 mt-3 leading-relaxed">
          Seu acesso a palpites e Resenha esta bloqueado. Procure T.I. ou o admin do bolao.
        </p>
      </div>
    </div>
  )
}

// ─── Marquee content ─────────────────────────────────────────────────────────

const MARQUEE_ITEMS = [
  'FAÇA JÁ SEU PALPITE →',
  'COPA DO MUNDO 2026',
  'USA · CAN · MEX',
  '48 SELEÇÕES · 104 PARTIDAS',
  'FASE DE GRUPOS · 11 JUN',
  'FASE DE 32 · 28 JUN',
  'OITAVAS · 4 JUL',
  'QUARTAS · 9 JUL',
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
  const resyncChat = useChatStore(s => s.resync)
  const resyncMatches = useMatchStore(s => s.resync)

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

  // Aba voltou ao foco → reconecta o realtime e recarrega chat + jogos, pegando
  // o que foi perdido enquanto estava em 2o plano (sem precisar de F5).
  useTabResync(() => { void resyncChat(); void resyncMatches() })

  return (
    <div className="min-h-dvh flex flex-col">
      {isDesktop && <DesktopNav />}
      <main
        className="flex-1"
        style={isDesktop ? { paddingBottom: '2.5rem' } : undefined}
      >
        <AnimatedOutlet />
      </main>

      {isDesktop && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-line bg-ink">
          <Marquee items={MARQUEE_ITEMS} color="#FFCB05" bg="#0D0D0D" speed={35} />
        </div>
      )}

      {!isDesktop && <MobileNav />}
    </div>
  )
}

function AnimatedOutlet() {
  const { pathname } = useLocation()
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.12 }}
      >
        <Suspense fallback={<ScreenLoading />}>
          <Outlet />
        </Suspense>
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
      { path: '/setup', element: <Suspense fallback={<ScreenLoading />}><SetupScreen /></Suspense> },
      { path: '/profile', element: <Suspense fallback={<ScreenLoading />}><ProfileScreen /></Suspense> },
      {
        element: <AppLayout />,
        children: [
          { path: '/home', element: <HomeScreen /> },
          { path: '/regulamento', element: <RegulamentoScreen /> },
          { path: '/notificacoes', element: <NotificationsScreen /> },
          { path: '/meus-palpites', element: <MyPredictionsScreen /> },
          { path: '/boletim', element: <Navigate to="/home" replace /> },
          { path: '/bracket', element: <Navigate to="/prediction" state={{ tab: 'knockout' }} replace /> },
          { path: '/prediction', element: <PredictionScreen /> },
          { path: '/prediction/:matchId', element: <PredictionScreen /> },
          { path: '/ranking', element: <RankingScreen /> },
          { path: '/espiadinha', element: <EspiadinhaScreen /> },
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

  useEffect(() => {
    const preventImageDefault = (event: Event) => {
      if (event.target instanceof HTMLImageElement) event.preventDefault()
    }

    document.addEventListener('dragstart', preventImageDefault)
    document.addEventListener('contextmenu', preventImageDefault)
    return () => {
      document.removeEventListener('dragstart', preventImageDefault)
      document.removeEventListener('contextmenu', preventImageDefault)
    }
  }, [])

  return (
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>
  )
}
