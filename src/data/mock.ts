import type { RankingEntry, BracketSlot, AppUser } from '@/types'
import { TEAMS } from './teams'
import { WC2026_MATCHES } from './wc2026'

// ─── Current User (mock login) ────────────────────────────────────────────────
// Replaced on real auth — used only in mock/dev mode

export const MOCK_ME: AppUser = {
  id: 'user-1',
  email: 'joao.silva@suprema.group',
  firstName: 'João',
  lastName: 'Silva',
  dept: 'Design',
  initials: 'JS',
  color: '#00A651',
  since: '2026',
  isAdmin: true,
  createdAt: '2026-05-09',
}

// ─── Matches ──────────────────────────────────────────────────────────────────
// All sourced from real WC2026 schedule — no fake scores

export const MOCK_LIVE     = undefined              // no live matches yet
export const MOCK_UPCOMING = WC2026_MATCHES          // all 72 group stage matches
export const MOCK_PAST: typeof WC2026_MATCHES = []  // no finished matches yet

// ─── Ranking ──────────────────────────────────────────────────────────────────
// Empty until tournament starts (June 11)

export const MOCK_RANKING: RankingEntry[] = []

// ─── Bracket ─────────────────────────────────────────────────────────────────
// WC2026: 12 groups -> 32 qualifiers -> 16 R32 -> 8 R16 -> 4 QF -> 2 SF -> third + final

const makeSlot = (round: BracketSlot['round'], position: number): BracketSlot => ({
  slotId: `${round}_${position}`,
  round,
  position,
  matchId: null,
  homeTeam: null,
  awayTeam: null,
  homeScore: null,
  awayScore: null,
  status: 'wait',
  winner: null,
})

export const MOCK_BRACKET_SLOTS: BracketSlot[] = [
  ...Array.from({ length: 16 }, (_, i) => makeSlot('r32', i + 1)),
  ...Array.from({ length: 8 }, (_, i) => makeSlot('r16', i + 1)),
  ...Array.from({ length: 4 }, (_, i) => makeSlot('qf', i + 1)),
  ...Array.from({ length: 2 }, (_, i) => makeSlot('sf', i + 1)),
  makeSlot('third', 1),
  makeSlot('final', 1),
]
