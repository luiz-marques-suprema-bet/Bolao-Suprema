import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Prepend Vite base URL to asset paths */
export function asset(path: string): string {
  return `${import.meta.env.BASE_URL}${path}`
}

/** Format number with thousands separator */
export function fmtPts(n: number): string {
  return n.toLocaleString('pt-BR')
}

/** Get initials from full name */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

/** Palette used for user avatar colors (picker + deterministic assignment) */
export const AVATAR_COLORS = [
  '#00A651', '#007A3E', '#E63946', '#1D3557',
  '#FFCB05', '#6FB4FF', '#C9A856', '#FF6600',
]

/** Deterministic color from string (for avatars) */
export function colorFromString(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

/** Clamp a number between min and max */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/** Format date from ISO string */
export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  }).toUpperCase()
}
