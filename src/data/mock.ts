import type { Match, RankingEntry, ChatMessage, BracketSlot, AppUser } from '@/types'
import { TEAMS } from './teams'

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
  isAdmin: false,
  createdAt: '2024-01-01',
}

// ─── Matches ─────────────────────────────────────────────────────────────────

export const MOCK_UPCOMING: Match[] = [
  {
    id: 'm1',
    stage: 'round_of_16',
    stageLabel: 'OITAVAS · 1',
    home: TEAMS.POR,
    away: TEAMS.URU,
    homeScore: null,
    awayScore: null,
    date: 'SEX 03 JUL',
    time: '16:00',
    venue: 'Estádio Azteca · Cidade do México',
    status: 'open',
  },
  {
    id: 'm2',
    stage: 'round_of_16',
    stageLabel: 'OITAVAS · 2',
    home: TEAMS.GER,
    away: TEAMS.MEX,
    homeScore: null,
    awayScore: null,
    date: 'SAB 04 JUL',
    time: '18:00',
    venue: 'AT&T Stadium · Dallas',
    status: 'open',
  },
  {
    id: 'm3',
    stage: 'round_of_16',
    stageLabel: 'OITAVAS · 3',
    home: TEAMS.NED,
    away: TEAMS.CAN,
    homeScore: null,
    awayScore: null,
    date: 'SAB 04 JUL',
    time: '20:00',
    venue: 'MetLife Stadium · Nova York',
    status: 'open',
  },
  {
    id: 'm4',
    stage: 'round_of_16',
    stageLabel: 'OITAVAS · 4',
    home: TEAMS.BRA,
    away: TEAMS.KOR,
    homeScore: null,
    awayScore: null,
    date: 'DOM 05 JUL',
    time: '15:00',
    venue: 'SoFi Stadium · Los Angeles',
    status: 'open',
  },
]

export const MOCK_LIVE: Match = {
  id: 'm0',
  stage: 'round_of_16',
  stageLabel: 'OITAVAS · AO VIVO',
  home: TEAMS.POR,
  away: TEAMS.URU,
  homeScore: 1,
  awayScore: 1,
  date: 'QUI 03 JUL',
  time: '16:00',
  venue: 'Estádio Azteca',
  status: 'live',
  liveMinute: "68'",
}

export const MOCK_PAST: (Match & { yourPick?: { home: number; away: number }; pts?: number })[] = [
  {
    id: 'p1', stage: 'round_of_16', stageLabel: 'OITAVAS',
    home: TEAMS.FRA, away: TEAMS.ARG, homeScore: 3, awayScore: 3,
    date: 'TER 01 JUL', time: '20:00', venue: 'MetLife',
    status: 'finished', winner: 'draw',
    yourPick: { home: 1, away: 2 }, pts: 0,
  },
  {
    id: 'p2', stage: 'round_of_16', stageLabel: 'OITAVAS',
    home: TEAMS.BRA, away: TEAMS.ESP, homeScore: 2, awayScore: 1,
    date: 'SEG 30 JUN', time: '16:00', venue: 'SoFi Stadium',
    status: 'finished', winner: 'BRA',
    yourPick: { home: 2, away: 1 }, pts: 5,
  },
  {
    id: 'p3', stage: 'round_of_16', stageLabel: 'OITAVAS',
    home: TEAMS.ENG, away: TEAMS.NED, homeScore: 2, awayScore: 0,
    date: 'DOM 29 JUN', time: '12:00', venue: 'AT&T Stadium',
    status: 'finished', winner: 'ENG',
    yourPick: { home: 1, away: 0 }, pts: 3,
  },
]

// ─── Ranking ──────────────────────────────────────────────────────────────────

