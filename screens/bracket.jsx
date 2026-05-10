/* global React, Flag, T, BRACKET, Stamp, Eyebrow, Marquee, TourneyMark, MobileNav, DesktopNav */

/* =========================================================
   BRACKET — the heart of the app
   horizontal cinematic tournament tree
   ========================================================= */

const ROUNDS = [
  { id:"r16",  label:"OITAVAS", count:8 },
  { id:"qf",   label:"QUARTAS", count:4 },
  { id:"sf",   label:"SEMI",    count:2 },
  { id:"f",    label:"FINAL",   count:1 },
];

const BR16 = BRACKET ? BRACKET.r16 : [];
function winnerOf(m){ return m && m.winner ? T[m.winner] : null; }

const BR_QF = [
  { home:winnerOf(BR16[0]), away:winnerOf(BR16[1]), hs:null, as:null, status:"NEXT", date:"09 JUL · 16:00", venue:"NRG · HOUSTON" },
  { home:winnerOf(BR16[2]), away:winnerOf(BR16[3]), hs:null, as:null, status:"NEXT", date:"09 JUL · 20:00", venue:"AT&T · DALLAS" },
  { home:null, away:winnerOf(BR16[5]), hs:null, as:null, status:"WAIT", date:"10 JUL · 16:00", venue:"AZTECA · CDMX" },
  { home:winnerOf(BR16[6]), away:winnerOf(BR16[7]), hs:null, as:null, status:"NEXT", date:"10 JUL · 20:00", venue:"METLIFE · NY" },
];
const BR_SF = [
  { home:null, away:null, status:"WAIT", date:"15 JUL", venue:"DALLAS" },
  { home:null, away:null, status:"WAIT", date:"16 JUL", venue:"NY" },
];
const BR_F  = { home:null, away:null, status:"WAIT", date:"19 JUL · 16:00", venue:"METLIFE · NEW JERSEY" };


