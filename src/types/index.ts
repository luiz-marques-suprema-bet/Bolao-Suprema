// ─── Team ────────────────────────────────────────────────────────────────────

export type TeamCode = string

export interface Team {
  code: TeamCode
  name: string
  flag: string // path relative to base URL, e.g. 'assets/flags/brazil.png'
  color: string
  group: string
}

// ─── Auth / User ─────────────────────────────────────────────────────────────

export interface AppUser {
  id: string
  email: string
  firstName: string
  lastName: string
  nickname?: string
  dept: string
  initials: string
  color: string
  avatarUrl?: string
  favoriteTeam?: TeamCode
  championPick?: TeamCode
  since: string
  isAdmin: boolean
  createdAt: string
}

// ─── Match ───────────────────────────────────────────────────────────────────

export type MatchStatus = 'scheduled' | 'open' | 'live' | 'finished' | 'locked'
export type MatchStage =
  | 'group'
  | 'round_of_16'
  | 'quarter_final'
  | 'semi_final'
  | 'final'

export interface Match {
  id: string
  stage: MatchStage
  stageLabel: string // e.g. "GRUPO A · MD1" / "OITAVAS · 1"
  group?: string     // e.g. 'A' … 'L' (group stage only)
  home: Team
  away: Team
  homeScore: number | null
  awayScore: number | null
  date: string // e.g. "QUI 11 JUN"
  time: string // e.g. "15:00"
  venue: string
  status: MatchStatus
  liveMinute?: string // e.g. "68'"
  winner?: TeamCode | 'draw'
}

// ─── Prediction ───────────────────────────────────────────────────────────────

export interface Prediction {
  id: string
  userId: string
  matchId: string
  homeScore: number
  awayScore: number
  submittedAt: string
  pointsEarned?: number
}

export interface PredictionWithMatch extends Prediction {
  match: Match
}

// ─── Bracket ─────────────────────────────────────────────────────────────────

export type BracketRound = 'r16' | 'qf' | 'sf' | 'final'

export interface BracketSlot {
  slotId: string // e.g. "r16_m1", "qf_m1"
  round: BracketRound
  position: number
  matchId: string | null // null = TBD (depends on prior round picks)
  homeTeam: Team | null
  awayTeam: Team | null
  homeScore: number | null
  awayScore: number | null
  status: 'wait' | 'open' | 'live' | 'done' | 'pens'
  winner: TeamCode | null
  liveMinute?: string
}

export interface BracketPick {
  id: string
  userId: string
  slotId: string
  round: BracketRound
  pickedWinner: TeamCode
  lockedAt: string | null
  isCorrect?: boolean
}

export interface BracketState {
  slots: BracketSlot[]
  picks: Record<string, TeamCode> // slotId → pickedWinner
  lockedRounds: BracketRound[]
}

// ─── Ranking / Leaderboard ───────────────────────────────────────────────────

export type Mov = `+${number}` | `-${number}` | '—'

export interface RankingEntry {
  rank: number
  userId: string
  name: string
  dept: string
  initials: string
  color: string
  pts: number
  mov: Mov
  correct: number // correct winner predictions
  exact: number // exact score predictions
  streak: number
  isYou?: boolean
}

// ─── Chat / Resenha ──────────────────────────────────────────────────────────

export interface PollOption {
  id: string
  text: string
}

export interface ChatPoll {
  question: string
  options: PollOption[]
  votes: Record<string, string> // userId → optionId
}

export interface ChatMessage {
  id: string
  userId: string
  channelId: string
  who: string
  dept: string
  initials: string
  color: string
  time: string
  text: string
  type?: 'text' | 'gif' | 'poll'
  gifUrl?: string
  isPinned?: boolean
  poll?: ChatPoll
  reaction?: string
  isYou?: boolean
  createdAt: string
}

export interface ChatChannel {
  id: string
  label: string // e.g. "#geral"
  unread?: number
  isActive?: boolean
}

// ─── Boletim / Canvas CMS ────────────────────────────────────────────────────

export interface Boletim {
  id: string
  label: string       // e.g. "REGRAS", "BRASIL", "AGENDA"
  title: string
  subtitle?: string
  body: string
  imageUrl?: string
  authorId: string
  authorName: string
  createdAt: string
  isPinned?: boolean
}

// ─── Admin ───────────────────────────────────────────────────────────────────

export type AdminMatchAction = 'open' | 'close' | 'set_result' | 'set_live'

export interface AdminKPI {
  label: string
  value: string | number
  sub: string
}

// ─── Point System ────────────────────────────────────────────────────────────

export interface PointRule {
  id: string
  label: string
  description: string
  points: number
  icon: string
}

export const POINT_RULES: PointRule[] = [
  { id: 'winner', label: 'Acerto de vencedor', description: 'time que ganhou', points: 3, icon: '✓' },
  { id: 'exact', label: 'Placar exato', description: 'resultado certinho', points: 5, icon: '★' },
  { id: 'bracket', label: 'Progressão no bracket', description: 'time que avançou', points: 10, icon: '→' },
  { id: 'champion', label: 'Campeão certo', description: 'palpite do campeão', points: 50, icon: '🏆' },
]
