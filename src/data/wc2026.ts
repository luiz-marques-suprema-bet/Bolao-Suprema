import { TEAMS } from './teams'
import type { Match, MatchStage, MatchStatus } from '@/types'
import { formatMatchDateTime } from '@/lib/matchTime'
import { isBetOpen } from '@/lib/markets'

// ─── Types ────────────────────────────────────────────────────────────────────

export type WCGroup = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'K' | 'L'
export type Matchday = 1 | 2 | 3

export interface WCGroupDef {
  id: WCGroup
  teams: string[]
}

interface RawMatch {
  id: string
  date: string
  time: string
  group: WCGroup
  md: Matchday
  home: string
  away: string
  venue: string
  city: string
  status: MatchStatus
  homeScore?: number
  awayScore?: number
  liveMinute?: string
  winner?: string
}

interface RawKnockoutMatch {
  id: string
  stage: Exclude<MatchStage, 'group'>
  stageLabel: string
  date: string
  time: string
  homePlaceholder: string
  awayPlaceholder: string
  venue: string
  city: string
}

// ─── Groups ───────────────────────────────────────────────────────────────────

export const WC2026_GROUPS: WCGroupDef[] = [
  { id: 'A', teams: ['MEX', 'RSA', 'KOR', 'CZE'] },
  { id: 'B', teams: ['CAN', 'SUI', 'QAT', 'BIH'] },
  { id: 'C', teams: ['BRA', 'MAR', 'HTI', 'SCO'] },
  { id: 'D', teams: ['USA', 'PAR', 'AUS', 'TUR'] },
  { id: 'E', teams: ['GER', 'CUW', 'CIV', 'ECU'] },
  { id: 'F', teams: ['NED', 'JPN', 'SWE', 'TUN'] },
  { id: 'G', teams: ['BEL', 'EGY', 'IRN', 'NZL'] },
  { id: 'H', teams: ['ESP', 'CPV', 'KSA', 'URU'] },
  { id: 'I', teams: ['FRA', 'SEN', 'NOR', 'IRQ'] },
  { id: 'J', teams: ['ARG', 'ALG', 'AUT', 'JOR'] },
  { id: 'K', teams: ['POR', 'COD', 'UZB', 'COL'] },
  { id: 'L', teams: ['ENG', 'CRO', 'GHA', 'PAN'] },
]

// Portuguese weekday abbreviations lookup
const PT_DAYS: Record<string, string> = {
  '0': 'DOM', '1': 'SEG', '2': 'TER', '3': 'QUA',
  '4': 'QUI', '5': 'SEX', '6': 'SAB',
}
const PT_MONTHS: Record<string, string> = {
  '5': 'JUN', '6': 'JUL',
}

function fmtMatchDate(iso: string): string {
  const [, m, d] = iso.split('-')
  const day = new Date(iso + 'T12:00:00').getDay()
  return `${PT_DAYS[String(day)]} ${d} ${PT_MONTHS[String(Number(m) - 1)]}`
}

// IMPORTANT TIMEZONE RULE
// The raw schedule below is stored in Eastern Time (ET), following the common
// published TV schedule format for the 2026 World Cup. During the tournament,
// ET is EDT (UTC-4) and Brasília is BRT (UTC-3), so the user-facing time is
// always ET + 1 hour. This keeps FIFA/TV schedule, countdowns and betting
// deadlines using one source of truth. Example: 11 Jun 15:00 ET = 16:00 BRT.
const RAW_SCHEDULE_UTC_OFFSET = -4
const DISPLAY_BRT_UTC_OFFSET = -3

function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000)
}

function rawEtToUtc(date: string, time: string): Date {
  const [h, m] = time.split(':').map(Number)
  const base = new Date(`${date}T00:00:00Z`)
  base.setUTCHours(h - RAW_SCHEDULE_UTC_OFFSET, m, 0, 0)
  return base
}