function BracketDesktop({ onNav }){
  const [focus, setFocus] = React.useState(null);

  return (
    <div style={{ background:'var(--paper)', minHeight:'100%', display:'flex', flexDirection:'column' }} className="paper-grain">
      <DesktopNav current="bracket" onNav={onNav}/>

      {/* mast */}
      <div style={{ padding:'18px 32px', borderBottom:'1.5px solid var(--ink)' }}>
        <div style={{ display:'flex', alignItems:'baseline', gap:24, justifyContent:'space-between' }}>
          <div>
            <span className="eyebrow" style={{ opacity:.6 }}>SEÇÃO 02 · A CHAVE</span>
            <h1 className="display" style={{ fontSize:'clamp(64px, 7vw, 124px)', lineHeight:.86, margin:'4px 0 0' }}>
              MATA-MATA <span className="serif-it" style={{ color:'var(--green-deep)' }}>'26.</span>
            </h1>
          </div>
          <div style={{ textAlign:'right' }}>
            <TourneyMark size={11}/>
            <div className="mono" style={{ fontSize:11, letterSpacing:'.18em', opacity:.6, marginTop:6 }}>03 → 19 JUL · 16 JOGOS</div>
            <div className="serif-it" style={{ fontSize:22, color:'var(--green-deep)', marginTop:4 }}>de oitavas até a taça.</div>
          </div>
        </div>

        {/* round tabs */}
        <div style={{ display:'flex', gap:8, marginTop:18, alignItems:'center' }}>
          {ROUNDS.map((r,i)=>(
            <div key={r.id} style={{ display:'flex', alignItems:'center', gap:8 }}>
              <div style={{
                padding:'8px 14px', borderRadius:999,
                border:'1.5px solid var(--ink)',
                background: i === 0 ? 'var(--yellow)' : 'var(--paper-white)',
                fontFamily:'var(--display)', fontSize:18, letterSpacing:'.04em'
              }}>
                {r.label} · {r.count}
              </div>
              {i < ROUNDS.length-1 && <span className="mono" style={{ fontSize:11, opacity:.4 }}>━━</span>}
            </div>
          ))}
          <div style={{ flex:1 }}/>
          <div className="mono" style={{ fontSize:11, letterSpacing:'.18em', opacity:.6, display:'flex', gap:14 }}>
            <span>● AO VIVO</span><span>✓ ENCERRADO</span><span>○ A SAIR</span>
          </div>
        </div>
      </div>

      {/* The tree */}
      <div className="bracket-scroll" style={{ flex:1, overflow:'auto', padding:'24px 32px', background:'var(--paper-deep)' }}>
        <div style={{ display:'grid', gridTemplateColumns:'1.1fr 1fr 1fr 1.1fr', gap:24, minWidth: 1100 }}>
          {/* COL 1 — OITAVAS */}
          <BColumn label="OITAVAS · 03–05 JUL">
            {BR16.map((m,i) => (
              <BMatch key={i} m={m} onClick={()=>setFocus({col:0, idx:i, m})} />
            ))}
          </BColumn>

          {/* COL 2 — QUARTAS */}
          <BColumn label="QUARTAS · 09–10 JUL" pad={42}>
            {BR_QF.map((m, i) => (
              <BMatch key={i} m={m} onClick={()=>setFocus({col:1, idx:i, m})}/>
            ))}
          </BColumn>

          {/* COL 3 — SEMIS */}
          <BColumn label="SEMIFINAL · 14–15 JUL" pad={130}>
            {BR_SF.map((m,i)=>(
              <BMatch key={i} m={m} onClick={()=>setFocus({col:2, idx:i, m})}/>
            ))}
          </BColumn>

          {/* COL 4 — FINAL + FOTO HERO */}
          <div style={{ paddingTop: 280, display:'flex', flexDirection:'column', gap:18 }}>
            <BFinal m={BR_F} onClick={()=>setFocus({col:3, idx:0, m: BR_F})}/>
            <div style={{
              flex:1, position:'relative', overflow:'hidden', borderRadius:16, border:'1.5px solid var(--ink)',
              background:'var(--ink)', minHeight: 220
            }}>
              <img src="assets/hero-jogadores.webp" alt="" style={{
                position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', objectPosition:'center 30%'
              }}/>
              <div style={{ position:'absolute', inset:0, background:'linear-gradient(180deg, transparent 30%, rgba(13,13,13,.85))' }}/>
              <div style={{ position:'absolute', inset:0, padding:18, display:'flex', flexDirection:'column', color:'var(--paper-white)' }}>
                <Stamp color="var(--paper-white)" rot={-2}>e o seu palpite?</Stamp>
                <div style={{ flex:1 }}/>
                <div className="serif-it" style={{ fontSize:18, opacity:.92 }}>seu palpite pra taça:</div>
                <div className="display" style={{ fontSize:46, lineHeight:.95 }}>ARGENTINA <span className="serif-it" style={{ fontSize:22, color:'var(--yellow)' }}>(coragem.)</span></div>
                <div className="mono" style={{ fontSize:11, letterSpacing:'.18em', marginTop:6, opacity:.85 }}>+50 PTS BÔNUS SE ACERTAR</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Marquee items={["A CHAVE TÁ ABERTA","SEU PALPITE NA SEMI: BRA","FAVORITO DA RESENHA: ARG","PRÓXIMO JOGO: 16:00 BRA × MAR"]} bg="var(--ink)" color="var(--paper-white)"/>
      {focus && <FocusOverlay focus={focus} onClose={()=>setFocus(null)}/>}
    </div>
  );
}

function BColumn({ label, children, pad=0 }){
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:10, paddingTop: pad }}>
      <div className="mono" style={{ fontSize:11, letterSpacing:'.18em', color:'var(--ink-3)' }}>{label}</div>
      {children}
    </div>
  );
}

