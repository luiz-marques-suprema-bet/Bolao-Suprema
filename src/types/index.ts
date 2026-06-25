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
  dept: string
  initials: string
  color: string
  avatarUrl?: string
  bannerUrl?: string
  bio?: string
  favoriteTeam?: TeamCode
  favoritePlayer?: string
  favoritePlayerImg?: string
  since: string
  isAdmin: boolean
  isMarketing: boolean
  isOwner?: boolean
  userRole?: UserRole
  participantStatus?: ParticipantStatus
  privacyHideEmail?: boolean
  privacyHideProfile?: boolean
  createdAt: string
}

// ─── Match ───────────────────────────────────────────────────────────────────

export type MatchStatus = 'scheduled' | 'open' | 'live' | 'finished' | 'locked'
export type MarketStatus = 'open' | 'locked' | 'closed' | 'settled'

// Status de aposta derivado do match status (para UX)
export type BettingStatus = 'not_open' | 'open' | 'closing_soon' | 'locked' | 'settled'

// Override de status vindo do Supabase — sobrepõe os dados estáticos do wc2026.ts
export interface MatchStatusOverride {
  matchCode: string
  status: MatchStatus
  marketStatus?: MarketStatus | null
  // Times do banco — mudam no mata-mata conforme os classificados saem
  // (materialização). Para a fase de grupos são sempre os mesmos do estático.
  homeCode?: string | null
  awayCode?: string | null
  homeScore: number | null
  awayScore: number | null
  liveMinute?: string | null
  winner?: string | null
  lockedAt?: string | null
  lockedBy?: string | null
  lockReason?: string | null
  unlockedAt?: string | null
  settledAt?: string | null
  kickoffUtc?: string | null
  date?: string | null
  time?: string | null
}
export type MatchStage =
  | 'group'
  | 'round_of_32'
  | 'round_of_16'
  | 'quarter_final'
  | 'semi_final'
  | 'third_place'
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
  date: string    // e.g. "QUI 11 JUN" — formatted in pt-BR
  time: string    // e.g. "17:00" — BRT (America/Sao_Paulo, UTC-3)
  kickoffUtc: string  // ISO 8601 UTC for deadline and auto-close logic
  venue: string
  status: MatchStatus
  marketStatus?: MarketStatus | null
  liveMinute?: string // e.g. "68'"
  winner?: TeamCode | 'draw'
  lockedAt?: string | null
  lockedBy?: string | null
  lockReason?: string | null
  unlockedAt?: string | null
  settledAt?: string | null
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

export type BracketRound = 'r32' | 'r16' | 'qf' | 'sf' | 'third' | 'final'

