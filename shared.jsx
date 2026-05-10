/* global React */
const { useState, useEffect, useRef, useMemo, createContext, useContext } = React;

/* =========================================================
   DATA — teams, players, matches, ranking, etc.
   ========================================================= */

const TEAMS = {
  BRA: { code:"BRA", name:"Brasil", flag:"assets/flags/brazil.png", color:"#FFCB05", group:"E" },
  ARG: { code:"ARG", name:"Argentina", flag:"assets/flags/argentina.png", color:"#75AADB", group:"D" },
  FRA: { code:"FRA", name:"França", flag:"assets/flags/france.png", color:"#1D3557", group:"H" },
  GER: { code:"GER", name:"Alemanha", flag:"assets/flags/germany.png", color:"#222222", group:"A" },
  ESP: { code:"ESP", name:"Espanha", flag:"assets/flags/spain.png", color:"#C60B1E", group:"C" },
  POR: { code:"POR", name:"Portugal", flag:"assets/flags/portugal.png", color:"#006233", group:"F" },
  ENG: { code:"ENG", name:"Inglaterra", flag:"assets/flags/england.png", color:"#FFFFFF", group:"K" },
  NED: { code:"NED", name:"Holanda", flag:"assets/flags/netherlands.png", color:"#FF6900", group:"B" },
  BEL: { code:"BEL", name:"Bélgica", flag:"assets/flags/belgium.png", color:"#EF3340", group:"G" },
  CRO: { code:"CRO", name:"Croácia", flag:"assets/flags/croatia.png", color:"#FF0000", group:"J" },
  URU: { code:"URU", name:"Uruguai", flag:"assets/flags/uruguay.png", color:"#5CBFEB", group:"I" },
  MEX: { code:"MEX", name:"México", flag:"assets/flags/mexico.png", color:"#006847", group:"A" },
  MAR: { code:"MAR", name:"Marrocos", flag:"assets/flags/morocco.png", color:"#C1272D", group:"L" },
  JPN: { code:"JPN", name:"Japão", flag:"assets/flags/japan.png", color:"#BC002D", group:"E" },
  KOR: { code:"KOR", name:"Coreia", flag:"assets/flags/south-korea.png", color:"#0047A0", group:"F" },
  SEN: { code:"SEN", name:"Senegal", flag:"assets/flags/senegal.png", color:"#00853F", group:"H" },
  COL: { code:"COL", name:"Colômbia", flag:"assets/flags/colombia.png", color:"#FCD116", group:"I" },
  USA: { code:"USA", name:"EUA", flag:"assets/flags/united-states.png", color:"#3C3B6E", group:"D" },
  CAN: { code:"CAN", name:"Canadá", flag:"assets/flags/canada.png", color:"#D52B1E", group:"B" },
  SUI: { code:"SUI", name:"Suíça", flag:"assets/flags/switzerland.png", color:"#D52B1E", group:"C" },
  ECU: { code:"ECU", name:"Equador", flag:"assets/flags/ecuador.png", color:"#FFCE00", group:"J" },
  KSA: { code:"KSA", name:"Arábia Saudita", flag:"assets/flags/saudi-arabia.png", color:"#006C35", group:"K" },
  AUS: { code:"AUS", name:"Austrália", flag:"assets/flags/australia.png", color:"#012169", group:"L" },
  NOR: { code:"NOR", name:"Noruega", flag:"assets/flags/norway.png", color:"#BA0C2F", group:"G" },
};

const T = TEAMS;

