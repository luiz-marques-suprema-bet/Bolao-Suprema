/* global React, Flag, Stamp, T, UPCOMING, LIVE, Eyebrow, MobileNav, DesktopNav */

/* locked match — POR vs URU is live, so add it as a locked entry */
const LOCKED_MATCH = {
  id:'m0live', date:'HOJE · AO VIVO', time:LIVE.minute, venue:'Estádio Azteca · Cidade do México',
  home:LIVE.home, away:LIVE.away, stage:'OITAVAS · 5',
  yourPick:LIVE.yourPick, predicted:81, total:847, locked:true
};

const ALL_MATCHES = [LOCKED_MATCH, ...UPCOMING];

/* =========================================================
   PREDICTION FLOW — Mobile
   ========================================================= */
function PredictionMobile({ onNav, onDoneFlow }){
  const [matchIdx, setMatchIdx] = React.useState(1); // start at first unlocked
  const [picks, setPicks] = React.useState({});
  const [saved, setSaved] = React.useState({});

  const m = ALL_MATCHES[matchIdx];
  const isLocked = !!m.locked;
  const pick = picks[m.id] || m.yourPick || { home: null, away: null };

  const setScore = (side, val) => {
    if (isLocked) return;
    setPicks(p => ({ ...p, [m.id]: { ...(p[m.id] || pick), [side]: val } }));
  };

  const isComplete = pick.home != null && pick.away != null;
  const isSaved = saved[m.id];

  const handleConfirm = () => {
    setSaved(s => ({ ...s, [m.id]: true }));
    if (matchIdx < ALL_MATCHES.length - 1) setMatchIdx(i => i + 1);
    else if (onDoneFlow) onDoneFlow();
    else onNav('home');
  };

  const handleDraft = () => {
    setSaved(s => ({ ...s, [m.id]: false }));
    setMatchIdx(i => Math.min(i + 1, ALL_MATCHES.length - 1));
  };

  return (
    <div style={{ height:'100%', display:'flex', flexDirection:'column', background:'var(--paper)' }}>
      {/* head */}
      <div style={{ padding:'12px 18px', borderBottom:'1.5px solid var(--ink)', display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0, background:'var(--paper)' }}>
        <button onClick={()=> matchIdx === 0 ? onNav('home') : setMatchIdx(i => i-1)} className="mono" style={{ fontSize:11, letterSpacing:'.14em' }}>← VOLTAR</button>
        <span className="mono" style={{ fontSize:11, letterSpacing:'.14em', opacity:.6 }}>{m.stage}</span>
        <span className="mono" style={{ fontSize:11, letterSpacing:'.14em' }}>{matchIdx+1}/{ALL_MATCHES.length}</span>
      </div>

      {/* match tabs strip */}
      <div style={{ display:'flex', overflow:'auto', borderBottom:'1px solid var(--hairline)', flexShrink:0 }} className="no-scrollbar">
        {ALL_MATCHES.map((mm, i) => {
          const p = picks[mm.id] || mm.yourPick;
          const done = saved[mm.id] || (mm.yourPick && !picks[mm.id]);
          return (
            <button key={mm.id} onClick={()=>!mm.locked && setMatchIdx(i)} style={{
              flexShrink:0, padding:'8px 14px', display:'flex', flexDirection:'column', alignItems:'center', gap:2,
              borderBottom: i === matchIdx ? '3px solid var(--ink)' : '3px solid transparent',
              background: i === matchIdx ? 'var(--yellow)' : 'transparent',
              opacity: mm.locked ? .55 : 1
            }}>
              <span className="mono" style={{ fontSize:9, letterSpacing:'.12em' }}>
                {mm.locked ? '🔒' : done ? '✓' : '○'} {mm.home.code}×{mm.away.code}
              </span>
              {p && <span className="mono" style={{ fontSize:9, color:'var(--green-deep)' }}>{p.home}–{p.away}</span>}
            </button>
          );
        })}
      </div>

      {isLocked ? (
        /* locked state */
        <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:24, gap:14, textAlign:'center' }}>
          <div style={{
            width:72, height:72, borderRadius:'50%', background:'var(--ink)',
            display:'flex', alignItems:'center', justifyContent:'center', fontSize:32
          }}>🔒</div>
          <div className="display" style={{ fontSize:32, lineHeight:.9 }}>JOGO<br/>EM ANDAMENTO</div>
          <div className="mono" style={{ fontSize:11, letterSpacing:'.14em', opacity:.6 }}>PALPITES ENCERRADOS · {m.stage}</div>

          {/* live scoreboard */}
          <div style={{
            width:'100%', padding:'18px', background:'var(--ink)', borderRadius:14,
            color:'var(--paper-white)', position:'relative', overflow:'hidden'
          }}>
            <div className="pitch-turf" style={{ position:'absolute', inset:0, opacity:.4 }}/>
            <div style={{ position:'relative', display:'flex', alignItems:'center', justifyContent:'center', gap:18 }}>
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
                <Flag team={m.home} size={48} ring/>
                <span className="mono" style={{ fontSize:11, letterSpacing:'.14em' }}>{m.home.code}</span>
              </div>
              <div>
                <div className="display" style={{ fontSize:64, lineHeight:.9 }}>
                  {LIVE.homeScore}<span style={{ opacity:.4 }}>:</span>{LIVE.awayScore}
                </div>
                <div className="mono" style={{ fontSize:10, letterSpacing:'.16em', opacity:.7, textAlign:'center' }}>{LIVE.minute} · AO VIVO</div>
              </div>
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
                <Flag team={m.away} size={48} ring/>
                <span className="mono" style={{ fontSize:11, letterSpacing:'.14em' }}>{m.away.code}</span>
              </div>
            </div>
          </div>

          {m.yourPick && (
            <div style={{ width:'100%', padding:'14px', background:'var(--yellow)', border:'1.5px solid var(--ink)', borderRadius:12 }}>
              <div className="mono" style={{ fontSize:10, letterSpacing:'.14em', opacity:.7 }}>SEU PALPITE</div>
              <div className="display" style={{ fontSize:36, lineHeight:.9 }}>{m.yourPick.home}–{m.yourPick.away}</div>
              <div className="mono" style={{ fontSize:10, letterSpacing:'.14em', marginTop:4 }}>
                {LIVE.homeScore === m.yourPick.home && LIVE.awayScore === m.yourPick.away
                  ? '🎯 PLACAR EXATO AGORA · +10 PTS SE ACABAR ASSIM'
                  : LIVE.homeScore > LIVE.awayScore && m.yourPick.home > m.yourPick.away
                  ? '✓ VENCEDOR CERTO · +3 PTS SE ACABAR ASSIM'
                  : '⏳ ACOMPANHA...'}
              </div>
            </div>
          )}

          <button onClick={()=>setMatchIdx(1)} className="btn-yellow">
            IR PARA OS PRÓXIMOS →
          </button>
        </div>
      ) : (
        <>
          {/* hero teams */}
          <div style={{ padding:'14px 18px 8px', textAlign:'center', flexShrink:0 }}>
            <div className="serif-it" style={{ fontSize:22, color:'var(--green-deep)' }}>palpita aí, jogador.</div>
            <div className="mono" style={{ fontSize:11, letterSpacing:'.18em', opacity:.6, marginTop:4 }}>{m.date} · {m.time} · {m.venue}</div>
          </div>

          <div style={{ flex:1, overflow:'auto', display:'flex', flexDirection:'column', justifyContent:'center', padding:'0 14px' }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr auto 1fr', alignItems:'center', gap:8 }}>
              <SideCard team={m.home} score={pick.home} onChange={v=>setScore('home',v)}/>
              <div className="display" style={{ fontSize: 28, opacity:.4 }}>×</div>
              <SideCard team={m.away} score={pick.away} onChange={v=>setScore('away',v)}/>
            </div>
            <div style={{ height:16 }}/>

            {/* quick chip suggestions */}
            <div style={{ display:'flex', justifyContent:'center', gap:6, flexWrap:'wrap' }}>
              {[
                ['1–0','vitória magra'], ['2–1','clássico'], ['2–0','folgado'], ['1–1','empate'], ['3–1','goleada'], ['0–0','treta']
              ].map(([s,l])=>{
                const [h,a] = s.split('–').map(n => parseInt(n));
                const active = pick.home === h && pick.away === a;
                return (
                  <button key={s} onClick={()=>setPicks(p => ({...p, [m.id]:{home:h,away:a}}))} style={{
                    padding:'8px 12px', borderRadius:999, border:'1.5px solid var(--ink)',
                    background: active ? 'var(--yellow)' : 'var(--paper-white)',
                    display:'flex', flexDirection:'column', alignItems:'center', lineHeight:1.05
                  }}>
                    <span className="display" style={{ fontSize:16 }}>{s}</span>
                    <span className="mono" style={{ fontSize:9, letterSpacing:'.12em', opacity:.6 }}>{l}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* pool stats */}
          <div style={{ margin:'0 14px 10px', padding:14, background:'var(--paper-white)', borderRadius:12, border:'1.5px solid var(--ink)', flexShrink:0 }}>
            <div className="mono" style={{ fontSize:10, letterSpacing:'.14em', opacity:.6, marginBottom:8 }}>O QUE A FIRMA TÁ PALPITANDO</div>
            <Bar label={`${m.home.code} ganha`} pct={64} color="var(--green)"/>
            <Bar label="Empate" pct={22} color="var(--yellow)"/>
            <Bar label={`${m.away.code} ganha`} pct={14} color="var(--red)"/>
          </div>
        </>
      )}

      {/* CTA (only for unlocked) */}
      {!isLocked && (
        <div style={{ padding:'10px 14px', background:'var(--paper-white)', borderTop:'1.5px solid var(--ink)', flexShrink:0 }}>
          {isComplete ? (
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={handleDraft} className="btn-ghost" style={{ flex:1, justifyContent:'center', padding:'12px 8px', fontSize:11 }}>
                {isSaved === false ? '✓ RASCUNHO' : 'RASCUNHO'}
              </button>
              <button onClick={handleConfirm} className="btn-yellow" style={{ flex:2, justifyContent:'center' }}>
                {matchIdx < ALL_MATCHES.length - 1 ? 'CONFIRMAR · PRÓXIMO →' : 'CONFIRMAR · CONCLUIR ✓'}
              </button>
            </div>
          ) : (
            <div className="mono" style={{ textAlign:'center', fontSize:11, letterSpacing:'.14em', opacity:.6, padding:'12px 0' }}>
              ESCOLHE OS DOIS PLACARES PRA CONFIRMAR
            </div>
          )}
        </div>
      )}

      <MobileNav current="prediction" onNav={onNav}/>
    </div>
  );
}

function SideCard({ team, score, onChange }){
  const inc = () => onChange(Math.min(9, (score == null ? 0 : score + 1)));
  const dec = () => onChange(Math.max(0, (score == null ? 0 : score - 1)));
  return (
    <div style={{
      padding:14, background:'var(--paper-white)', border:'1.5px solid var(--ink)', borderRadius:14,
      display:'flex', flexDirection:'column', alignItems:'center', gap:8, position:'relative'
    }}>
      <Flag team={team} size={56} ring/>
      <div className="display" style={{ fontSize:20, textAlign:'center', lineHeight:.95 }}>{team.name.toUpperCase()}</div>
      <div className="mono" style={{ fontSize:9, letterSpacing:'.14em', opacity:.5 }}>{team.code}</div>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:4 }}>
        <button onClick={dec} style={ctrlBtn}>–</button>
        <div className="display" style={{
          fontSize:64, lineHeight:1, minWidth:60, textAlign:'center',
          color: score != null ? 'var(--ink)' : 'rgba(13,13,13,.18)'
        }}>{score == null ? '·' : score}</div>
        <button onClick={inc} style={ctrlBtn}>+</button>
      </div>
    </div>
  );
}
const ctrlBtn = {
  width:40, height:40, borderRadius:'50%', border:'1.5px solid var(--ink)',
  background:'var(--paper)', fontFamily:'var(--display)', fontSize:24
};

