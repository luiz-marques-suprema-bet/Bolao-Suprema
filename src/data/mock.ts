import type { RankingEntry, ChatMessage, BracketSlot, AppUser } from '@/types'
import { TEAMS } from './teams'
import { WC2026_LIVE, WC2026_OPEN, WC2026_PAST, WC2026_MATCHES } from './wc2026'

// ─── Current User (mock) ──────────────────────────────────────────────────────

export const MOCK_ME: AppUser = {
  id: 'user-1',
  email: 'felipe.souza@suprema.group',
  firstName: 'Felipe',
  lastName: 'Souza',
  dept: 'Design',
  initials: 'FS',
  color: '#00A651',
  favoriteTeam: 'BRA',
  championPick: 'ARG',
  since: '2023',
  isAdmin: true,
  createdAt: '2024-01-01',
}

// ─── Matches (sourced from real WC2026 schedule) ───────────────────────────────

export const MOCK_LIVE = WC2026_LIVE[0] ?? WC2026_MATCHES[0]

export const MOCK_UPCOMING = WC2026_OPEN.slice(0, 8)

export const MOCK_PAST = WC2026_PAST.map((m, i) => ({
  ...m,
  yourPick: [
    { home: 2, away: 0 },
    { home: 0, away: 1 },
    { home: 1, away: 0 },
    { home: 0, away: 3 },
  ][i] ?? { home: 1, away: 1 },
  pts: [5, 0, 3, 0][i] ?? 0,
}))

// ─── Ranking ──────────────────────────────────────────────────────────────────

export const MOCK_RANKING: RankingEntry[] = [
  { rank: 1,  userId: 'u2',     name: 'Lucas Mendes',   dept: 'Eng. Plataforma', initials: 'LM', color: '#00A651', pts: 1284, mov: '+2', correct: 18, exact: 5,  streak: 4 },
  { rank: 2,  userId: 'u3',     name: 'Camila Rocha',   dept: 'Produto',          initials: 'CR', color: '#6FB4FF', pts: 1198, mov: '+1', correct: 17, exact: 4,  streak: 2 },
  { rank: 3,  userId: 'u4',     name: 'Rafael Torres',  dept: 'Marketing',        initials: 'RT', color: '#C9A856', pts: 1102, mov: '-1', correct: 16, exact: 3,  streak: 1 },
  { rank: 4,  userId: 'u5',     name: 'Ana Lima',       dept: 'Financeiro',       initials: 'AL', color: '#E63946', pts:  984, mov: '-1', correct: 15, exact: 4,  streak: 3 },
  { rank: 5,  userId: 'u6',     name: 'Pedro Alves',    dept: 'Jurídico',         initials: 'PA', color: '#1D3557', pts:  921, mov: '+3', correct: 14, exact: 2,  streak: 2 },
  { rank: 6,  userId: 'user-1', name: 'Felipe Souza',   dept: 'Design',           initials: 'FS', color: '#00A651', pts: 1204, mov: '+0', correct: 15, exact: 5,  streak: 5, isYou: true },
  { rank: 7,  userId: 'u7',     name: 'Marina Costa',   dept: 'People',           initials: 'MC', color: '#FF6600', pts:  867, mov: '+1', correct: 13, exact: 2,  streak: 1 },
  { rank: 8,  userId: 'u8',     name: 'Thiago Nunes',   dept: 'Vendas',           initials: 'TN', color: '#006847', pts:  823, mov: '-2', correct: 12, exact: 3,  streak: 0 },
  { rank: 9,  userId: 'u9',     name: 'Bruna Ferreira', dept: 'Eng. Plataforma', initials: 'BF', color: '#74ACDF', pts:  756, mov: '—',  correct: 11, exact: 1,  streak: 2 },
  { rank: 10, userId: 'u10',    name: 'João Silva',     dept: 'Design',           initials: 'JS', color: '#AA151B', pts:  712, mov: '+2', correct: 10, exact: 2,  streak: 1 },
  { rank: 11, userId: 'u11',    name: 'Larissa Melo',   dept: 'Marketing',        initials: 'LM', color: '#5BB0D8', pts:  645, mov: '-1', correct: 9,  exact: 1,  streak: 0 },
  { rank: 12, userId: 'u12',    name: 'Carlos Pinto',   dept: 'Financeiro',       initials: 'CP', color: '#D52B1E', pts:  598, mov: '-1', correct: 8,  exact: 0,  streak: 0 },
]

// ─── Bracket ─────────────────────────────────────────────────────────────────

