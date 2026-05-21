import { useTheme } from '@/context/ThemeContext'
import { cn } from '@/lib/utils'

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Ativar tema claro' : 'Ativar tema escuro'}
      title={isDark ? 'Tema claro' : 'Tema escuro'}
      className={cn(
        'inline-flex items-center justify-center border border-hairline bg-surface-2 text-ink shadow-sm transition-all hover:border-line-strong hover:bg-surface-hover active:scale-95',
        compact ? 'h-9 w-9 rounded-full text-[15px]' : 'h-8 w-8 rounded-full text-[14px]',
      )}
    >
      <span aria-hidden="true">{isDark ? '☾' : '☀'}</span>
    </button>
  )
}
