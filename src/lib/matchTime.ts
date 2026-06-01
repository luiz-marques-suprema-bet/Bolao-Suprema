import type { Match } from '@/types'

export const BRAZIL_TIME_ZONE = 'America/Sao_Paulo'
export const BRAZIL_TIME_LABEL = 'Horário de Brasília'

type MatchTimeInput = Pick<Match, 'kickoffUtc'> | string | Date

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  timeZone: BRAZIL_TIME_ZONE,
  day: '2-digit',
  month: 'short',
})

const timeFormatter = new Intl.DateTimeFormat('pt-BR', {
  timeZone: BRAZIL_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

function toDate(input: MatchTimeInput): Date {
  if (input instanceof Date) return input
  if (typeof input === 'string') return new Date(input)
  return new Date(input.kickoffUtc)
}

function titleMonth(value: string): string {
  return value
    .replace('.', '')
    .replace(/\s+de\s+/gi, ' ')
    .split(' ')
    .map((part) => part ? part[0].toUpperCase() + part.slice(1).toLowerCase() : part)
    .join(' ')
}

export function getMatchKickoffInBrazilTime(input: MatchTimeInput): Date {
  return toDate(input)
}

export function formatMatchDate(input: MatchTimeInput): string {
  const parts = dateFormatter.formatToParts(toDate(input))
  const day = parts.find(part => part.type === 'day')?.value ?? ''
  const month = parts.find(part => part.type === 'month')?.value ?? ''
  return titleMonth(`${day} ${month}`.trim())
}

export function formatMatchTime(input: MatchTimeInput): string {
  return timeFormatter.format(toDate(input))
}

export function formatMatchDateTime(input: MatchTimeInput): string {
  return `${formatMatchDate(input)} · ${formatMatchTime(input)} · ${BRAZIL_TIME_LABEL}`
}

export function getBettingDeadline(input: MatchTimeInput): Date {
  return getMatchKickoffInBrazilTime(input)
}

/**
 * Deadline robusto para apostas que fecham no início do torneio (ex.: campeão/
 * vice/artilheiro): o MENOR kickoff do conjunto, não o índice [0] do array.
 * Espelha o `min(kickoff_utc)` usado pelos mercados no banco e independe da
 * ordem da lista. Lança se a lista vier vazia.
 */
export function getEarliestKickoff(matches: MatchTimeInput[]): Date {
  if (matches.length === 0) throw new Error('getEarliestKickoff: lista vazia')
  return matches.reduce<Date>((min, m) => {
    const d = toDate(m)
    return d < min ? d : min
  }, toDate(matches[0]))
}