export const MOCK_BRACKET_SLOTS: BracketSlot[] = [
  { slotId: 'r16_1',   round: 'r16',   position: 1, matchId: null, homeTeam: TEAMS.BRA, awayTeam: TEAMS.ESP,  homeScore: null, awayScore: null, status: 'wait', winner: null },
  { slotId: 'r16_2',   round: 'r16',   position: 2, matchId: null, homeTeam: TEAMS.GER, awayTeam: TEAMS.NED,  homeScore: null, awayScore: null, status: 'wait', winner: null },
  { slotId: 'r16_3',   round: 'r16',   position: 3, matchId: null, homeTeam: TEAMS.FRA, awayTeam: TEAMS.ARG,  homeScore: null, awayScore: null, status: 'wait', winner: null },
  { slotId: 'r16_4',   round: 'r16',   position: 4, matchId: null, homeTeam: TEAMS.ENG, awayTeam: TEAMS.POR,  homeScore: null, awayScore: null, status: 'wait', winner: null },
  { slotId: 'r16_5',   round: 'r16',   position: 5, matchId: null, homeTeam: TEAMS.URU, awayTeam: TEAMS.BEL,  homeScore: null, awayScore: null, status: 'wait', winner: null },
  { slotId: 'r16_6',   round: 'r16',   position: 6, matchId: null, homeTeam: TEAMS.USA, awayTeam: TEAMS.MEX,  homeScore: null, awayScore: null, status: 'wait', winner: null },
  { slotId: 'r16_7',   round: 'r16',   position: 7, matchId: null, homeTeam: TEAMS.JPN, awayTeam: TEAMS.KOR,  homeScore: null, awayScore: null, status: 'wait', winner: null },
  { slotId: 'r16_8',   round: 'r16',   position: 8, matchId: null, homeTeam: TEAMS.ECU, awayTeam: TEAMS.MAR,  homeScore: null, awayScore: null, status: 'wait', winner: null },
  { slotId: 'qf_1',    round: 'qf',    position: 1, matchId: null, homeTeam: null, awayTeam: null, homeScore: null, awayScore: null, status: 'wait', winner: null },
  { slotId: 'qf_2',    round: 'qf',    position: 2, matchId: null, homeTeam: null, awayTeam: null, homeScore: null, awayScore: null, status: 'wait', winner: null },
  { slotId: 'qf_3',    round: 'qf',    position: 3, matchId: null, homeTeam: null, awayTeam: null, homeScore: null, awayScore: null, status: 'wait', winner: null },
  { slotId: 'qf_4',    round: 'qf',    position: 4, matchId: null, homeTeam: null, awayTeam: null, homeScore: null, awayScore: null, status: 'wait', winner: null },
  { slotId: 'sf_1',    round: 'sf',    position: 1, matchId: null, homeTeam: null, awayTeam: null, homeScore: null, awayScore: null, status: 'wait', winner: null },
  { slotId: 'sf_2',    round: 'sf',    position: 2, matchId: null, homeTeam: null, awayTeam: null, homeScore: null, awayScore: null, status: 'wait', winner: null },
  { slotId: 'final_1', round: 'final', position: 1, matchId: null, homeTeam: null, awayTeam: null, homeScore: null, awayScore: null, status: 'wait', winner: null },
]

// ─── Chat ─────────────────────────────────────────────────────────────────────

export const MOCK_CHAT: ChatMessage[] = [
  { id: 'c1', userId: 'u2',     channelId: 'geral', who: 'Lucas Mendes',   dept: 'Eng. Plataforma', initials: 'LM', color: '#00A651', time: '18:02', text: 'BRASIL ABRINDO O PLACAR! 1-0 Vini Jr!! 🇧🇷🔥', createdAt: new Date().toISOString() },
  { id: 'c2', userId: 'u3',     channelId: 'geral', who: 'Camila Rocha',   dept: 'Produto',          initials: 'CR', color: '#6FB4FF', time: '18:04', text: 'Meu palpite era 2-1 Brasil, tô na conta ainda 😭', createdAt: new Date().toISOString() },
  { id: 'c3', userId: 'user-1', channelId: 'geral', who: 'Felipe Souza',   dept: 'Design',           initials: 'FS', color: '#00A651', time: '18:06', text: 'Acertei o 2-1! Já passei pra frente no ranking 👀', isYou: true, reaction: '⚽', createdAt: new Date().toISOString() },
  { id: 'c4', userId: 'u4',     channelId: 'geral', who: 'Rafael Torres',  dept: 'Marketing',        initials: 'RT', color: '#C9A856', time: '18:08', text: 'Galera, Haiti × Escócia começa às 21h, ainda dá pra palpitar!', createdAt: new Date().toISOString() },
  {
    id: 'poll-1', userId: 'user-1', channelId: 'geral', who: 'Felipe Souza', dept: 'Design', initials: 'FS', color: '#00A651',
    time: '18:10', text: 'Brasil vai ganhar a Copa 2026?', type: 'poll',
    poll: {
      question: 'Brasil vai ganhar a Copa 2026? 🏆',
      options: [
        { id: 'o1', text: 'Sim! Hexa é agora 🇧🇷' },
        { id: 'o2', text: 'Não, vai cair nas quartas' },
        { id: 'o3', text: 'Final, mas perde nos pênaltis 😤' },
        { id: 'o4', text: 'Nem semi chega' },
      ],
      votes: { u2: 'o1', u3: 'o3', u4: 'o1', u5: 'o2', u6: 'o1' },
    },
    createdAt: new Date().toISOString(),
  },
  { id: 'c5', userId: 'u5',     channelId: 'geral', who: 'Ana Lima',       dept: 'Financeiro',       initials: 'AL', color: '#E63946', time: '18:14', text: 'Marrocos empatou!! 1-1 agora!! 😱😱', createdAt: new Date().toISOString() },
  { id: 'c6', userId: 'u6',     channelId: 'geral', who: 'Pedro Alves',    dept: 'Jurídico',         initials: 'PA', color: '#1D3557', time: '18:20', text: 'NÃO ACREDITO. Brasil vai virar ou tomamos gols?', reaction: '🔥', createdAt: new Date().toISOString() },
  { id: 'c7', userId: 'u2',     channelId: 'geral', who: 'Lucas Mendes',   dept: 'Eng. Plataforma', initials: 'LM', color: '#00A651', time: '18:31', text: '2-1 VINI JR DE NOVO! HEXA! HEXA! HEXA! 🇧🇷🏆🔥', createdAt: new Date().toISOString() },
]