/* Ranking — colleagues at Suprema Gaming */
const RANKING = [
  { rank: 1, name:"Lucas Mendes", dept:"Eng. Plataforma",  pts:1284, mov:"+2", correct: 18, exact:5, streak:4, init:"LM", color:"#00A651" },
  { rank: 2, name:"Carla Tavares", dept:"Marketing",       pts:1271, mov:"-1", correct: 17, exact:6, streak:3, init:"CT", color:"#FFCB05" },
  { rank: 3, name:"Renan Albuq.",  dept:"CEO",             pts:1248, mov:"+5", correct: 17, exact:4, streak:2, init:"RA", color:"#E63946" },
  { rank: 4, name:"Bia Yamashita",  dept:"Produto",        pts:1230, mov:"0",  correct: 16, exact:5, streak:1, init:"BY", color:"#1D3557" },
  { rank: 5, name:"Matheus 'Mathzi' Pires", dept:"Data",   pts:1218, mov:"-2", correct: 16, exact:4, streak:2, init:"MP", color:"#C9A856" },
  { rank: 6, name:"Você (Felipe Souza)", dept:"Design",    pts:1204, mov:"+3", correct: 15, exact:5, streak:5, init:"FS", color:"#FFCB05", isYou:true },
  { rank: 7, name:"Aline Ribeiro",  dept:"Comercial",      pts:1192, mov:"-1", correct: 15, exact:4, streak:0, init:"AR", color:"#00A651" },
  { rank: 8, name:"Diogo Saito",    dept:"Eng. Mobile",    pts:1188, mov:"+4", correct: 15, exact:3, streak:1, init:"DS", color:"#E63946" },
  { rank: 9, name:"Patricia Lemos", dept:"RH",             pts:1170, mov:"0",  correct: 14, exact:4, streak:2, init:"PL", color:"#1D3557" },
  { rank:10, name:"Gabriel Rocha",  dept:"Eng. Backend",   pts:1162, mov:"-3", correct: 14, exact:3, streak:0, init:"GR", color:"#C9A856" },
  { rank:11, name:"Júlia Antunes",  dept:"Operações",      pts:1140, mov:"+1", correct: 14, exact:2, streak:1, init:"JA", color:"#00A651" },
  { rank:12, name:"Thiago Bonfá",   dept:"Financeiro",     pts:1118, mov:"+6", correct: 13, exact:3, streak:3, init:"TB", color:"#FFCB05" },
];

/* Upcoming matches — round of 16 */
const UPCOMING = [
  { id:"m1", date:"SEX 03 JUL", time:"16:00", venue:"Estádio Azteca · Cidade do México",
    home:T.BRA, away:T.MAR, stage:"OITAVAS · 1", liveNote:null,
    yourPick:{ home:2, away:1 }, predicted:412, total:847 },
  { id:"m2", date:"SEX 03 JUL", time:"20:00", venue:"MetLife Stadium · Nova York",
    home:T.ARG, away:T.AUS, stage:"OITAVAS · 2", liveNote:null,
    yourPick:null, predicted:0, total:847 },
  { id:"m3", date:"SAB 04 JUL", time:"13:00", venue:"BMO Field · Toronto",
    home:T.FRA, away:T.SEN, stage:"OITAVAS · 3", liveNote:null,
    yourPick:{ home:1, away:0 }, predicted:381, total:847 },
  { id:"m4", date:"SAB 04 JUL", time:"17:00", venue:"SoFi Stadium · Los Angeles",
    home:T.ESP, away:T.JPN, stage:"OITAVAS · 4", liveNote:null,
    yourPick:null, predicted:0, total:847 },
];

/* Live match (in progress) */
const LIVE = {
  home:T.POR, away:T.URU,
  homeScore:1, awayScore:1, minute:"68'",
  yourPick:{ home:1, away:0 }, status:"PRORROGAÇÃO IMINENTE",
};

/* Past results */
const PAST = [
  { home:T.GER, away:T.MEX, hs:3, as:1, your:{h:2,a:1}, points:5, when:"ONTEM" },
  { home:T.NED, away:T.CAN, hs:2, as:0, your:{h:2,a:0}, points:10, when:"ONTEM" },
  { home:T.ENG, away:T.KSA, hs:2, as:1, your:{h:1,a:0}, points:0, when:"03 DIAS" },
];

/* Resenha — chat messages (start empty; populated by real users) */
const CHAT = [];

