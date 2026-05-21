import type { ChatMessage } from '@/types'

export function formatDuration(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

export function formatDayLabel(iso: string): string {
  const date = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (date.toDateString() === today.toDateString()) return 'HOJE'
  if (date.toDateString() === yesterday.toDateString()) return 'ONTEM'
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).toUpperCase()
}

export function getContentPreview(msg: Pick<ChatMessage, 'type' | 'text'>): string {
  if (msg.type === 'gif') return 'GIF'
  if (msg.type === 'image') return 'Foto'
  if (msg.type === 'audio') return 'Audio'
  if (msg.type === 'video') return 'Video'
  if (msg.type === 'video_note') return 'Video circular'
  if (msg.type === 'poll') return 'Enquete'
  return msg.text ?? ''
}

export function minutesBetween(a: string, b: string): number {
  return Math.abs(new Date(b).getTime() - new Date(a).getTime()) / 60000
}
