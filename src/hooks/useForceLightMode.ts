import { useLayoutEffect } from 'react'
import { useTheme } from '@/context/ThemeContext'

export function useForceLightMode() {
  const { forceLightMode } = useTheme()

  useLayoutEffect(() => forceLightMode(), [forceLightMode])
}