export interface BracketSlot {
  slotId: string // e.g. "r32_1", "r16_1", "qf_1"
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
  avatarUrl?: string
  pts: number
  mov: Mov
  correct: number // correct winner predictions
  exact: number // exact score predictions
  streak: number
  matchPoints?: number
  specialPoints?: number
  knockoutPoints?: number
  finalExact?: boolean
  scorerTiebreakGoals?: number
  scorerPickHit?: boolean
  firstPredictionAt?: string | null
  snapshotAt?: string
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

export interface ChatReaction {
  emoji: string
  userId: string
  createdAt: string
}

export interface ChatMessage {
  id: string
  userId: string
  channelId: string
  who: string
  dept: string
  initials: string
  color: string
  avatarUrl?: string
  time: string
  text: string
  type?: 'text' | 'gif' | 'poll' | 'image' | 'audio' | 'video' | 'video_note'
  gifUrl?: string
  imageUrl?: string
  audioUrl?: string
  videoUrl?: string
  mediaUrl?: string
  mediaKind?: 'text' | 'gif' | 'poll' | 'image' | 'audio' | 'video' | 'video_note'
  mediaMime?: string
  mediaSize?: number
  audioDuration?: number
  mediaDuration?: number
  mediaThumbnailUrl?: string
  mentions?: string[]
  isPinned?: boolean
  poll?: ChatPoll
  reaction?: string
  reactions?: ChatReaction[]
  replyTo?: { id: string; who: string; text: string; type: string }
  isYou?: boolean
  createdAt: string
  editedAt?: string
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
  imageFitMode?: ImageFitMode
  authorId: string
  authorName: string
  createdAt: string
  isPinned?: boolean
}

export type ImageFitMode = 'cover' | 'contain'

export type ParticipantStatus = 'pending' | 'active' | 'blocked' | 'removed'
export type UserRole = 'user' | 'marketing' | 'admin' | 'owner'
export type StorageBucket = 'avatars' | 'banners' | 'bulletins'

export type AuditAction =
  | 'market_open'
  | 'market_locked'
  | 'market_closed'
  | 'market_settled'
  | 'match_settled'
  | 'prediction_created'
  | 'prediction_updated'
  | 'profile_updated'
  | 'bulletin_created'
  | 'bulletin_updated'
  | 'chat_delete'
  | 'chat_important'
  | 'participant_pending'
  | 'participant_active'
  | 'participant_blocked'
  | 'participant_removed'
  | 'ranking_refreshed'
  | string

export interface ScoringRule {
  id: string
  label: string
  category: 'match' | 'general' | string
  stage: 'group' | 'knockout' | 'all' | string
  points: number
  sortOrder: number
  isActive: boolean
  updatedAt?: string
}

export interface Notification {
  id: string
  userId?: string | null
  channel: 'in_app' | 'email' | 'whatsapp' | 'push'
  type: string
  title: string
  body: string
  entityType?: string | null
  entityId?: string | null
  readAt?: string | null
  createdAt: string
}

export interface Invite {
  id: string
  code: string
  label: string
  createdBy?: string | null
  maxUses?: number | null
  usedCount: number
  expiresAt?: string | null
  isActive: boolean
  createdAt: string
}

export interface RankingBreakdown {
  id: string
  userId: string
  sourceType: 'match' | 'general' | 'bonus' | 'adjustment'
  sourceId: string
  label: string
  points: number
  details: Record<string, unknown>
  calculatedAt: string
}

export interface SystemHealthStatus {
  usersTotal: number
  usersPending: number
  predictionsTotal: number
  chatMessagesTotal: number
  bulletinsTotal: number
  marketsOpen: number
  marketsLocked: number
  matchesWithoutKickoff: number
  lastRankingRefresh?: string | null
}

export interface PredictionSaveResult {
  ok: boolean
  error?: string
  prediction?: Prediction
}

export interface BracketLock {
  round: BracketRound
  lockedAt: string
  lockedBy?: string | null
  reason?: string | null
}

export interface RankingComputationResult {
  ok: boolean
  refreshedAt?: string
  error?: string
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

// ─── Fase de grupos ────────────────────────────────────────────────────────────
// ─── Fase eliminatória ────────────────────────────────────────────────────────
// ─── Apostas gerais ───────────────────────────────────────────────────────────
export const POINT_RULES: PointRule[] = [
  // Grupos
  { id: 'group_exact',    label: 'Placar exato',               description: 'ex: colocou 2×1 e foi 2×1',              points: 10, icon: '★' },
  { id: 'group_score1',   label: 'Resultado + gols do vencedor', description: 'ex: colocou 3×0 e foi 3×1',            points:  7, icon: '✓' },
  { id: 'group_result',   label: 'Acerto do resultado',        description: 'ex: colocou 2×1 e foi 1×0 (ganhou)',      points:  5, icon: '○' },
  { id: 'group_goals1',   label: 'Gols de uma equipe',         description: 'ex: colocou 1×1 e foi 2×1',              points:  1, icon: '·' },
  // Mata-mata
  { id: 'ko_exact',       label: 'Placar exato (mata-mata)',   description: 'placar no tempo regulamentar',            points: 12, icon: '★' },
  { id: 'ko_score1',      label: 'Resultado + gols (mata-mata)',description: 'resultado certo + gols do vencedor',    points:  8, icon: '✓' },
  { id: 'ko_result',      label: 'Resultado (mata-mata)',      description: 'acertou o vencedor no regulamentar',      points:  5, icon: '○' },
  { id: 'ko_qualified',   label: 'Acerto do classificado',     description: 'incluindo prorrogação e pênaltis',        points:  2, icon: '→' },
  // Longo prazo
  { id: 'champion',       label: 'Campeão',                    description: 'seleção campeã do mundo',                 points: 25, icon: '◆' },
  { id: 'vice',           label: 'Vice-campeão',               description: 'seleção vice-campeã',                     points: 15, icon: '▽' },
  { id: 'scorer',         label: 'Artilheiro',                 description: 'artilheiro da competição (+ desempate)',   points: 10, icon: '○' },
]
