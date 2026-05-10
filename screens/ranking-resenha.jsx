/* global React, Flag, Avatar, Stamp, T, RANKING, Eyebrow, MobileNav, DesktopNav */

/* =========================================================
   RANKING — Mobile
   ========================================================= */
function RankingMobile({ onNav }){
  const [tab, setTab] = React.useState('geral');

  const squads = [
    { dept:'Eng. Plataforma', pts:1284, top:'Lucas Mendes', color:'#00A651' },
    { dept:'Marketing',       pts:1271, top:'Carla Tavares', color:'#FFCB05' },
    { dept:'CEO',             pts:1248, top:'Renan Albuq.',  color:'#E63946' },
    { dept:'Produto',         pts:1230, top:'Bia Yamashita', color:'#1D3557' },
    { dept:'Data',            pts:1218, top:'Mathzi Pires',  color:'#C9A856' },
    { dept:'Design',          pts:1204, top:'Felipe Souza',  color:'#FFCB05', isYou:true },
    { dept:'Comercial',       pts:1192, top:'Aline Ribeiro', color:'#00A651' },
    { dept:'Eng. Mobile',     pts:1188, top:'Diogo Saito',   color:'#E63946' },
  ];

  const semana = RANKING.map(p => ({ ...p, semPts: Math.floor(Math.random()*120)+10 }))
    .sort((a,b) => b.semPts - a.semPts)
    .map((p,i) => ({ ...p, semRank: i+1 }));

  return (
    <div style={{ height:'100%', display:'flex', flexDirection:'column', background:'var(--paper)' }}>
      <div style={{ flex:1, overflow:'auto' }} className="paper-grain">
        <div style={{ padding:'14px 18px 8px' }}>
          <div className="eyebrow" style={{ opacity:.6 }}>SEÇÃO 04</div>
          <h1 className="display" style={{ fontSize:46, lineHeight:.85, margin:'4px 0 0' }}>
            RANKING.<br/><span className="serif-it" style={{ color:'var(--green-deep)', fontSize:30 }}>87 jogadores · 1 taça.</span>
          </h1>
        </div>

        <div style={{ display:'flex', gap:6, padding:'10px 18px 0' }}>
          {[['geral','Geral'],['squad','Por Squad'],['semana','Semana']].map(([k,l])=>(
            <button key={k} onClick={()=>setTab(k)} style={{
              padding:'8px 14px', borderRadius:999, border:'1.5px solid var(--ink)',
              background: tab === k ? 'var(--ink)' : 'var(--paper-white)',
              color: tab === k ? 'var(--paper-white)' : 'var(--ink)',
              fontFamily:'var(--display)', fontSize:14, letterSpacing:'.04em', textTransform:'uppercase'
            }}>{l}</button>
          ))}
        </div>

        {tab === 'geral' && (
          <>
            {/* podium */}
            <div style={{ padding:'18px 18px 8px', display:'grid', gridTemplateColumns:'1fr 1.15fr 1fr', alignItems:'flex-end', gap:6 }}>
              {[RANKING[1], RANKING[0], RANKING[2]].map((p, i) => {
                const heights = [104, 132, 90];
                const order = [2,1,3];
                return (
                  <div key={p.rank} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
                    <Avatar p={p} size={i===1?64:48}/>
                    <div style={{ fontSize:11, fontWeight:700, textAlign:'center', lineHeight:1.1 }}>{p.name.split(' ')[0]}</div>
                    <div className="mono" style={{ fontSize:10, opacity:.6 }}>{p.pts} pts</div>
                    <div style={{
                      width:'100%', height: heights[i],
                      background: i === 1 ? 'var(--yellow)' : 'var(--paper-deep)',
                      border:'1.5px solid var(--ink)',
                      borderRadius:'10px 10px 0 0',
                      display:'flex', alignItems:'flex-start', justifyContent:'center', paddingTop: 10
                    }}>
                      <span className="display" style={{ fontSize: i === 1 ? 50 : 36 }}>{order[i]}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* you sticky */}
            <div style={{ margin:'8px 14px', padding:'12px 14px', background:'var(--ink)', color:'var(--paper-white)', borderRadius:14, display:'flex', alignItems:'center', gap:12 }}>
              <span className="avatar" style={{ width:40, height:40, background:'var(--yellow)', color:'var(--ink)' }}>FS</span>
              <div style={{ flex:1 }}>
                <div className="mono" style={{ fontSize:9, letterSpacing:'.18em', opacity:.7 }}>VOCÊ</div>
                <div className="display" style={{ fontSize:18 }}>FELIPE SOUZA</div>
              </div>
              <div className="display" style={{ fontSize:36 }}>06º</div>
              <div style={{ width:1, height:30, background:'rgba(255,252,245,.2)' }}/>
              <div className="display" style={{ fontSize:24, color:'var(--yellow)' }}>1.204</div>
            </div>

            {/* table */}
            <div style={{ margin:'4px 14px 18px', background:'var(--paper-white)', border:'1.5px solid var(--ink)', borderRadius:14, overflow:'hidden' }}>
              {RANKING.map((p, i) => {
                const movPos = p.mov.startsWith('+');
                const movNeg = p.mov.startsWith('-');
                return (
                  <div key={p.rank} style={{
                    display:'flex', alignItems:'center', gap:10,
                    padding:'10px 14px',
                    borderTop: i ? '1px dashed rgba(13,13,13,.12)' : 'none',
                    background: p.isYou ? 'var(--yellow)' : 'transparent'
                  }}>
                    <span className="display" style={{ fontSize:18, width:28 }}>{String(p.rank).padStart(2,'0')}</span>
                    <Avatar p={p} size={32}/>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight: p.isYou? 800: 600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</div>
                      <div className="mono" style={{ fontSize:9, letterSpacing:'.14em', opacity:.55 }}>{p.dept.toUpperCase()} · {p.exact} EXATOS</div>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <div className="display" style={{ fontSize:18 }}>{p.pts}</div>
                      <div className="mono" style={{ fontSize:9, letterSpacing:'.12em',
                        color: movPos ? 'var(--green-deep)' : movNeg ? 'var(--red)' : 'var(--ink-3)'
                      }}>{movPos? '▲':movNeg? '▼':'•'} {p.mov}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {tab === 'squad' && (
          <div style={{ margin:'14px 14px 18px', display:'flex', flexDirection:'column', gap:8 }}>
            <div className="mono" style={{ fontSize:10, letterSpacing:'.14em', opacity:.6, marginBottom:4 }}>MELHOR PONTUAÇÃO POR DEPARTAMENTO</div>
            {squads.map((s, i) => (
              <div key={s.dept} style={{
                display:'flex', alignItems:'center', gap:12, padding:'12px 14px',
                background: s.isYou ? 'var(--yellow)' : 'var(--paper-white)',
                border:'1.5px solid var(--ink)', borderRadius:10
              }}>
                <span className="display" style={{ fontSize:20, width:24 }}>{String(i+1).padStart(2,'0')}</span>
                <div style={{ width:8, height:32, background:s.color, borderRadius:2 }}/>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:700 }}>{s.dept}</div>
                  <div className="mono" style={{ fontSize:10, opacity:.6 }}>melhor: {s.top}</div>
                </div>
                <div className="display" style={{ fontSize:22 }}>{s.pts}</div>
              </div>
            ))}
          </div>
        )}

        {tab === 'semana' && (
          <div style={{ margin:'14px 14px 18px' }}>
            <div className="mono" style={{ fontSize:10, letterSpacing:'.14em', opacity:.6, marginBottom:8 }}>RANKING DA SEMANA · 03–09 JUL</div>
            <div style={{ background:'var(--paper-white)', border:'1.5px solid var(--ink)', borderRadius:14, overflow:'hidden' }}>
              {semana.slice(0,8).map((p, i) => (
                <div key={p.rank} style={{
                  display:'flex', alignItems:'center', gap:10, padding:'10px 14px',
                  borderTop: i ? '1px dashed rgba(13,13,13,.12)' : 'none',
                  background: p.isYou ? 'var(--yellow)' : 'transparent'
                }}>
                  <span className="display" style={{ fontSize:18, width:28 }}>{String(i+1).padStart(2,'0')}</span>
                  <Avatar p={p} size={32}/>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight: p.isYou? 800:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</div>
                    <div className="mono" style={{ fontSize:9, letterSpacing:'.14em', opacity:.55 }}>{p.dept.toUpperCase()}</div>
                  </div>
                  <div className="display" style={{ fontSize:20, color:'var(--green-deep)' }}>+{p.semPts}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <MobileNav current="ranking" onNav={onNav}/>
    </div>
  );
}

/* =========================================================
   RANKING — Desktop
   ========================================================= */
function RankingDesktop({ onNav }){
  return (
    <div style={{ background:'var(--paper)', minHeight:'100%' }} className="paper-grain">
      <DesktopNav current="ranking" onNav={onNav}/>

      <div style={{ padding:'18px 32px', borderBottom:'1.5px solid var(--ink)' }}>
        <span className="eyebrow" style={{ opacity:.6 }}>SEÇÃO 04 · TABELA OFICIAL</span>
        <h1 className="display" style={{ fontSize:'clamp(60px, 7vw, 110px)', lineHeight:.86, margin:'4px 0 0' }}>
          O <span className="serif-it" style={{ color:'var(--green-deep)' }}>caos</span> da firma.
        </h1>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1.4fr 1fr', minHeight:0 }}>
        {/* left — podium + table */}
        <div style={{ padding:'24px 32px', borderRight:'1.5px solid var(--ink)' }}>
          <Eyebrow num="01" sub="ATUALIZADO 14:08">PÓDIO · OITAVAS</Eyebrow>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1.15fr 1fr', alignItems:'flex-end', gap:14, marginTop:14 }}>
            {[RANKING[1], RANKING[0], RANKING[2]].map((p, i) => (
              <div key={p.rank} style={{
                background: i === 1 ? 'var(--yellow)' : 'var(--paper-white)',
                border:'1.5px solid var(--ink)', borderRadius:14, padding:'18px 18px 24px',
                position:'relative', overflow:'hidden',
                transform: i === 1 ? 'translateY(-8px)' : 'none',
                boxShadow: '6px 6px 0 var(--ink)'
              }}>
                <div className="display" style={{ fontSize: i === 1 ? 90 : 64, lineHeight:.9, position:'absolute', right:14, top:8, opacity:.18 }}>
                  {i === 1 ? '01' : i === 0 ? '02' : '03'}
                </div>
                <Avatar p={p} size={i === 1 ? 72 : 56}/>
                <div className="display" style={{ fontSize: i === 1 ? 28 : 22, marginTop:10, lineHeight:.95 }}>{p.name.toUpperCase()}</div>
                <div className="mono" style={{ fontSize:10, letterSpacing:'.14em', opacity:.6, marginTop:4 }}>{p.dept.toUpperCase()}</div>
                <div style={{ height:10 }}/>
                <div className="display" style={{ fontSize:42, lineHeight:1 }}>{p.pts}</div>
                <div className="mono" style={{ fontSize:10, letterSpacing:'.14em' }}>PTS · {p.exact} EXATOS · STREAK {p.streak}</div>
              </div>
            ))}
          </div>

          <div style={{ height:24 }}/>
          <Eyebrow num="02">TABELA · TODOS OS 12 PRIMEIROS</Eyebrow>
          <div style={{ marginTop:10, background:'var(--paper-white)', border:'1.5px solid var(--ink)', borderRadius:14, overflow:'hidden' }}>
            <div style={{
              display:'grid', gridTemplateColumns:'40px 1.4fr 1fr 70px 70px 70px 70px',
              padding:'10px 14px', borderBottom:'1.5px solid var(--ink)', background:'var(--paper-deep)',
              fontFamily:'var(--mono)', fontSize:10, letterSpacing:'.14em', textTransform:'uppercase', fontWeight:600
            }}>
              <div>#</div><div>jogador</div><div>squad</div><div>acertos</div><div>exatos</div><div>streak</div><div style={{ textAlign:'right' }}>pts</div>
            </div>
            {RANKING.map((p, i) => {
              const movPos = p.mov.startsWith('+');
              const movNeg = p.mov.startsWith('-');
              return (
                <div key={p.rank} style={{
                  display:'grid', gridTemplateColumns:'40px 1.4fr 1fr 70px 70px 70px 70px',
                  padding:'12px 14px', alignItems:'center',
                  borderTop: i ? '1px dashed rgba(13,13,13,.12)' : 'none',
                  background: p.isYou ? 'var(--yellow)' : 'transparent'
                }}>
                  <div className="display" style={{ fontSize:18 }}>{String(p.rank).padStart(2,'0')}</div>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <Avatar p={p} size={28}/>
                    <span style={{ fontWeight: p.isYou? 800 : 600, fontSize:14 }}>{p.name}</span>
                    <span className="mono" style={{ fontSize:10, color: movPos? 'var(--green-deep)':movNeg?'var(--red)':'var(--ink-3)' }}>{movPos?'▲':movNeg?'▼':'•'}{p.mov}</span>
                  </div>
                  <div className="mono" style={{ fontSize:11, opacity:.7 }}>{p.dept}</div>
                  <div className="display" style={{ fontSize:18 }}>{p.correct}</div>
                  <div className="display" style={{ fontSize:18, color:'var(--green-deep)' }}>{p.exact}</div>
                  <div className="mono" style={{ fontSize:12 }}>{p.streak}🔥</div>
                  <div className="display" style={{ fontSize:22, textAlign:'right' }}>{p.pts}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* right rail */}
        <div style={{ padding:'24px 32px', display:'flex', flexDirection:'column', gap:18, background:'var(--paper-deep)' }}>
          <div style={{
            background:'var(--ink)', color:'var(--paper-white)', borderRadius:14, padding:20, position:'relative', overflow:'hidden'
          }}>
            <Stamp color="var(--yellow)" rot={-3}>você</Stamp>
            <div className="display" style={{ fontSize:90, lineHeight:.85, marginTop:10 }}>06<span className="serif-it" style={{ fontSize:32 }}>º</span></div>
            <div className="display" style={{ fontSize:34 }}>1.204 PTS</div>
            <div className="mono" style={{ fontSize:11, letterSpacing:'.14em', opacity:.7, marginTop:4 }}>FELIPE SOUZA · DESIGN</div>
            <div style={{ borderTop:'1px dashed rgba(255,252,245,.22)', marginTop:14, paddingTop:14 }}>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
                <Stat2 n="15" l="acertos"/>
                <Stat2 n="5" l="exatos"/>
                <Stat2 n="5🔥" l="streak"/>
              </div>
            </div>
          </div>

          <div style={{ background:'var(--paper-white)', border:'1.5px solid var(--ink)', borderRadius:14, padding:18 }}>
            <Eyebrow num="03">RANKING POR SQUAD</Eyebrow>
            <div style={{ height:10 }}/>
            {[
              ['Eng. Plataforma',1284,'#00A651'],['Marketing',1271,'#FFCB05'],['CEO',1248,'#E63946'],['Produto',1230,'#1D3557'],['Data',1218,'#C9A856'],
              ['Design',1204,'#FFCB05']
            ].map(([d, pts, c], i)=>(
              <div key={d} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderTop: i? '1px dashed rgba(13,13,13,.15)':'none' }}>
                <div style={{ width:8, height:24, background:c }}/>
                <span style={{ flex:1, fontSize:13, fontWeight:600 }}>{d}</span>
                <span className="display" style={{ fontSize:18 }}>{pts}</span>
              </div>
            ))}
          </div>

          <div style={{ background:'var(--paper-white)', border:'1.5px solid var(--ink)', borderRadius:14, padding:18 }}>
            <Eyebrow num="04">TROFÉUS DA SEMANA</Eyebrow>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:10, marginTop:10 }}>
              {[
                ['🎯','SNIPER','Mais exatos','5'],
                ['🔥','STREAK','Maior sequência','5🔥'],
                ['💀','MICO','Pior palpite','+0pt'],
                ['🤝','JURADO','Mais reagiu','22'],
              ].map(([e, t, l, n]) => (
                <div key={t} style={{ border:'1.5px solid var(--ink)', borderRadius:10, padding:'12px 10px' }}>
                  <div style={{ fontSize:24 }}>{e}</div>
                  <div className="display" style={{ fontSize:18, marginTop:4 }}>{t}</div>
                  <div className="mono" style={{ fontSize:9, letterSpacing:'.12em', opacity:.6 }}>{l}</div>
                  <div className="display" style={{ fontSize:20, marginTop:4, color:'var(--green-deep)' }}>{n}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat2({ n, l }){
  return (
    <div>
      <div className="display" style={{ fontSize:28, color:'var(--yellow)' }}>{n}</div>
      <div className="mono" style={{ fontSize:9, letterSpacing:'.14em', opacity:.7 }}>{l.toUpperCase()}</div>
    </div>
  );
}


/* =========================================================
   RESENHA — Mobile chat
   ========================================================= */
function ResenhaMobile({ onNav }){
  const [messages, setMessages] = React.useState([]);
  const [draft, setDraft] = React.useState('');
  const isEmpty = messages.length === 0;

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    setMessages(m => [...m, {
      who:'Você', dept:'Design', init:'FS', color:'#FFCB05', time:'agora', isYou:true, text
    }]);
    setDraft('');
  };

  return (
    <div style={{ height:'100%', display:'flex', flexDirection:'column', background:'var(--paper)' }}>
      {/* header */}
      <div style={{ padding:'12px 18px', borderBottom:'1.5px solid var(--ink)', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0, background:'var(--paper)' }}>
        <div>
          <div className="display" style={{ fontSize:24 }}>#RESENHA</div>
          <div className="mono" style={{ fontSize:9, letterSpacing:'.18em', opacity:.6 }}>87 INSCRITOS · {isEmpty ? 'NINGUÉM FALOU NADA AINDA' : `${messages.length} MSGS`}</div>
        </div>
        <span className="badge" style={{ background:'var(--green)', color:'var(--paper-white)' }}>● ATIVO</span>
      </div>

      {/* chat area */}
      <div style={{ flex:1, overflow:'auto', padding:'14px' }} className="paper-grain">
        {isEmpty ? (
          <div style={{
            display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
            height:'100%', gap:12, textAlign:'center', padding:'0 24px'
          }}>
            <div style={{ fontSize:56 }}>⚽</div>
            <div className="display" style={{ fontSize:36, lineHeight:.88 }}>SILÊNCIO<br/>TOTAL.</div>
            <div className="serif-it" style={{ fontSize:17, color:'var(--ink-3)', lineHeight:1.4 }}>
              87 colegas inscritos.<br/>Ninguém falou nada ainda.
            </div>
            <div className="mono" style={{ fontSize:11, letterSpacing:'.14em', opacity:.6, marginTop:4 }}>
              isso é historicamente vergonhoso.
            </div>
            <div style={{
              marginTop:8, padding:'12px 16px',
              background:'var(--yellow)', border:'1.5px solid var(--ink)', borderRadius:12
            }}>
              <div className="mono" style={{ fontSize:10, letterSpacing:'.14em' }}>💡 ABRE O JOGO LÁ EMBAIXO</div>
            </div>
          </div>
        ) : (
          <>
            {messages.map((m, i) => <ChatBubble key={i} m={m}/>)}
          </>
        )}
      </div>

      {/* input */}
      <div style={{ padding:10, borderTop:'1.5px solid var(--ink)', display:'flex', gap:8, alignItems:'center', background:'var(--paper-white)', flexShrink:0 }}>
        <button className="mono" style={{ fontSize:18 }}>⚽</button>
        <input
          value={draft}
          onChange={e=>setDraft(e.target.value)}
          onKeyDown={e=>{ if(e.key==='Enter') send(); }}
          placeholder="manda a tua aí…"
          style={{
            flex:1, padding:'10px 14px', borderRadius:999,
            border:'1.5px solid var(--ink)', background:'var(--paper)', fontFamily:'var(--sans)', fontSize:14
          }}
        />
        <button onClick={send} className="btn-yellow" style={{ padding:'10px 14px', fontSize:11 }}>ENVIAR</button>
      </div>

      <MobileNav current="resenha" onNav={onNav}/>
    </div>
  );
}

function ChatBubble({ m }){
  const isYou = m.isYou;
  return (
    <div style={{ display:'flex', gap:10, marginBottom:14, flexDirection: isYou ? 'row-reverse' : 'row' }}>
      <span className="avatar" style={{ width:36, height:36, fontSize:13, background:m.color }}>{m.init}</span>
      <div style={{ maxWidth:'78%' }}>
        <div style={{ display:'flex', gap:8, alignItems:'baseline', justifyContent: isYou ? 'flex-end' : 'flex-start' }}>
          <span style={{ fontSize:12, fontWeight:700 }}>{m.who}</span>
          <span className="mono" style={{ fontSize:9, letterSpacing:'.14em', opacity:.5 }}>{m.dept.toUpperCase()} · {m.time}</span>
        </div>
        <div style={{
          marginTop:4, padding:'10px 14px',
          background: isYou ? 'var(--yellow)' : 'var(--paper-white)',
          border:'1.5px solid var(--ink)',
          borderRadius: isYou ? '14px 4px 14px 14px' : '4px 14px 14px 14px',
          fontSize:14, lineHeight:1.4
        }}>{m.text}</div>
        {m.reaction && (
          <div style={{ marginTop:4, display:'flex', gap:6, justifyContent: isYou? 'flex-end' : 'flex-start' }}>
            <span style={{
              padding:'3px 8px', border:'1px solid var(--ink)', borderRadius:999, background:'var(--paper-white)', fontSize:11
            }}>{m.reaction} 12</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* =========================================================
   RESENHA — Desktop (chat + threads + stats)
   ========================================================= */
function ResenhaDesktop({ onNav }){
  const [messages, setMessages] = React.useState([]);
  const [draft, setDraft] = React.useState('');
  const isEmpty = messages.length === 0;

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    setMessages(m => [...m, {
      who:'Você', dept:'Design', init:'FS', color:'#FFCB05', time:'agora', isYou:true, text
    }]);
    setDraft('');
  };

  return (
    <div style={{ background:'var(--paper)', minHeight:'100%' }} className="paper-grain">
      <DesktopNav current="resenha" onNav={onNav}/>

      <div style={{ padding:'18px 32px', borderBottom:'1.5px solid var(--ink)' }}>
        <span className="eyebrow" style={{ opacity:.6 }}>SEÇÃO 05 · CHAT DA FIRMA</span>
        <h1 className="display" style={{ fontSize:'clamp(60px, 7vw, 110px)', lineHeight:.86, margin:'4px 0 0' }}>
          A <span className="serif-it" style={{ color:'var(--green-deep)' }}>resenha.</span>
        </h1>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'260px 1fr 320px', minHeight: 700 }}>
        {/* channels */}
        <div style={{ borderRight:'1.5px solid var(--ink)', padding:'18px 0' }}>
          <div className="mono" style={{ fontSize:10, letterSpacing:'.18em', padding:'0 18px 8px', opacity:.6 }}>CANAIS</div>
          {[
            ['#geral', isEmpty ? 0 : messages.length, true],
            ['#bra', 0, false],
            ['#por-x-uru', 0, false],
            ['#zueira', 0, false],
            ['#palpites-ousados', 0, false],
            ['#mathzi-vs-renan', 0, false],
            ['#cafezinho', 0, false],
          ].map(([n, c, active]) => (
            <button key={n} style={{
              display:'flex', alignItems:'center', gap:8, width:'100%',
              padding:'10px 18px',
              background: active ? 'var(--yellow)' : 'transparent',
              borderLeft: active ? '4px solid var(--ink)' : '4px solid transparent',
              fontWeight: active? 800 : 600
            }}>
              <span style={{ flex:1, textAlign:'left', fontSize:13 }}>{n}</span>
              {c > 0 && <span className="mono" style={{ fontSize:10, opacity:.5 }}>{c}</span>}
            </button>
          ))}
          <div style={{ height:14, borderTop:'1px dashed rgba(13,13,13,.15)', margin:'14px 0' }}/>
          <div className="mono" style={{ fontSize:10, letterSpacing:'.18em', padding:'0 18px 8px', opacity:.6 }}>JOGADORES ONLINE</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:6, padding:'0 18px' }}>
            {RANKING.slice(0,12).map(p => <Avatar key={p.rank} p={p} size={28}/>)}
          </div>
        </div>

        {/* main chat */}
        <div style={{ display:'flex', flexDirection:'column', borderRight:'1.5px solid var(--ink)' }}>
          <div style={{ padding:'14px 24px', borderBottom:'1.5px solid var(--ink)', background:'var(--paper-white)' }}>
            <div className="display" style={{ fontSize:24 }}>#GERAL</div>
            <div className="mono" style={{ fontSize:10, letterSpacing:'.14em', opacity:.6 }}>BAR DA FIRMA · BOLÃO '26 · TODO MUNDO</div>
          </div>

          {/* empty or messages */}
          <div style={{ flex:1, padding:'18px 24px', overflow:'auto', display:'flex', flexDirection:'column' }}>
            {isEmpty ? (
              <div style={{
                flex:1, display:'flex', flexDirection:'column',
                alignItems:'center', justifyContent:'center',
                textAlign:'center', gap:14
              }}>
                <div style={{ fontSize:64 }}>⚽</div>
                <div className="display" style={{ fontSize:54, lineHeight:.85 }}>SILÊNCIO<br/>TOTAL.</div>
                <div className="serif-it" style={{ fontSize:20, color:'var(--ink-3)', lineHeight:1.45 }}>
                  87 colegas inscritos.<br/>
                  Ninguém falou nada ainda.<br/>
                  Isso é historicamente vergonhoso.
                </div>
                <div style={{
                  padding:'14px 20px', background:'var(--yellow)',
                  border:'1.5px solid var(--ink)', borderRadius:12
                }}>
                  <div className="mono" style={{ fontSize:11, letterSpacing:'.14em' }}>
                    💡 SEJA O PRIMEIRO A ABRIR O JOGO
                  </div>
                </div>
              </div>
            ) : (
              messages.map((m, i) => <ChatBubble key={i} m={m}/>)
            )}
          </div>

          <div style={{ padding:14, borderTop:'1.5px solid var(--ink)', display:'flex', gap:10, alignItems:'center', background:'var(--paper-white)' }}>
            <input
              value={draft}
              onChange={e=>setDraft(e.target.value)}
              onKeyDown={e=>{ if(e.key==='Enter') send(); }}
              placeholder="manda a tua aí, jogador…"
              style={{
                flex:1, padding:'14px 18px', borderRadius:999,
                border:'1.5px solid var(--ink)', background:'var(--paper)', fontFamily:'var(--sans)', fontSize:14
              }}
            />
            <button className="btn-ghost" style={{ padding:'10px 14px' }}>⚽ GIF</button>
            <button onClick={send} className="btn-yellow">ENVIAR →</button>
          </div>
        </div>

        {/* right rail — provocações */}
        <div style={{ padding:'18px 24px', background:'var(--paper-deep)' }}>
          <Eyebrow>PROVOCAÇÕES OFICIAIS</Eyebrow>
          <div style={{ height:8 }}/>
          <div style={{ padding:'14px', background:'var(--paper-white)', border:'1.5px dashed var(--ink)', borderRadius:12, textAlign:'center', marginBottom:14 }}>
            <div style={{ fontSize:32 }}>🤐</div>
            <div className="display" style={{ fontSize:18, lineHeight:.9, marginTop:8 }}>NENHUMA<br/>APOSTA PÚBLICA</div>
            <div className="serif-it" style={{ fontSize:13, color:'var(--ink-3)', marginTop:6, lineHeight:1.4 }}>
              As provocações aparecem aqui quando alguém tiver coragem.
            </div>
          </div>
          <div className="mono" style={{ fontSize:10, letterSpacing:'.14em', opacity:.5, textAlign:'center' }}>
            COMO FAZER UMA APOSTA PÚBLICA:<br/>Manda no #geral com 🎯
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { RankingMobile, RankingDesktop, ResenhaMobile, ResenhaDesktop, ChatBubble });
