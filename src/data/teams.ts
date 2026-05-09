import type { Team } from '@/types'
import { asset } from '@/lib/utils'

const flag = (name: string) => asset(`assets/flags/${name}.png`)

export const TEAMS: Record<string, Team> = {
  // ── Grupo A ──────────────────────────────────────────────────────────────────
  MEX: { code: 'MEX', name: 'México',        flag: flag('mexico'),        color: '#006847', group: 'A' },
  RSA: { code: 'RSA', name: 'África do Sul', flag: flag('south-africa'),  color: '#007A4D', group: 'A' },
  KOR: { code: 'KOR', name: 'Coreia do Sul', flag: flag('south-korea'),   color: '#003478', group: 'A' },
  CZE: { code: 'CZE', name: 'Tchéquia',      flag: flag('czechia'),       color: '#D7141A', group: 'A' },

  // ── Grupo B ──────────────────────────────────────────────────────────────────
  CAN: { code: 'CAN', name: 'Canadá',        flag: flag('canada'),        color: '#FF0000', group: 'B' },
  SUI: { code: 'SUI', name: 'Suíça',         flag: flag('switzerland'),   color: '#FF0000', group: 'B' },
  QAT: { code: 'QAT', name: 'Catar',         flag: flag('qatar'),         color: '#8D153A', group: 'B' },
  BIH: { code: 'BIH', name: 'Bósnia',        flag: flag('bosnia'),        color: '#002395', group: 'B' },

  // ── Grupo C ──────────────────────────────────────────────────────────────────
  BRA: { code: 'BRA', name: 'Brasil',        flag: flag('brazil'),        color: '#009C3B', group: 'C' },
  MAR: { code: 'MAR', name: 'Marrocos',      flag: flag('morocco'),       color: '#C1272D', group: 'C' },
  HAI: { code: 'HAI', name: 'Haiti',         flag: flag('haiti'),         color: '#00209F', group: 'C' },
  SCO: { code: 'SCO', name: 'Escócia',       flag: flag('scotland'),      color: '#003078', group: 'C' },

  // ── Grupo D ──────────────────────────────────────────────────────────────────
  USA: { code: 'USA', name: 'Estados Unidos',flag: flag('united-states'), color: '#B22234', group: 'D' },
  PAR: { code: 'PAR', name: 'Paraguai',      flag: flag('paraguay'),      color: '#D52B1E', group: 'D' },
  AUS: { code: 'AUS', name: 'Austrália',     flag: flag('australia'),     color: '#00843D', group: 'D' },
  TUR: { code: 'TUR', name: 'Türkiye',       flag: flag('turkiye'),       color: '#E30A17', group: 'D' },

  // ── Grupo E ──────────────────────────────────────────────────────────────────
  GER: { code: 'GER', name: 'Alemanha',      flag: flag('germany'),       color: '#000000', group: 'E' },
  CUW: { code: 'CUW', name: 'Curaçao',       flag: flag('curacao'),       color: '#003DA5', group: 'E' },
  CIV: { code: 'CIV', name: 'Costa do Marfim',flag: flag('ivory-coast'),  color: '#F77F00', group: 'E' },
  ECU: { code: 'ECU', name: 'Equador',       flag: flag('ecuador'),       color: '#FFD700', group: 'E' },

  // ── Grupo F ──────────────────────────────────────────────────────────────────
  NED: { code: 'NED', name: 'Holanda',       flag: flag('netherlands'),   color: '#FF6600', group: 'F' },
  JPN: { code: 'JPN', name: 'Japão',         flag: flag('japan'),         color: '#BC002D', group: 'F' },
  SWE: { code: 'SWE', name: 'Suécia',        flag: flag('sweden'),        color: '#006AA7', group: 'F' },
  TUN: { code: 'TUN', name: 'Tunísia',       flag: flag('tunisia'),       color: '#E70013', group: 'F' },

  // ── Grupo G ──────────────────────────────────────────────────────────────────
  BEL: { code: 'BEL', name: 'Bélgica',       flag: flag('belgium'),       color: '#EF3340', group: 'G' },
  EGY: { code: 'EGY', name: 'Egito',         flag: flag('egypt'),         color: '#CE1126', group: 'G' },
  IRN: { code: 'IRN', name: 'Irã',           flag: flag('iran'),          color: '#239F40', group: 'G' },
  NZL: { code: 'NZL', name: 'Nova Zelândia', flag: flag('new-zealand'),   color: '#00247D', group: 'G' },

  // ── Grupo H ──────────────────────────────────────────────────────────────────
  ESP: { code: 'ESP', name: 'Espanha',       flag: flag('spain'),         color: '#AA151B', group: 'H' },
  CPV: { code: 'CPV', name: 'Cabo Verde',    flag: flag('cape-verde'),    color: '#003893', group: 'H' },
  KSA: { code: 'KSA', name: 'Arábia Saudita',flag: flag('saudi-arabia'),  color: '#006C35', group: 'H' },
  URU: { code: 'URU', name: 'Uruguai',       flag: flag('uruguay'),       color: '#5BB0D8', group: 'H' },

  // ── Grupo I ──────────────────────────────────────────────────────────────────
  FRA: { code: 'FRA', name: 'França',        flag: flag('france'),        color: '#002395', group: 'I' },
  SEN: { code: 'SEN', name: 'Senegal',       flag: flag('senegal'),       color: '#00853F', group: 'I' },
  NOR: { code: 'NOR', name: 'Noruega',       flag: flag('norway'),        color: '#EF2B2D', group: 'I' },
  IRQ: { code: 'IRQ', name: 'Iraque',        flag: flag('iraq'),          color: '#007A3D', group: 'I' },

  // ── Grupo J ──────────────────────────────────────────────────────────────────
  ARG: { code: 'ARG', name: 'Argentina',     flag: flag('argentina'),     color: '#74ACDF', group: 'J' },
  ALG: { code: 'ALG', name: 'Argélia',       flag: flag('algeria'),       color: '#006233', group: 'J' },
  AUT: { code: 'AUT', name: 'Áustria',       flag: flag('austria'),       color: '#ED2939', group: 'J' },
  JOR: { code: 'JOR', name: 'Jordânia',      flag: flag('jordan'),        color: '#007A3D', group: 'J' },

  // ── Grupo K ──────────────────────────────────────────────────────────────────
  POR: { code: 'POR', name: 'Portugal',      flag: flag('portugal'),      color: '#006600', group: 'K' },
  COD: { code: 'COD', name: 'Congo (DR)',     flag: flag('dr-congo'),      color: '#007FFF', group: 'K' },
  UZB: { code: 'UZB', name: 'Uzbequistão',   flag: flag('uzbekistan'),    color: '#1EB53A', group: 'K' },
  COL: { code: 'COL', name: 'Colômbia',      flag: flag('colombia'),      color: '#FCD116', group: 'K' },

  // ── Grupo L ──────────────────────────────────────────────────────────────────
  ENG: { code: 'ENG', name: 'Inglaterra',    flag: flag('england'),       color: '#CF091D', group: 'L' },
  CRO: { code: 'CRO', name: 'Croácia',       flag: flag('croatia'),       color: '#FF0000', group: 'L' },
  GHA: { code: 'GHA', name: 'Gana',          flag: flag('ghana'),         color: '#006B3F', group: 'L' },
  PAN: { code: 'PAN', name: 'Panamá',        flag: flag('panama'),        color: '#DA121A', group: 'L' },
}