function toBRT(date: string, time: string): string {
  const utc = rawEtToUtc(date, time)
  const brt = addHours(utc, DISPLAY_BRT_UTC_OFFSET)
  return brt.toISOString().slice(11, 16)
}

// Returns ISO 8601 UTC timestamp for kick-off (for deadline/auto-close logic).
function toKickoffUtc(date: string, time: string): string {
  return rawEtToUtc(date, time).toISOString()
}

// ─── Raw match schedule — all 72 group stage matches ─────────────────────────

const RAW: RawMatch[] = [
  // ── MATCHDAY 1 ────────────────────────────────────────────────────────────────
  // June 11 — Group A
  { id: 'g-a-1', date: '2026-06-11', time: '15:00', group: 'A', md: 1, home: 'MEX', away: 'RSA', venue: 'Estadio Azteca',           city: 'Cidade do México', status: 'scheduled' },
  { id: 'g-a-2', date: '2026-06-11', time: '22:00', group: 'A', md: 1, home: 'KOR', away: 'CZE', venue: 'Estadio Akron',             city: 'Guadalajara',      status: 'scheduled' },

  // June 12 — Groups B, D
  { id: 'g-b-1', date: '2026-06-12', time: '15:00', group: 'B', md: 1, home: 'CAN', away: 'BIH', venue: 'BMO Field',                  city: 'Toronto',          status: 'scheduled' },
  { id: 'g-d-1', date: '2026-06-12', time: '21:00', group: 'D', md: 1, home: 'USA', away: 'PAR', venue: 'SoFi Stadium',              city: 'Los Angeles',      status: 'scheduled' },

  // June 13 — Groups B, C
  { id: 'g-b-2', date: '2026-06-13', time: '15:00', group: 'B', md: 1, home: 'QAT', away: 'SUI', venue: "Levi's Stadium",            city: 'San Francisco',    status: 'scheduled' },
  { id: 'g-c-1', date: '2026-06-13', time: '18:00', group: 'C', md: 1, home: 'BRA', away: 'MAR', venue: 'MetLife Stadium',            city: 'Nova York',        status: 'scheduled' },
  { id: 'g-c-2', date: '2026-06-13', time: '21:00', group: 'C', md: 1, home: 'HTI', away: 'SCO', venue: 'Gillette Stadium',           city: 'Boston',           status: 'scheduled' },

  // June 14 — Groups D, E, F
  { id: 'g-d-2', date: '2026-06-14', time: '12:00', group: 'D', md: 1, home: 'AUS', away: 'TUR', venue: 'BC Place',                   city: 'Vancouver',        status: 'scheduled' },
  { id: 'g-e-1', date: '2026-06-14', time: '13:00', group: 'E', md: 1, home: 'GER', away: 'CUW', venue: 'NRG Stadium',                city: 'Houston',          status: 'scheduled' },
  { id: 'g-f-1', date: '2026-06-14', time: '16:00', group: 'F', md: 1, home: 'NED', away: 'JPN', venue: 'AT&T Stadium',               city: 'Dallas',           status: 'scheduled' },
  { id: 'g-e-2', date: '2026-06-14', time: '19:00', group: 'E', md: 1, home: 'CIV', away: 'ECU', venue: 'Lincoln Financial Field',    city: 'Filadélfia',       status: 'scheduled' },
  { id: 'g-f-2', date: '2026-06-14', time: '22:00', group: 'F', md: 1, home: 'SWE', away: 'TUN', venue: 'Estadio BBVA',               city: 'Monterrey',        status: 'scheduled' },

  // June 15 — Groups G, H
  { id: 'g-h-1', date: '2026-06-15', time: '12:00', group: 'H', md: 1, home: 'ESP', away: 'CPV', venue: 'Mercedes-Benz Stadium',      city: 'Atlanta',          status: 'scheduled' },
  { id: 'g-g-1', date: '2026-06-15', time: '15:00', group: 'G', md: 1, home: 'BEL', away: 'EGY', venue: 'Lumen Field',                city: 'Seattle',          status: 'scheduled' },
  { id: 'g-h-2', date: '2026-06-15', time: '18:00', group: 'H', md: 1, home: 'KSA', away: 'URU', venue: 'Hard Rock Stadium',          city: 'Miami',            status: 'scheduled' },
  { id: 'g-g-2', date: '2026-06-15', time: '21:00', group: 'G', md: 1, home: 'IRN', away: 'NZL', venue: 'SoFi Stadium',              city: 'Los Angeles',      status: 'scheduled' },

  // June 16 — Groups I, J
  { id: 'g-i-1', date: '2026-06-16', time: '15:00', group: 'I', md: 1, home: 'FRA', away: 'SEN', venue: 'MetLife Stadium',            city: 'Nova York',        status: 'scheduled' },
  { id: 'g-i-2', date: '2026-06-16', time: '18:00', group: 'I', md: 1, home: 'IRQ', away: 'NOR', venue: 'Gillette Stadium',           city: 'Boston',           status: 'scheduled' },
  { id: 'g-j-1', date: '2026-06-16', time: '21:00', group: 'J', md: 1, home: 'ARG', away: 'ALG', venue: 'Arrowhead Stadium',          city: 'Kansas City',      status: 'scheduled' },

  // June 17 — Groups J, K, L
  { id: 'g-j-2', date: '2026-06-17', time: '10:00', group: 'J', md: 1, home: 'AUT', away: 'JOR', venue: "Levi's Stadium",            city: 'San Francisco',    status: 'scheduled' },
  { id: 'g-k-1', date: '2026-06-17', time: '13:00', group: 'K', md: 1, home: 'POR', away: 'COD', venue: 'NRG Stadium',                city: 'Houston',          status: 'scheduled' },
  { id: 'g-l-1', date: '2026-06-17', time: '16:00', group: 'L', md: 1, home: 'ENG', away: 'CRO', venue: 'AT&T Stadium',               city: 'Dallas',           status: 'scheduled' },
  { id: 'g-l-2', date: '2026-06-17', time: '19:00', group: 'L', md: 1, home: 'GHA', away: 'PAN', venue: 'BMO Field',                  city: 'Toronto',          status: 'scheduled' },
  { id: 'g-k-2', date: '2026-06-17', time: '22:00', group: 'K', md: 1, home: 'UZB', away: 'COL', venue: 'Estadio Azteca',             city: 'Cidade do México', status: 'scheduled' },

  // ── MATCHDAY 2 ────────────────────────────────────────────────────────────────
  // June 18 — Group A, B
  { id: 'g-a-3', date: '2026-06-18', time: '12:00', group: 'A', md: 2, home: 'CZE', away: 'RSA', venue: 'Mercedes-Benz Stadium',      city: 'Atlanta',          status: 'scheduled' },
  { id: 'g-b-3', date: '2026-06-18', time: '15:00', group: 'B', md: 2, home: 'SUI', away: 'BIH', venue: 'SoFi Stadium',              city: 'Los Angeles',      status: 'scheduled' },
  { id: 'g-b-4', date: '2026-06-18', time: '18:00', group: 'B', md: 2, home: 'CAN', away: 'QAT', venue: 'BC Place',                   city: 'Vancouver',        status: 'scheduled' },
  { id: 'g-a-4', date: '2026-06-18', time: '21:00', group: 'A', md: 2, home: 'MEX', away: 'KOR', venue: 'Estadio Akron',             city: 'Guadalajara',      status: 'scheduled' },

  // June 19 — Groups C, D
  { id: 'g-d-3', date: '2026-06-19', time: '15:00', group: 'D', md: 2, home: 'USA', away: 'AUS', venue: 'Lumen Field',                city: 'Seattle',          status: 'scheduled' },
  { id: 'g-c-3', date: '2026-06-19', time: '18:00', group: 'C', md: 2, home: 'SCO', away: 'MAR', venue: 'Gillette Stadium',           city: 'Boston',           status: 'scheduled' },
  { id: 'g-c-4', date: '2026-06-19', time: '20:30', group: 'C', md: 2, home: 'BRA', away: 'HTI', venue: 'Lincoln Financial Field',    city: 'Filadélfia',       status: 'scheduled' },
  { id: 'g-d-4', date: '2026-06-19', time: '23:00', group: 'D', md: 2, home: 'TUR', away: 'PAR', venue: "Levi's Stadium",            city: 'San Francisco',    status: 'scheduled' },

  // June 20 — Groups E, F
  { id: 'g-f-3', date: '2026-06-20', time: '13:00', group: 'F', md: 2, home: 'NED', away: 'SWE', venue: 'NRG Stadium',                city: 'Houston',          status: 'scheduled' },
  { id: 'g-e-3', date: '2026-06-20', time: '16:00', group: 'E', md: 2, home: 'GER', away: 'CIV', venue: 'BMO Field',                  city: 'Toronto',          status: 'scheduled' },
  { id: 'g-e-4', date: '2026-06-20', time: '20:00', group: 'E', md: 2, home: 'ECU', away: 'CUW', venue: 'Arrowhead Stadium',          city: 'Kansas City',      status: 'scheduled' },
  { id: 'g-f-4', date: '2026-06-20', time: '23:00', group: 'F', md: 2, home: 'TUN', away: 'JPN', venue: 'Estadio BBVA',               city: 'Monterrey',        status: 'scheduled' },

  // June 21 — Groups G, H
  { id: 'g-h-3', date: '2026-06-21', time: '12:00', group: 'H', md: 2, home: 'ESP', away: 'KSA', venue: 'Mercedes-Benz Stadium',      city: 'Atlanta',          status: 'scheduled' },
  { id: 'g-g-3', date: '2026-06-21', time: '15:00', group: 'G', md: 2, home: 'BEL', away: 'IRN', venue: 'SoFi Stadium',              city: 'Los Angeles',      status: 'scheduled' },
  { id: 'g-h-4', date: '2026-06-21', time: '18:00', group: 'H', md: 2, home: 'URU', away: 'CPV', venue: 'Hard Rock Stadium',          city: 'Miami',            status: 'scheduled' },
  { id: 'g-g-4', date: '2026-06-21', time: '21:00', group: 'G', md: 2, home: 'NZL', away: 'EGY', venue: 'BC Place',                   city: 'Vancouver',        status: 'scheduled' },

  // June 22 — Groups I, J
  { id: 'g-j-3', date: '2026-06-22', time: '13:00', group: 'J', md: 2, home: 'ARG', away: 'AUT', venue: 'AT&T Stadium',               city: 'Dallas',           status: 'scheduled' },
  { id: 'g-i-3', date: '2026-06-22', time: '17:00', group: 'I', md: 2, home: 'FRA', away: 'IRQ', venue: 'Lincoln Financial Field',    city: 'Filadélfia',       status: 'scheduled' },
  { id: 'g-i-4', date: '2026-06-22', time: '20:00', group: 'I', md: 2, home: 'NOR', away: 'SEN', venue: 'MetLife Stadium',            city: 'Nova York',        status: 'scheduled' },
  { id: 'g-j-4', date: '2026-06-22', time: '23:00', group: 'J', md: 2, home: 'JOR', away: 'ALG', venue: "Levi's Stadium",            city: 'San Francisco',    status: 'scheduled' },

  // June 23 — Groups K, L
  { id: 'g-k-3', date: '2026-06-23', time: '13:00', group: 'K', md: 2, home: 'POR', away: 'UZB', venue: 'NRG Stadium',                city: 'Houston',          status: 'scheduled' },
  { id: 'g-l-3', date: '2026-06-23', time: '16:00', group: 'L', md: 2, home: 'ENG', away: 'GHA', venue: 'Gillette Stadium',           city: 'Boston',           status: 'scheduled' },
  { id: 'g-l-4', date: '2026-06-23', time: '19:00', group: 'L', md: 2, home: 'PAN', away: 'CRO', venue: 'BMO Field',                  city: 'Toronto',          status: 'scheduled' },
  { id: 'g-k-4', date: '2026-06-23', time: '22:00', group: 'K', md: 2, home: 'COL', away: 'COD', venue: 'Estadio Akron',             city: 'Guadalajara',      status: 'scheduled' },

  // ── MATCHDAY 3 (simultaneous) ─────────────────────────────────────────────────
  // June 24 — Groups A, B, C
  { id: 'g-b-5', date: '2026-06-24', time: '15:00', group: 'B', md: 3, home: 'SUI', away: 'CAN', venue: 'BC Place',                   city: 'Vancouver',        status: 'scheduled' },
  { id: 'g-b-6', date: '2026-06-24', time: '15:00', group: 'B', md: 3, home: 'BIH', away: 'QAT', venue: 'Lumen Field',                city: 'Seattle',          status: 'scheduled' },
  { id: 'g-c-5', date: '2026-06-24', time: '18:00', group: 'C', md: 3, home: 'SCO', away: 'BRA', venue: 'Hard Rock Stadium',          city: 'Miami',            status: 'scheduled' },
  { id: 'g-c-6', date: '2026-06-24', time: '18:00', group: 'C', md: 3, home: 'MAR', away: 'HTI', venue: 'Mercedes-Benz Stadium',      city: 'Atlanta',          status: 'scheduled' },
  { id: 'g-a-5', date: '2026-06-24', time: '21:00', group: 'A', md: 3, home: 'CZE', away: 'MEX', venue: 'Estadio Azteca',             city: 'Cidade do México', status: 'scheduled' },
  { id: 'g-a-6', date: '2026-06-24', time: '21:00', group: 'A', md: 3, home: 'RSA', away: 'KOR', venue: 'Estadio BBVA',               city: 'Monterrey',        status: 'scheduled' },

  // June 25 — Groups D, E, F
  { id: 'g-e-5', date: '2026-06-25', time: '16:00', group: 'E', md: 3, home: 'CUW', away: 'CIV', venue: 'Lincoln Financial Field',    city: 'Filadélfia',       status: 'scheduled' },
  { id: 'g-e-6', date: '2026-06-25', time: '16:00', group: 'E', md: 3, home: 'ECU', away: 'GER', venue: 'MetLife Stadium',            city: 'Nova York',        status: 'scheduled' },
  { id: 'g-f-5', date: '2026-06-25', time: '19:00', group: 'F', md: 3, home: 'JPN', away: 'SWE', venue: 'AT&T Stadium',               city: 'Dallas',           status: 'scheduled' },
  { id: 'g-f-6', date: '2026-06-25', time: '19:00', group: 'F', md: 3, home: 'TUN', away: 'NED', venue: 'Arrowhead Stadium',          city: 'Kansas City',      status: 'scheduled' },
  { id: 'g-d-5', date: '2026-06-25', time: '22:00', group: 'D', md: 3, home: 'TUR', away: 'USA', venue: 'SoFi Stadium',              city: 'Los Angeles',      status: 'scheduled' },
  { id: 'g-d-6', date: '2026-06-25', time: '22:00', group: 'D', md: 3, home: 'PAR', away: 'AUS', venue: "Levi's Stadium",            city: 'San Francisco',    status: 'scheduled' },

  // June 26 — Groups G, H, I
  { id: 'g-i-5', date: '2026-06-26', time: '15:00', group: 'I', md: 3, home: 'NOR', away: 'FRA', venue: 'Gillette Stadium',           city: 'Boston',           status: 'scheduled' },
  { id: 'g-i-6', date: '2026-06-26', time: '15:00', group: 'I', md: 3, home: 'SEN', away: 'IRQ', venue: 'BMO Field',                  city: 'Toronto',          status: 'scheduled' },
  { id: 'g-h-5', date: '2026-06-26', time: '20:00', group: 'H', md: 3, home: 'CPV', away: 'KSA', venue: 'NRG Stadium',                city: 'Houston',          status: 'scheduled' },
  { id: 'g-h-6', date: '2026-06-26', time: '20:00', group: 'H', md: 3, home: 'URU', away: 'ESP', venue: 'Estadio Akron',             city: 'Guadalajara',      status: 'scheduled' },
  { id: 'g-g-5', date: '2026-06-26', time: '23:00', group: 'G', md: 3, home: 'EGY', away: 'IRN', venue: 'Lumen Field',                city: 'Seattle',          status: 'scheduled' },
  { id: 'g-g-6', date: '2026-06-26', time: '23:00', group: 'G', md: 3, home: 'NZL', away: 'BEL', venue: 'BC Place',                   city: 'Vancouver',        status: 'scheduled' },

  // June 27 — Groups J, K, L
  { id: 'g-l-5', date: '2026-06-27', time: '17:00', group: 'L', md: 3, home: 'PAN', away: 'ENG', venue: 'MetLife Stadium',            city: 'Nova York',        status: 'scheduled' },
  { id: 'g-l-6', date: '2026-06-27', time: '17:00', group: 'L', md: 3, home: 'CRO', away: 'GHA', venue: 'Lincoln Financial Field',    city: 'Filadélfia',       status: 'scheduled' },
  { id: 'g-k-5', date: '2026-06-27', time: '19:30', group: 'K', md: 3, home: 'COL', away: 'POR', venue: 'Hard Rock Stadium',          city: 'Miami',            status: 'scheduled' },
  { id: 'g-k-6', date: '2026-06-27', time: '19:30', group: 'K', md: 3, home: 'COD', away: 'UZB', venue: 'Mercedes-Benz Stadium',      city: 'Atlanta',          status: 'scheduled' },
  { id: 'g-j-5', date: '2026-06-27', time: '22:00', group: 'J', md: 3, home: 'ALG', away: 'AUT', venue: 'Arrowhead Stadium',          city: 'Kansas City',      status: 'scheduled' },
  { id: 'g-j-6', date: '2026-06-27', time: '22:00', group: 'J', md: 3, home: 'JOR', away: 'ARG', venue: 'AT&T Stadium',               city: 'Dallas',           status: 'scheduled' },
]