/* Bracket — round of 16 → final, with predictions/results */
const BRACKET = {
  r16: [
    { home:T.BRA, away:T.MAR, hs:2, as:1, status:"DONE", winner:"BRA" },
    { home:T.ARG, away:T.AUS, hs:3, as:0, status:"DONE", winner:"ARG" },
    { home:T.FRA, away:T.SEN, hs:1, as:0, status:"DONE", winner:"FRA" },
    { home:T.ESP, away:T.JPN, hs:2, as:2, status:"PENS", winner:"ESP" },
    { home:T.POR, away:T.URU, hs:1, as:1, status:"LIVE", minute:"68'" },
    { home:T.GER, away:T.MEX, hs:3, as:1, status:"DONE", winner:"GER" },
    { home:T.NED, away:T.CAN, hs:2, as:0, status:"DONE", winner:"NED" },
    { home:T.ENG, away:T.KSA, hs:2, as:1, status:"DONE", winner:"ENG" },
  ],
};

/* Profile */
const ME = { first:"Felipe", last:"Souza", dept:"Design", since:"2023", init:"FS" };

/* =========================================================
   FLAG / CREST
   ========================================================= */
function Flag({ team, size = 36, ring=false }){
  // Crests are full artwork — never crop them. Use rounded square with contain padding.
  const pad = Math.max(2, Math.round(size * 0.08));
  return (
    <div style={{
      width: size, height: size,
      borderRadius: Math.max(4, Math.round(size * 0.18)),
      background: '#FFFCF5',
      border: ring ? '2px solid var(--ink)' : '1px solid rgba(13,13,13,.18)',
      display:'inline-flex', alignItems:'center', justifyContent:'center',
      flexShrink: 0, padding: pad, boxSizing:'border-box'
    }}>
      <img src={team.flag} alt={team.code} style={{ width:'100%', height:'100%', objectFit:'contain' }}/>
    </div>
  );
}

/* Logo (the hand-painted artwork) */
function Logo({ height=42, color }) {
  return (
    <img src="assets/logo-bolao.png" alt="Bolão da Suprema"
      style={{ height, width:'auto', objectFit:'contain',
        filter: color === 'ink' ? 'brightness(0) saturate(100%) invert(0)' : color === 'paper' ? 'brightness(0) invert(1)' : 'none'
      }}/>
  );
}

/* Tournament wordmark — original (NOT FIFA) */
function TourneyMark({ size=10 }){
  return (
    <span className="mono" style={{ fontSize: size, letterSpacing:'.22em', fontWeight: 700, textTransform:'uppercase' }}>
      ★ MUNDIAL · 2 0 2 6 · CO/MX/US ★
    </span>
  );
}

/* Avatar */
function Avatar({ p, size=36 }){
  return (
    <span className="avatar" style={{
      width:size, height:size, fontSize: size * .42,
      background: p.color, color: 'var(--ink)'
    }}>{p.init}</span>
  );
}

/* Stamp (resenha-style angular badge) */
function Stamp({ color="var(--ink)", children, rot=-2 }){
  return (
    <span className="stamp" style={{ color, transform: `rotate(${rot}deg)` }}>{children}</span>
  );
}

/* Marquee */
function Marquee({ items, speed=40, color="var(--ink)", bg="var(--yellow)" }){
  const txt = items.join(" · ★ · ");
  return (
    <div className="marquee" style={{ background: bg, color, borderTop:'1.5px solid var(--ink)', borderBottom:'1.5px solid var(--ink)' }}>
      <div className="marquee-track" style={{ animationDuration: `${speed}s` }}>
        <span className="display" style={{ fontSize: 22, padding: '8px 24px' }}>{txt} · ★ · {txt} · ★ · </span>
        <span className="display" style={{ fontSize: 22, padding: '8px 24px' }}>{txt} · ★ · {txt} · ★ · </span>
      </div>
    </div>
  );
}

/* Section divider */
function Rule({ thick=false }){
  return <div style={{ borderTop: `${thick?3:1}px solid var(--ink)` }} />;
}

