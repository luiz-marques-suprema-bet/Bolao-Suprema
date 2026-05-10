import { useEffect } from 'react'
import { createHashRouter, RouterProvider, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useAuthStore } from '@/stores/auth.store'
import { useIsDesktop } from '@/hooks/useBreakpoint'
import { MobileNav } from '@/components/navigation/MobileNav'
import { DesktopNav } from '@/components/navigation/DesktopNav'
import { Marquee } from '@/components/shared/Marquee'
import { OnboardingScreen } from '@/screens/Onboarding'
import { LoginScreen } from '@/screens/Login'
import { ProfileScreen } from '@/screens/Profile'
import { HomeScreen } from '@/screens/Home'
import { PredictionScreen } from '@/screens/Prediction'
import { BracketScreen } from '@/screens/Bracket'
import { RankingScreen } from '@/screens/Ranking'
import { ResenhaScreen } from '@/screens/Resenha'
import { AdminScreen } from '@/screens/Admin'
import { BoletimScreen } from '@/screens/Boletim'

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
  const { isAuthenticated, isLoading, profileComplete } = useAuthStore()
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

  return <Outlet />
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

  // Protected routes
  {
    element: <RequireAuth />,
    children: [
      { path: '/profile', element: <ProfileScreen /> },
      {
        element: <AppLayout />,
        children: [
          { path: '/home', element: <HomeScreen /> },
          { path: '/boletim', element: <BoletimScreen /> },
          { path: '/bracket', element: <BracketScreen /> },
          { path: '/prediction', element: <PredictionScreen /> },
          { path: '/prediction/:matchId', element: <PredictionScreen /> },
          { path: '/ranking', element: <RankingScreen /> },
          { path: '/resenha', element: <ResenhaScreen /> },
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