export const MOCK_RANKING: RankingEntry[] = [
  { rank: 1, userId: 'u2', name: 'Lucas Mendes', dept: 'Eng. Plataforma', initials: 'LM', color: '#00A651', pts: 1284, mov: '+2', correct: 18, exact: 5, streak: 4 },
  { rank: 2, userId: 'u3', name: 'Camila Rocha', dept: 'Produto', initials: 'CR', color: '#6FB4FF', pts: 1198, mov: '+1', correct: 17, exact: 4, streak: 2 },
  { rank: 3, userId: 'u4', name: 'Rafael Torres', dept: 'Marketing', initials: 'RT', color: '#C9A856', pts: 1102, mov: '-1', correct: 16, exact: 3, streak: 1 },
  { rank: 4, userId: 'u5', name: 'Ana Lima', dept: 'Financeiro', initials: 'AL', color: '#E63946', pts: 984, mov: '-1', correct: 15, exact: 4, streak: 3 },
  { rank: 5, userId: 'u6', name: 'Pedro Alves', dept: 'Jurídico', initials: 'PA', color: '#1D3557', pts: 921, mov: '+3', correct: 14, exact: 2, streak: 2 },
  { rank: 6, userId: 'user-1', name: 'Felipe Souza', dept: 'Design', initials: 'FS', color: '#00A651', pts: 1204, mov: '+0', correct: 15, exact: 5, streak: 5, isYou: true },
  { rank: 7, userId: 'u7', name: 'Marina Costa', dept: 'People', initials: 'MC', color: '#FF6600', pts: 867, mov: '+1', correct: 13, exact: 2, streak: 1 },
  { rank: 8, userId: 'u8', name: 'Thiago Nunes', dept: 'Vendas', initials: 'TN', color: '#006847', pts: 823, mov: '-2', correct: 12, exact: 3, streak: 0 },
  { rank: 9, userId: 'u9', name: 'Bruna Ferreira', dept: 'Eng. Plataforma', initials: 'BF', color: '#74ACDF', pts: 756, mov: '—', correct: 11, exact: 1, streak: 2 },
  { rank: 10, userId: 'u10', name: 'João Silva', dept: 'Design', initials: 'JS', color: '#AA151B', pts: 712, mov: '+2', correct: 10, exact: 2, streak: 1 },
  { rank: 11, userId: 'u11', name: 'Larissa Melo', dept: 'Marketing', initials: 'LM', color: '#5BB0D8', pts: 645, mov: '-1', correct: 9, exact: 1, streak: 0 },
  { rank: 12, userId: 'u12', name: 'Carlos Pinto', dept: 'Financeiro', initials: 'CP', color: '#D52B1E', pts: 598, mov: '-1', correct: 8, exact: 0, streak: 0 },
]

// ─── Bracket ─────────────────────────────────────────────────────────────────

export const MOCK_BRACKET_SLOTS: BracketSlot[] = [
  // Round of 16
  { slotId: 'r16_1', round: 'r16', position: 1, matchId: 'm_r16_1', homeTeam: TEAMS.POR, awayTeam: TEAMS.URU, homeScore: 1, awayScore: 1, status: 'live', winner: null, liveMinute: "68'" },
  { slotId: 'r16_2', round: 'r16', position: 2, matchId: 'm_r16_2', homeTeam: TEAMS.GER, awayTeam: TEAMS.MEX, homeScore: 2, awayScore: 0, status: 'done', winner: 'GER' },
  { slotId: 'r16_3', round: 'r16', position: 3, matchId: 'm_r16_3', homeTeam: TEAMS.NED, awayTeam: TEAMS.CAN, homeScore: null, awayScore: null, status: 'open', winner: null },
  { slotId: 'r16_4', round: 'r16', position: 4, matchId: 'm_r16_4', homeTeam: TEAMS.BRA, awayTeam: TEAMS.KOR, homeScore: null, awayScore: null, status: 'open', winner: null },
  { slotId: 'r16_5', round: 'r16', position: 5, matchId: 'm_r16_5', homeTeam: TEAMS.FRA, awayTeam: TEAMS.SEN, homeScore: 2, awayScore: 1, status: 'done', winner: 'FRA' },
  { slotId: 'r16_6', round: 'r16', position: 6, matchId: 'm_r16_6', homeTeam: TEAMS.ENG, awayTeam: TEAMS.COL, homeScore: 1, awayScore: 0, status: 'done', winner: 'ENG' },
  { slotId: 'r16_7', round: 'r16', position: 7, matchId: 'm_r16_7', homeTeam: TEAMS.ARG, awayTeam: TEAMS.ECU, homeScore: 3, awayScore: 0, status: 'done', winner: 'ARG' },
  { slotId: 'r16_8', round: 'r16', position: 8, matchId: 'm_r16_8', homeTeam: TEAMS.ESP, awayTeam: TEAMS.JPN, homeScore: null, awayScore: null, status: 'wait', winner: null },
  // QF (TBD — propagated from R16)
  { slotId: 'qf_1', round: 'qf', position: 1, matchId: null, homeTeam: null, awayTeam: null, homeScore: null, awayScore: null, status: 'wait', winner: null },
  { slotId: 'qf_2', round: 'qf', position: 2, matchId: null, homeTeam: TEAMS.GER, awayTeam: null, homeScore: null, awayScore: null, status: 'wait', winner: null },
  { slotId: 'qf_3', round: 'qf', position: 3, matchId: null, homeTeam: TEAMS.FRA, awayTeam: TEAMS.ENG, homeScore: null, awayScore: null, status: 'wait', winner: null },
  { slotId: 'qf_4', round: 'qf', position: 4, matchId: null, homeTeam: TEAMS.ARG, awayTeam: null, homeScore: null, awayScore: null, status: 'wait', winner: null },
  // SF
  { slotId: 'sf_1', round: 'sf', position: 1, matchId: null, homeTeam: null, awayTeam: null, homeScore: null, awayScore: null, status: 'wait', winner: null },
  { slotId: 'sf_2', round: 'sf', position: 2, matchId: null, homeTeam: null, awayTeam: null, homeScore: null, awayScore: null, status: 'wait', winner: null },
  // Final
  { slotId: 'final_1', round: 'final', position: 1, matchId: null, homeTeam: null, awayTeam: null, homeScore: null, awayScore: null, status: 'wait', winner: null },
]