function Bar({ label, pct, color }){
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
      <span style={{ fontSize:12, fontWeight:600, width:90 }}>{label}</span>
      <div style={{ flex:1, height:10, background:'var(--paper-deep)', borderRadius:999, overflow:'hidden', border:'1px solid var(--hairline)' }}>
        <div style={{ height:'100%', width:`${pct}%`, background:color }}/>
      </div>
      <span className="mono" style={{ fontSize:11, width:34, textAlign:'right' }}>{pct}%</span>
    </div>
  );
}

/* =========================================================
   PREDICTION FLOW — Desktop (editorial)
   ========================================================= */
function PredictionDesktop({ onNav }){
  const [matchIdx, setMatchIdx] = React.useState(1);
  const [picks, setPicks] = React.useState({});
  const [saved, setSaved] = React.useState({});

  const m = ALL_MATCHES[matchIdx];
  const isLocked = !!m.locked;
  const pick = picks[m.id] || m.yourPick || { home: null, away: null };
  const setScore = (side, val) => {
    if (isLocked) return;
    setPicks(p => ({ ...p, [m.id]: { ...(p[m.id] || pick), [side]: val } }));
  };

  const handleConfirm = () => {
    setSaved(s => ({ ...s, [m.id]: true }));
    if (matchIdx < ALL_MATCHES.length - 1) setMatchIdx(i => i + 1);
    else onNav('home');
  };

  return (
    <div style={{ background:'var(--paper)', minHeight:'100%', display:'flex', flexDirection:'column' }} className="paper-grain">
      <DesktopNav current="prediction" onNav={onNav}/>

      <div style={{ padding:'18px 32px', borderBottom:'1.5px solid var(--ink)', display:'flex', justifyContent:'space-between', alignItems:'flex-end' }}>
        <div>
          <span className="eyebrow" style={{ opacity:.6 }}>SEÇÃO 03 · SEUS PALPITES</span>
          <h1 className="display" style={{ fontSize:'clamp(60px, 7vw, 110px)', lineHeight:.86, margin:'4px 0 0' }}>
            PALPITA <span className="serif-it" style={{ color:'var(--green-deep)' }}>aí</span>.
          </h1>
        </div>
        <div className="mono" style={{ fontSize:11, letterSpacing:'.18em' }}>JOGO {matchIdx+1} DE {ALL_MATCHES.length} · PRAZO 02H 14MIN</div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1.4fr 1fr', flex:1, minHeight:0 }}>
        {/* sidebar match list */}
        <div style={{ borderRight:'1.5px solid var(--ink)', overflow:'auto' }}>
          {ALL_MATCHES.map((mm, i) => {
            const p = picks[mm.id] || mm.yourPick;
            const active = i === matchIdx;
            const isDone = saved[mm.id] || (mm.yourPick && !picks[mm.id]);
            return (
              <button key={mm.id} onClick={()=>setMatchIdx(i)} style={{
                width:'100%', textAlign:'left', padding:'14px 20px',
                borderBottom:'1px dashed rgba(13,13,13,.18)',
                background: active ? 'var(--yellow)' : mm.locked ? 'rgba(13,13,13,.04)' : 'transparent',
                display:'block', opacity: mm.locked && !active ? .65 : 1
              }}>
                <div className="mono" style={{ fontSize:10, letterSpacing:'.14em', opacity:.6, display:'flex', alignItems:'center', gap:6 }}>
                  {mm.locked ? '🔒 AO VIVO' : mm.stage} · {mm.date} · {mm.time}
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:6 }}>
                  <Flag team={mm.home} size={28}/>
                  <span className="display" style={{ fontSize:18 }}>{mm.home.code}</span>
                  <span className="mono" style={{ opacity:.5, fontSize:11 }}>vs</span>
                  <span className="display" style={{ fontSize:18 }}>{mm.away.code}</span>
                  <Flag team={mm.away} size={28}/>
                  <div style={{ flex:1 }}/>
                  {p ? (
                    <span className="display" style={{ fontSize:18, color:'var(--green-deep)' }}>{p.home}–{p.away}</span>
                  ) : mm.locked ? (
                    <span className="mono" style={{ fontSize:10, color:'var(--ink-3)', letterSpacing:'.14em' }}>ENCERRADO</span>
                  ) : (
                    <span className="mono" style={{ fontSize:10, color:'var(--red)', letterSpacing:'.14em' }}>SEM PALPITE</span>
                  )}
                </div>
                {isDone && !mm.locked && (
                  <div className="mono" style={{ fontSize:9, letterSpacing:'.12em', color:'var(--green-deep)', marginTop:4 }}>✓ SALVO</div>
                )}
              </button>
            );
          })}
        </div>

        {/* main panel */}
        <div style={{ padding:'32px 36px', display:'flex', flexDirection:'column', gap:22, position:'relative', overflow:'hidden' }}>
          <div className="stripe-bg" style={{ position:'absolute', top:0, left:0, right:0, height:6, opacity:.5 }}/>

          {isLocked ? (
            /* locked state desktop */
            <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:18, textAlign:'center' }}>
              <div style={{
                width:80, height:80, borderRadius:'50%', background:'var(--ink)',
                display:'flex', alignItems:'center', justifyContent:'center', fontSize:36
              }}>🔒</div>
              <div>
                <div className="eyebrow" style={{ color:'var(--red)', opacity:1 }}>PALPITES ENCERRADOS · JOGO EM ANDAMENTO</div>
                <div className="display" style={{ fontSize:64, lineHeight:.88, marginTop:6 }}>
                  {m.home.name.toUpperCase()}<br/><span className="serif-it" style={{ fontSize:32, color:'var(--ink-3)' }}>vs</span><br/>{m.away.name.toUpperCase()}
                </div>
              </div>

              {/* live scoreboard */}
              <div style={{
                padding:'24px 32px', background:'var(--ink)', borderRadius:16,
                color:'var(--paper-white)', position:'relative', overflow:'hidden', width:'100%'
              }}>
                <div className="pitch-turf" style={{ position:'absolute', inset:0, opacity:.4 }}/>
                <div style={{ position:'relative', display:'flex', alignItems:'center', justifyContent:'center', gap:24 }}>
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:8 }}>
                    <Flag team={m.home} size={64} ring/>
                    <div className="display" style={{ fontSize:20 }}>{m.home.code}</div>
                  </div>
                  <div>
                    <div className="display" style={{ fontSize:96, lineHeight:.86 }}>
                      {LIVE.homeScore}<span style={{ opacity:.4 }}>—</span>{LIVE.awayScore}
                    </div>
                    <div className="mono" style={{ fontSize:12, letterSpacing:'.18em', opacity:.7, marginTop:4, textAlign:'center' }}>
                      {LIVE.minute} · <span className="dot-live" style={{ marginRight:4 }}/>AO VIVO
                    </div>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:8 }}>
                    <Flag team={m.away} size={64} ring/>
                    <div className="display" style={{ fontSize:20 }}>{m.away.code}</div>
                  </div>
                </div>
              </div>

              {m.yourPick && (
                <div style={{ width:'100%', padding:'18px 22px', background:'var(--yellow)', border:'1.5px solid var(--ink)', borderRadius:12 }}>
                  <div className="mono" style={{ fontSize:10, letterSpacing:'.14em', opacity:.7 }}>SEU PALPITE</div>
                  <div className="display" style={{ fontSize:48, lineHeight:.9 }}>{m.yourPick.home}–{m.yourPick.away}</div>
                  <div className="mono" style={{ fontSize:11, letterSpacing:'.14em', marginTop:4 }}>
                    {LIVE.homeScore === m.yourPick.home && LIVE.awayScore === m.yourPick.away
                      ? '🎯 PLACAR EXATO AGORA — +10 PTS SE ACABAR ASSIM'
                      : '⏳ ACOMPANHA O JOGO...'}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              <Stamp color="var(--ink)" rot={-2}>{m.stage}</Stamp>
              <div className="display" style={{ fontSize:64, lineHeight:.88 }}>
                {m.home.name.toUpperCase()}<br/><span className="serif-it" style={{ fontSize:32, color:'var(--ink-3)' }}>vs</span><br/>{m.away.name.toUpperCase()}
              </div>
              <div className="mono" style={{ fontSize:12, letterSpacing:'.18em', opacity:.6 }}>{m.venue} · {m.date} · {m.time}</div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:24, alignItems:'center' }}>
                <SideCard team={m.home} score={pick.home} onChange={v=>setScore('home', v)}/>
                <SideCard team={m.away} score={pick.away} onChange={v=>setScore('away', v)}/>
              </div>

              <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                {[['1–0','magra'],['2–1','clássico'],['2–0','folgado'],['1–1','empate'],['3–1','goleada'],['0–0','treta']].map(([s,l])=>{
                  const [h,a] = s.split('–').map(n=>parseInt(n));
                  const active = pick.home === h && pick.away === a;
                  return (
                    <button key={s} onClick={()=>setPicks(p => ({...p, [m.id]:{home:h,away:a}}))} style={{
                      padding:'10px 14px', borderRadius:999,
                      border:'1.5px solid var(--ink)',
                      background: active ? 'var(--yellow)' : 'var(--paper-white)',
                      fontFamily:'var(--display)', fontSize:18, display:'flex', alignItems:'center', gap:8
                    }}>
                      {s} <span className="serif-it" style={{ fontSize:13, color:'var(--ink-3)' }}>· {l}</span>
                    </button>
                  );
                })}
              </div>

              <div style={{ display:'flex', gap:10 }}>
                <button
                  onClick={()=>{ setSaved(s => ({...s, [m.id]:false})); setMatchIdx(i => Math.min(i+1, ALL_MATCHES.length-1)); }}
                  className="btn-ghost" style={{ padding:'14px 18px' }}>
                  SALVAR RASCUNHO
                </button>
                <button onClick={handleConfirm} className="btn-yellow" style={{ padding:'18px 24px' }}>
                  {pick.home != null && pick.away != null
                    ? (matchIdx < ALL_MATCHES.length - 1 ? 'CONFIRMAR & PRÓXIMO →' : 'CONFIRMAR & CONCLUIR ✓')
                    : 'ESCOLHA UM PLACAR'}
                </button>
              </div>
            </>
          )}
        </div>

        {/* right rail */}
        <div style={{ borderLeft:'1.5px solid var(--ink)', padding:'24px 28px', background:'var(--paper-deep)', overflow:'auto' }}>
          <Eyebrow num="01">A FIRMA OPINA</Eyebrow>
          <div style={{ height:14 }}/>
          <Bar label={`${m.home.code} ganha`} pct={64} color="var(--green)"/>
          <Bar label="Empate" pct={22} color="var(--yellow)"/>
          <Bar label={`${m.away.code} ganha`} pct={14} color="var(--red)"/>

          <div style={{ height:18 }}/>
          <Eyebrow num="02">PALPITES POPULARES</Eyebrow>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:8, marginTop:10 }}>
            {[['2–1',31],['2–0',24],['1–0',16],['3–1',8],['1–1',7],['3–0',6]].map(([s, n], i)=>(
              <div key={s} style={{ background:'var(--paper-white)', border:'1px solid var(--hairline)', borderRadius:8, padding:'10px 12px' }}>
                <div className="display" style={{ fontSize:24 }}>{s}</div>
                <div className="mono" style={{ fontSize:10, letterSpacing:'.14em', opacity:.6 }}>{n}% DA FIRMA</div>
              </div>
            ))}
          </div>

          <div style={{ height:18 }}/>
          <Eyebrow num="03">SISTEMA DE PONTOS</Eyebrow>
          <div style={{ marginTop:10, fontSize:13, lineHeight:1.55 }}>
            <Pt n="3" label="Acerta o vencedor"/>
            <Pt n="5" label="Acerta vencedor + diferença de gols"/>
            <Pt n="10" label="Placar exato"/>
            <Pt n="50" label="Acerta o campeão (palpite inicial)"/>
          </div>
        </div>
      </div>
    </div>
  );
}

function Pt({ n, label }){
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, padding:'6px 0', borderBottom:'1px dashed rgba(13,13,13,.15)' }}>
      <span className="display" style={{ fontSize:24, color:'var(--green-deep)', minWidth:40 }}>+{n}</span>
      <span style={{ fontSize:13 }}>{label}</span>
    </div>
  );
}

Object.assign(window, { PredictionMobile, PredictionDesktop });
