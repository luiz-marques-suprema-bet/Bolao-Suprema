import type { ChatMessage } from '@/types'

export function formatDuration(s: number): string {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function formatDayLabel(iso: string): string {
  const d     = new Date(iso)
  const today = new Date()
  const yest  = new Date(today)
  yest.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'HOJE'
  if (d.toDateString() === yest.toDateString())  return 'ONTEM'
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).toUpperCase()
}

export function getReplyPreview(msg: Pick<ChatMessage, 'type' | 'text'>): string {
  if (msg.type === 'gif')   return '🖼 GIF'
  if (msg.type === 'image') return '📷 Foto'
  if (msg.type === 'audio') return '🎤 Áudio'
  return msg.text ?? ''
}