function BMatch({ m, onClick }){
  const isLive = m.status === 'LIVE';
  const isDone = m.status === 'DONE' || m.status === 'PENS';
  const isWait = m.status === 'WAIT';
  const isNext = m.status === 'NEXT';
  return (
    <button onClick={onClick} style={{
      textAlign:'left', display:'block',
      background:'var(--paper-white)', border:'1.5px solid var(--ink)', borderRadius:10,
      padding:'10px 12px',
      boxShadow: isLive ? '0 0 0 3px var(--red), 6px 6px 0 var(--ink)' : '4px 4px 0 var(--ink)',
      transition:'transform .12s ease',
      width:'100%'
    }} onMouseEnter={e=>e.currentTarget.style.transform='translate(-1px,-1px)'} onMouseLeave={e=>e.currentTarget.style.transform='none'}>
      <div className="mono" style={{ fontSize:9, letterSpacing:'.14em', opacity:.6, marginBottom:6, display:'flex', justifyContent:'space-between' }}>
        <span>{m.date || (isLive ? `AO VIVO · ${m.minute || "—"}` : '')}</span>
        {isLive && <span style={{ color:'var(--red)' }}><span className="dot-live" style={{ marginRight:4 }}/> LIVE</span>}
        {isDone && <span style={{ color:'var(--green-deep)' }}>✓ {m.status === 'PENS' ? 'PEN' : 'FIM'}</span>}
        {isWait && <span style={{ opacity:.4 }}>○ TBD</span>}
        {isNext && <span>○ A SAIR</span>}
      </div>
      <BRow team={m.home} score={m.hs} winner={m.winner === (m.home && m.home.code)} />
      <BRow team={m.away} score={m.as} winner={m.winner === (m.away && m.away.code)} />
    </button>
  );
}
function BRow({ team, score, winner }){
  if(!team) return (
    <div style={{ display:'flex', alignItems:'center', gap:10, padding:'4px 0', opacity:.6 }}>
      <div style={{ width:24, height:24, border:'1px dashed var(--ink-3)', borderRadius:'50%' }}/>
      <span className="serif-it" style={{ fontSize:14, color:'var(--ink-3)' }}>aguardando…</span>
    </div>
  );
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, padding:'4px 0' }}>
      <Flag team={team} size={24}/>
      <span style={{ flex:1, fontWeight: winner? 700 : 500, fontSize: 13 }}>{team.name}</span>
      <span className="display" style={{ fontSize:18, color: winner ? 'var(--green-deep)' : 'var(--ink-2)' }}>
        {score == null ? '—' : score}
      </span>
    </div>
  );
}
function BFinal({ m, onClick }){
  return (
    <button onClick={onClick} style={{
      width:'100%', display:'block', textAlign:'left',
      background:'var(--ink)', color:'var(--paper-white)', border:'1.5px solid var(--ink)', borderRadius:14,
      padding:'18px 18px', position:'relative', overflow:'hidden',
      boxShadow:'8px 8px 0 var(--yellow)',
    }}>
      <div className="eyebrow" style={{ color:'var(--yellow)' }}>FINAL · {m.date}</div>
      <div className="display" style={{ fontSize:42, lineHeight:.9, marginTop:6 }}>A TAÇA<br/>VAI PRA…</div>
      <div className="serif-it" style={{ fontSize:18, marginTop:6, opacity:.85 }}>{m.venue}</div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:18, padding:'18px 0 4px' }}>
        <div style={{ width:48, height:48, borderRadius:'50%', border:'1.5px dashed var(--paper-white)' }}/>
        <span className="display" style={{ fontSize:34, opacity:.5 }}>VS</span>
        <div style={{ width:48, height:48, borderRadius:'50%', border:'1.5px dashed var(--paper-white)' }}/>
      </div>
    </button>
  );
}