const KNOCKOUT_RAW: RawKnockoutMatch[] = [
  ...Array.from({ length: 16 }, (_, i) => ({
    id: `ko-r32-${i + 1}`,
    stage: 'round_of_32' as const,
    stageLabel: `32 AVOS · ${i + 1}`,
    date: i < 8 ? '2026-06-28' : '2026-06-29',
    time: ['13:00', '16:00', '19:00', '22:00'][i % 4],
    homePlaceholder: `R32 ${i + 1} mandante`,
    awayPlaceholder: `R32 ${i + 1} visitante`,
    venue: 'A definir',
    city: 'A definir',
  })),
  ...Array.from({ length: 8 }, (_, i) => ({
    id: `ko-r16-${i + 1}`,
    stage: 'round_of_16' as const,
    stageLabel: `OITAVAS · ${i + 1}`,
    date: i < 4 ? '2026-07-04' : '2026-07-05',
    time: ['13:00', '16:00', '19:00', '22:00'][i % 4],
    homePlaceholder: `Vencedor R32 ${i * 2 + 1}`,
    awayPlaceholder: `Vencedor R32 ${i * 2 + 2}`,
    venue: 'A definir',
    city: 'A definir',
  })),
  ...Array.from({ length: 4 }, (_, i) => ({
    id: `ko-qf-${i + 1}`,
    stage: 'quarter_final' as const,
    stageLabel: `QUARTAS · ${i + 1}`,
    date: i < 2 ? '2026-07-09' : '2026-07-10',
    time: ['16:00', '22:00'][i % 2],
    homePlaceholder: `Vencedor Oitavas ${i * 2 + 1}`,
    awayPlaceholder: `Vencedor Oitavas ${i * 2 + 2}`,
    venue: 'A definir',
    city: 'A definir',
  })),
  ...Array.from({ length: 2 }, (_, i) => ({
    id: `ko-sf-${i + 1}`,
    stage: 'semi_final' as const,
    stageLabel: `SEMIFINAL · ${i + 1}`,
    date: i === 0 ? '2026-07-14' : '2026-07-15',
    time: '21:00',
    homePlaceholder: `Vencedor Quartas ${i * 2 + 1}`,
    awayPlaceholder: `Vencedor Quartas ${i * 2 + 2}`,
    venue: 'A definir',
    city: 'A definir',
  })),
  {
    id: 'ko-third-1',
    stage: 'third_place',
    stageLabel: 'TERCEIRO LUGAR',
    date: '2026-07-18',
    time: '17:00',
    homePlaceholder: 'Perdedor Semifinal 1',
    awayPlaceholder: 'Perdedor Semifinal 2',
    venue: 'A definir',
    city: 'A definir',
  },
  {
    id: 'ko-final-1',
    stage: 'final',
    stageLabel: 'FINAL',
    date: '2026-07-19',
    time: '18:00',
    homePlaceholder: 'Vencedor Semifinal 1',
    awayPlaceholder: 'Vencedor Semifinal 2',
    venue: 'MetLife Stadium',
    city: 'Nova York',
  },
]

