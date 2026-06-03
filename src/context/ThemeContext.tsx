import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useState, type ReactNode } from 'react'

type Theme = 'light' | 'dark'

interface ThemeContextValue {
  theme: Theme
  effectiveTheme: Theme
  toggleTheme: () => void
  setTheme: (theme: Theme) => void
  forceLightMode: () => () => void
}

const STORAGE_KEY = 'bolao-theme'
const ThemeContext = createContext<ThemeContextValue | null>(null)

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'light'
  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(theme: Theme) {
  const root = document.documentElement
  root.classList.toggle('dark', theme === 'dark')
  root.style.colorScheme = theme
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme)
  const [forcedLightCount, setForcedLightCount] = useState(0)
  const effectiveTheme: Theme = forcedLightCount > 0 ? 'light' : theme

  useLayoutEffect(() => {
    applyTheme(effectiveTheme)
  }, [effectiveTheme])

  const setTheme = useCallback((nextTheme: Theme) => {
    window.localStorage.setItem(STORAGE_KEY, nextTheme)
    setThemeState(nextTheme)
  }, [])

  const toggleTheme = useCallback(() => {
    setThemeState(current => {
      const nextTheme = current === 'dark' ? 'light' : 'dark'
      window.localStorage.setItem(STORAGE_KEY, nextTheme)
      return nextTheme
    })
  }, [])

  const forceLightMode = useCallback(() => {
    setForcedLightCount(count => count + 1)
    return () => {
      setForcedLightCount(count => Math.max(0, count - 1))
    }
  }, [])

  const value = useMemo(
    () => ({ theme, effectiveTheme, toggleTheme, setTheme, forceLightMode }),
    [theme, effectiveTheme, toggleTheme, setTheme, forceLightMode],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used within ThemeProvider')
  return context
}