// ─── Chat ─────────────────────────────────────────────────────────────────────

export const MOCK_CHAT: ChatMessage[] = [
  { id: 'c1', userId: 'u2', channelId: 'geral', who: 'Lucas Mendes', dept: 'Eng. Plataforma', initials: 'LM', color: '#00A651', time: '14:02', text: 'Alguém viu o pênalti do Neymar no segundo tempo??', createdAt: new Date().toISOString() },
  { id: 'c2', userId: 'u3', channelId: 'geral', who: 'Camila Rocha', dept: 'Produto', initials: 'CR', color: '#6FB4FF', time: '14:03', text: 'Vi sim, absurdo demais 😭 meu palpite foi por água', createdAt: new Date().toISOString() },
  { id: 'c3', userId: 'user-1', channelId: 'geral', who: 'Felipe Souza', dept: 'Design', initials: 'FS', color: '#00A651', time: '14:04', text: 'LAMENTÁVEL. Eu acertei o 1-1 já pensando nisso', isYou: true, reaction: '⚽', createdAt: new Date().toISOString() },
  { id: 'c4', userId: 'u4', channelId: 'geral', who: 'Rafael Torres', dept: 'Marketing', initials: 'RT', color: '#C9A856', time: '14:05', text: 'Galera, ainda dá tempo de colar no ranking. GER × MEX às 18h', createdAt: new Date().toISOString() },
  {
    id: 'poll-1', userId: 'admin', channelId: 'geral', who: 'Admin', dept: 'Suprema Gaming', initials: 'AD', color: '#0D0D0D',
    time: '14:07', text: 'Quem vai ser campeão da Copa 2026?', type: 'poll',
    poll: {
      question: 'Quem vai ser campeão da Copa 2026?',
      options: [
        { id: 'o1', text: 'Brasil 🇧🇷' },
        { id: 'o2', text: 'Argentina 🇦🇷' },
        { id: 'o3', text: 'França 🇫🇷' },
        { id: 'o4', text: 'Alemanha 🇩🇪' },
      ],
      votes: { u2: 'o1', u3: 'o2', u4: 'o1', u5: 'o3', u6: 'o1' },
    },
    createdAt: new Date().toISOString(),
  },
  { id: 'c5', userId: 'u5', channelId: 'geral', who: 'Ana Lima', dept: 'Financeiro', initials: 'AL', color: '#E63946', time: '14:08', text: 'Minha aposta tá na Holanda hoje. 2-0 e fechei!', createdAt: new Date().toISOString() },
  { id: 'c6', userId: 'u6', channelId: 'geral', who: 'Pedro Alves', dept: 'Jurídico', initials: 'PA', color: '#1D3557', time: '14:10', text: 'Brasil vai passar com goleada na quarta 🔥', reaction: '🔥', createdAt: new Date().toISOString() },
]