// ─── Resolver ─────────────────────────────────────────────────────────────────

export function resolveMatch(r: RawMatch): Match {
  return {
    id: r.id,
    stage: 'group',
    stageLabel: `GRUPO ${r.group} · MD${r.md}`,
    group: r.group,
    home: TEAMS[r.home],
    away: TEAMS[r.away],
    homeScore: r.homeScore ?? null,
    awayScore: r.awayScore ?? null,
    date: fmtMatchDate(r.date),
    time: toBRT(r.date, r.time),
    kickoffUtc: toKickoffUtc(r.date, r.time),
    venue: `${r.venue} · ${r.city}`,
    status: r.status,
    liveMinute: r.liveMinute,
    winner: r.winner as Match['winner'],
  }
}

export function resolveKnockoutMatch(r: RawKnockoutMatch): Match {
  return {
    id: r.id,
    stage: r.stage,
    stageLabel: r.stageLabel,
    home: { ...TEAMS.TBD, name: r.homePlaceholder },
    away: { ...TEAMS.TBD, name: r.awayPlaceholder },
    homeScore: null,
    awayScore: null,
    date: fmtMatchDate(r.date),
    time: toBRT(r.date, r.time),
    kickoffUtc: toKickoffUtc(r.date, r.time),
    venue: `${r.venue} · ${r.city}`,
    status: 'scheduled',
    marketStatus: 'locked',
    lockReason: 'knockout_placeholder',
  }
}

// Helper: returns true if bets are still open for this match
// (kickoff is in the future — bets close at kickoff time)
export function isBettingOpen(match: Match): boolean {
  return isBetOpen(match)
}

// Helper: formats the BRT time as a display string with timezone label
export function fmtKickoffBRT(match: Match): string {
  return formatMatchDateTime(match)
}

// ─── Resolved exports ─────────────────────────────────────────────────────────

export const WC2026_GROUP_MATCHES: Match[] = RAW.map(resolveMatch)
export const WC2026_KNOCKOUT_MATCHES: Match[] = KNOCKOUT_RAW.map(resolveKnockoutMatch)
export const WC2026_MATCHES: Match[] = [...WC2026_GROUP_MATCHES, ...WC2026_KNOCKOUT_MATCHES]

export const WC2026_LIVE    = WC2026_MATCHES.filter(m => m.status === 'live')
export const WC2026_OPEN    = WC2026_MATCHES.filter(m => m.status === 'open')
export const WC2026_PAST    = WC2026_MATCHES.filter(m => m.status === 'finished')
export const WC2026_UPCOMING = WC2026_MATCHES.filter(m => m.status === 'open' || m.status === 'scheduled')
