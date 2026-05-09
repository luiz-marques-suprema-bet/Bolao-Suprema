import { useEffect } from 'react'
import { createHashRouter, RouterProvider, Navigate, Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useAuthStore } from '@/stores/auth.store'
import { useIsDesktop } from '@/hooks/useBreakpoint'
import { MobileNav } from '@/components/navigation/MobileNav'
import { DesktopNav } from '@/components/navigation/DesktopNav'
import { OnboardingScreen } from '@/screens/Onboarding'
import { LoginScreen } from '@/screens/Login'
import { ProfileScreen } from '@/screens/Profile'
import { HomeScreen } from '@/screens/Home'
import { BracketScreen } from '@/screens/Bracket'
import { PredictionScreen } from '@/screens/Prediction'
import { RankingScreen } from '@/screens/Ranking'
import { ResenhaScreen } from '@/screens/Resenha'
import { AdminScreen } from '@/screens/Admin'
import { BoletimScreen } from '@/screens/Boletim'

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

// ─── App Layout (with nav) ────────────────────────────────────────────────────

function AppLayout() {
  const isDesktop = useIsDesktop()

  return (
    <div className="min-h-dvh flex flex-col">
      {isDesktop && <DesktopNav />}
      <main className={`flex-1 ${!isDesktop ? 'pb-20' : ''}`}>
        <AnimatedOutlet />
      </main>
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
  { path: '/', element: <Navigate to="/home" replace /> },
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