/* Eyebrow heading */
function Eyebrow({ children, num, sub }){
  return (
    <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', gap:8 }}>
      <div style={{ display:'flex', alignItems:'baseline', gap:10 }}>
        {num != null && <span className="mono" style={{ fontSize:11, opacity:.55 }}>{num}</span>}
        <span className="eyebrow">{children}</span>
      </div>
      {sub && <span className="mono" style={{ fontSize:10, opacity:.55, textTransform:'uppercase', letterSpacing:'.14em' }}>{sub}</span>}
    </div>
  );
}

/* Mobile bottom nav */
function MobileNav({ current, onNav }){
  const items = [
    { id:'home', label:'Casa', icon:'⌂' },
    { id:'bracket', label:'Chave', icon:'◫' },
    { id:'prediction', label:'Palpite', icon:'◉' },
    { id:'ranking', label:'Ranking', icon:'☰' },
    { id:'resenha', label:'Resenha', icon:'❝' },
  ];
  return (
    <div style={{
      display:'grid', gridTemplateColumns:'repeat(5,1fr)',
      borderTop:'1.5px solid var(--ink)',
      background:'var(--paper-white)',
      paddingBottom:'env(safe-area-inset-bottom)',
    }}>
      {items.map(it => (
        <button key={it.id} onClick={()=>onNav(it.id)}
          style={{
            display:'flex', flexDirection:'column', alignItems:'center', gap:3,
            padding:'10px 0 12px',
            background: current === it.id ? 'var(--yellow)' : 'transparent',
            color: 'var(--ink)',
            borderRight: '1px solid var(--hairline)',
          }}>
          <span style={{ fontFamily:'var(--display)', fontSize:18, lineHeight:1 }}>{it.icon}</span>
          <span className="mono" style={{ fontSize:9, letterSpacing:'.12em', textTransform:'uppercase', fontWeight:600 }}>{it.label}</span>
        </button>
      ))}
    </div>
  );
}

/* Desktop top nav */
function DesktopNav({ current, onNav }){
  const items = [
    { id:'home', label:'Capa' },
    { id:'bracket', label:'Chave' },
    { id:'prediction', label:'Palpitar' },
    { id:'ranking', label:'Ranking' },
    { id:'resenha', label:'Resenha' },
    { id:'profile', label:'Perfil' },
  ];
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:0,
      borderBottom:'1.5px solid var(--ink)',
      background:'var(--paper-white)',
      padding:'0 32px',
      height: 64
    }}>
      <Logo height={36} />
      <div style={{ flex:1 }}/>
      <div style={{ display:'flex', alignItems:'center', gap:0, height:'100%' }}>
        {items.map(it => (
          <button key={it.id} onClick={()=>onNav(it.id)}
            style={{
              padding:'0 18px', height:'100%',
              fontFamily:'var(--display)', fontSize:18,
              letterSpacing:'.04em', textTransform:'uppercase',
              borderBottom: current === it.id ? '4px solid var(--yellow)' : '4px solid transparent',
              color:'var(--ink)',
            }}>{it.label}</button>
        ))}
      </div>
      <div style={{ flex:1 }}/>
      <div style={{ display:'flex', alignItems:'center', gap:14 }}>
        <span className="mono" style={{ fontSize:11, letterSpacing:'.14em', opacity:.6 }}>03 JUL · 2026</span>
        <span className="badge" style={{ background:'var(--ink)', color:'var(--paper-white)' }}>
          <span className="dot-live"/> AO VIVO · POR x URU
        </span>
        <span className="avatar" style={{ width:36, height:36, background:'var(--yellow)' }}>FS</span>
      </div>
    </div>
  );
}

/* Make stuff global */
Object.assign(window, {
  TEAMS, T, RANKING, UPCOMING, LIVE, PAST, CHAT, BRACKET, ME,
  Flag, Logo, TourneyMark, Avatar, Stamp, Marquee, Rule, Eyebrow,
  MobileNav, DesktopNav,
});
