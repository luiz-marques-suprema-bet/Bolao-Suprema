import { useEffect } from 'react'

export function useForceLightMode() {
  useEffect(() => {
    const root = document.documentElement
    const wasDark = root.classList.contains('dark')
    root.classList.remove('dark')
    root.style.colorScheme = 'light'
    return () => {
      if (wasDark) {
        root.classList.add('dark')
        root.style.colorScheme = 'dark'
      }
    }
  }, [])
}