function FocusOverlay({ focus, onClose }){
  const m = focus.m;
  return (
    <div onClick={onClose} style={{
      position:'fixed', inset:0, background:'rgba(13,13,13,.72)',
      display:'flex', alignItems:'center', justifyContent:'center', padding:32, zIndex:100
    }}>
      <div onClick={e=>e.stopPropagation()} style={{
        background:'var(--paper)', border:'1.5px solid var(--ink)', borderRadius:14,
        width:'min(720px, 100%)', overflow:'hidden'
      }}>
        <div style={{ padding:'16px 20px', borderBottom:'1.5px solid var(--ink)', display:'flex', justifyContent:'space-between' }}>
          <span className="mono" style={{ fontSize:11, letterSpacing:'.18em' }}>JOGO · {focus.col === 0 ? 'OITAVAS' : focus.col === 1 ? 'QUARTAS' : focus.col === 2 ? 'SEMI' : 'FINAL'} Nº {focus.idx+1}</span>
          <button onClick={onClose} className="mono" style={{ fontSize:11, letterSpacing:'.14em' }}>FECHAR ✕</button>
        </div>
        <div style={{ padding:'24px' }}>
          <div className="display" style={{ fontSize:54, lineHeight:.9 }}>
            {m.home? m.home.name : '—'} <span className="serif-it" style={{ fontSize:30 }}>vs</span> {m.away? m.away.name : '—'}
          </div>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:24, padding:'24px 0' }}>
            {m.home && <Flag team={m.home} size={96} ring/>}
            <div className="display" style={{ fontSize:120, lineHeight:.85 }}>
              {m.hs == null ? '—' : m.hs}<span style={{ opacity:.4 }}>:</span>{m.as == null ? '—' : m.as}
            </div>
            {m.away && <Flag team={m.away} size={96} ring/>}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
            <BBox label="SEU PALPITE" v="2 — 1" accent="var(--yellow)"/>
            <BBox label="MAIS POPULAR NO POOL" v="VITÓRIA HOME · 64%"/>
            <BBox label="ACERTOS EXATOS" v="22 / 87"/>
          </div>
        </div>
      </div>
    </div>
  );
}
function BBox({ label, v, accent }){
  return (
    <div style={{ background: accent || 'var(--paper-white)', border:'1.5px solid var(--ink)', borderRadius:8, padding:'10px 12px' }}>
      <div className="mono" style={{ fontSize:9, letterSpacing:'.14em', opacity:.6 }}>{label}</div>
      <div className="display" style={{ fontSize:22 }}>{v}</div>
    </div>
  );
}


/* =========================================================
   BRACKET — Mobile (vertical, swipeable rounds)
   ========================================================= */
function BracketMobile({ onNav }){
  const [round, setRound] = React.useState(0);
  const data = [BR16, BR_QF, BR_SF, [BR_F]];

  return (
    <div style={{ height:'100%', display:'flex', flexDirection:'column', background:'var(--paper)' }}>
      <div style={{ flexShrink:0 }} className="paper-grain">
        <div style={{ padding:'14px 18px 8px' }}>
          <div className="eyebrow" style={{ opacity:.6 }}>SEÇÃO 02</div>
          <h1 className="display" style={{ fontSize:46, lineHeight:.85, margin:'4px 0 0' }}>
            A CHAVE.<br/><span className="serif-it" style={{ color:'var(--green-deep)', fontSize:30 }}>até a taça.</span>
          </h1>
        </div>
        <div style={{ display:'flex', gap:6, padding:'8px 18px 12px', overflow:'auto' }} className="no-scrollbar">
          {ROUNDS.map((r,i)=>(
            <button key={r.id} onClick={()=>setRound(i)} style={{
              padding:'8px 14px', borderRadius:999, flexShrink:0,
              border:'1.5px solid var(--ink)',
              background: round === i ? 'var(--yellow)' : 'var(--paper-white)',
              fontFamily:'var(--display)', fontSize:14, letterSpacing:'.04em'
            }}>{r.label}</button>
          ))}
        </div>
      </div>

      <div style={{ flex:1, overflow:'auto', padding:'0 18px 14px' }} className="paper-grain">
        {round === 3 ? (
          <BFinal m={BR_F} onClick={()=>{}}/>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {data[round].map((m,i)=> <BMatch key={i} m={m} onClick={()=>{}}/> )}
          </div>
        )}
        <div style={{ height:14 }}/>
        <div style={{ background:'var(--ink)', color:'var(--paper-white)', borderRadius:14, padding:14, position:'relative', overflow:'hidden' }}>
          <img src="assets/hero-jogadores.webp" alt="" style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', opacity:.35 }}/>
          <div style={{ position:'relative' }}>
            <Stamp color="var(--paper-white)" rot={-3}>seu palpite</Stamp>
            <div className="display" style={{ fontSize:32, marginTop:8 }}>ARGENTINA<br/>LEVA A TAÇA.</div>
            <div className="serif-it" style={{ fontSize:14, opacity:.85, marginTop:6 }}>+50 pts de bônus se acertar.</div>
          </div>
        </div>
      </div>

      <MobileNav current="bracket" onNav={onNav}/>
    </div>
  );
}

Object.assign(window, { BracketMobile, BracketDesktop });
