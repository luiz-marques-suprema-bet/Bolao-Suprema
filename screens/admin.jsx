/* global React, Flag, Avatar, Stamp, T, RANKING, UPCOMING, Eyebrow, MobileNav */

/* =========================================================
   ADMIN — Desktop dashboard (premium sports-oriented)
   ========================================================= */
function AdminDesktop({ onNav }){
  return (
    <div style={{ background:'var(--paper)', minHeight:'100%' }} className="paper-grain">
      {/* admin-only nav bar — different from player nav */}
      <div style={{
        display:'flex', alignItems:'center', gap:16, padding:'14px 32px',
        borderBottom:'1.5px solid var(--ink)', background:'var(--ink)', color:'var(--paper-white)'
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:20 }}>⚙️</span>
          <span className="mono" style={{ fontSize:11, letterSpacing:'.18em', color:'var(--yellow)' }}>PAINEL ADMIN</span>
          <span className="mono" style={{ fontSize:11, letterSpacing:'.14em', opacity:.5 }}>· RESTRITO RH</span>
        </div>
        <div style={{ flex:1 }}/>
        <button onClick={()=>onNav('home')} className="mono" style={{
          fontSize:11, letterSpacing:'.14em', padding:'8px 14px',
          border:'1px solid rgba(255,252,245,.3)', borderRadius:999,
          color:'var(--paper-white)'
        }}>← VOLTAR AO BOLÃO</button>
      </div>

      <div style={{ padding:'18px 32px', borderBottom:'1.5px solid var(--ink)', display:'flex', alignItems:'flex-end', justifyContent:'space-between' }}>
        <div>
          <span className="eyebrow" style={{ opacity:.6 }}>SEÇÃO 06 · CONTROLE DA FIRMA</span>
          <h1 className="display" style={{ fontSize:'clamp(60px, 7vw, 110px)', lineHeight:.86, margin:'4px 0 0' }}>
            ADMIN.<span className="serif-it" style={{ fontSize:30, color:'var(--green-deep)' }}> só pra galera do RH.</span>
          </h1>
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <button className="btn-ghost">EXPORTAR CSV</button>
          <button className="btn-yellow">ABRIR PRÓXIMA RODADA</button>
        </div>
      </div>

      {/* KPI strip */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', borderBottom:'1.5px solid var(--ink)' }}>
        {[
          ['87','jogadores ativos','+4 essa semana'],
          ['412','palpites enviados','94% taxa'],
          ['8/8','jogos das oitavas','5 fechados'],
          ['1.284','pontos · líder','LUCAS MENDES'],
          ['—', 'palpites mico','7 zerados']
        ].map(([n,l,sub], i) => (
          <div key={i} style={{
            padding:'18px 22px', borderRight: i < 4 ? '1.5px solid var(--ink)' : 'none',
            display:'flex', flexDirection:'column'
          }}>
            <div className="mono" style={{ fontSize:10, letterSpacing:'.18em', opacity:.6 }}>{l.toUpperCase()}</div>
            <div className="display" style={{ fontSize:54, lineHeight:.9, marginTop:6 }}>{n}</div>
            <div className="mono" style={{ fontSize:10, letterSpacing:'.14em', opacity:.55, marginTop:4 }}>↳ {sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1.4fr 1fr' }}>
        {/* matches table */}
        <div style={{ padding:'24px 32px', borderRight:'1.5px solid var(--ink)' }}>
          <Eyebrow num="01">CONTROLE DE JOGOS · OITAVAS</Eyebrow>
          <div style={{ height:14 }}/>
          <div style={{ background:'var(--paper-white)', border:'1.5px solid var(--ink)', borderRadius:12, overflow:'hidden' }}>
            <div style={{
              display:'grid', gridTemplateColumns:'2fr 1.2fr 1fr 1fr 1fr 1fr',
              padding:'10px 14px', background:'var(--paper-deep)', borderBottom:'1.5px solid var(--ink)',
              fontFamily:'var(--mono)', fontSize:10, letterSpacing:'.14em', textTransform:'uppercase', fontWeight:600
            }}>
              <div>jogo</div><div>data</div><div>palpites</div><div>resultado</div><div>status</div><div style={{ textAlign:'right' }}>ação</div>
            </div>
            {[
              [T.BRA, T.MAR, '03 JUL · 16:00', 87, '2–1', 'ENCERRADO', 'green'],
              [T.ARG, T.AUS, '03 JUL · 20:00', 87, '3–0', 'ENCERRADO', 'green'],
              [T.FRA, T.SEN, '04 JUL · 13:00', 86, '1–0', 'ENCERRADO', 'green'],
              [T.ESP, T.JPN, '04 JUL · 17:00', 84, '2–2 (PEN)', 'ENCERRADO', 'green'],
              [T.POR, T.URU, '04 JUL · 21:00', 81, '1–1', 'AO VIVO', 'red'],
              [T.GER, T.MEX, '05 JUL · 15:00', 79, '—', 'ABERTO', 'yellow'],
              [T.NED, T.CAN, '05 JUL · 19:00', 64, '—', 'ABERTO', 'yellow'],
              [T.ENG, T.KSA, '06 JUL · 16:00', 32, '—', 'ABERTO', 'yellow'],
            ].map((row, i) => {
              const [h, a, d, n, score, status, sc] = row;
              const colors = { green:'var(--green-deep)', red:'var(--red)', yellow:'var(--yellow-deep)' };
              return (
                <div key={i} style={{
                  display:'grid', gridTemplateColumns:'2fr 1.2fr 1fr 1fr 1fr 1fr',
                  padding:'12px 14px', alignItems:'center',
                  borderTop: i ? '1px dashed rgba(13,13,13,.12)' : 'none',
                  background: status === 'AO VIVO' ? 'rgba(230,57,70,.05)' : 'transparent'
                }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <Flag team={h} size={22}/>
                    <span style={{ fontWeight:700, fontSize:13 }}>{h.code} × {a.code}</span>
                    <Flag team={a} size={22}/>
                  </div>
                  <div className="mono" style={{ fontSize:11, opacity:.7 }}>{d}</div>
                  <div className="display" style={{ fontSize:18 }}>{n}</div>
                  <div className="display" style={{ fontSize:18 }}>{score}</div>
                  <div className="mono" style={{ fontSize:10, letterSpacing:'.14em', color: colors[sc], fontWeight:700 }}>
                    {sc === 'red' && <span className="dot-live" style={{ marginRight:6 }}/>}{status}
                  </div>
                  <div style={{ textAlign:'right' }}>
                    {status === 'ABERTO' ? (
                      <button className="btn-ghost" style={{ padding:'6px 10px', fontSize:10 }}>FECHAR</button>
                    ) : status === 'AO VIVO' ? (
                      <button style={{ ...adminPillStyle, background:'var(--red)', color:'#fff', border:'1px solid var(--red)' }}>ENCERRAR</button>
                    ) : (
                      <button className="mono" style={{ fontSize:10, letterSpacing:'.14em', opacity:.6 }}>VER PALPITES →</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ height:24 }}/>
          <Eyebrow num="02">REGRAS & PONTUAÇÃO · EDITÁVEL</Eyebrow>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginTop:14 }}>
            {[['+3','vencedor'],['+5','vencedor + diferença'],['+10','placar exato'],['+50','campeão']].map(([n,l],i)=>(
              <div key={i} style={{ background:'var(--paper-white)', border:'1.5px solid var(--ink)', borderRadius:10, padding:14 }}>
                <div className="display" style={{ fontSize:36, color:'var(--green-deep)' }}>{n}</div>
                <div style={{ fontSize:13, fontWeight:600 }}>{l}</div>
                <button className="mono" style={{ fontSize:10, letterSpacing:'.14em', marginTop:8, opacity:.6 }}>EDITAR ▸</button>
              </div>
            ))}
          </div>
        </div>

        {/* sidebar */}
        <div style={{ padding:'24px 32px', display:'flex', flexDirection:'column', gap:18 }}>
          <Eyebrow num="03">JOGADORES SEM PALPITE · LEMBRAR</Eyebrow>
          <div style={{ background:'var(--paper-white)', border:'1.5px solid var(--ink)', borderRadius:12 }}>
            {RANKING.slice(8,12).map((p, i) => (
              <div key={p.rank} style={{
                display:'flex', alignItems:'center', gap:10, padding:'12px 14px',
                borderTop: i ? '1px dashed rgba(13,13,13,.12)' : 'none'
              }}>
                <Avatar p={p} size={32}/>
                <div style={{ flex:1, fontSize:13 }}>
                  <div style={{ fontWeight:700 }}>{p.name}</div>
                  <div className="mono" style={{ fontSize:10, letterSpacing:'.14em', opacity:.55 }}>{p.dept.toUpperCase()} · 3 EM ABERTO</div>
                </div>
                <button className="btn-ghost" style={{ padding:'6px 10px', fontSize:10 }}>CUTUCAR ←</button>
              </div>
            ))}
          </div>

          <Eyebrow num="04">ATIVIDADE · ÚLTIMAS 24H</Eyebrow>
          <div style={{ background:'var(--paper-white)', border:'1.5px solid var(--ink)', borderRadius:12, padding:18 }}>
            <ChartBars/>
          </div>

          <Eyebrow num="05">AVISOS DA FIRMA</Eyebrow>
          <div style={{ background:'var(--ink)', color:'var(--paper-white)', borderRadius:12, padding:18 }}>
            <div className="mono" style={{ fontSize:10, letterSpacing:'.18em', opacity:.7 }}>BROADCAST · ATINGE 87 PESSOAS</div>
            <textarea defaultValue="Lembrete: prazo dos palpites das oitavas fecha 30min antes do 1º jogo. Ninguém pode esquecer." style={{
              width:'100%', minHeight:80, marginTop:10,
              background:'rgba(255,252,245,.06)', border:'1px solid rgba(255,252,245,.18)',
              color:'var(--paper-white)', fontFamily:'var(--sans)', fontSize:13, padding:10, borderRadius:8, resize:'none'
            }}/>
            <div style={{ display:'flex', gap:10, marginTop:10 }}>
              <button className="mono" style={{ fontSize:11, letterSpacing:'.14em', padding:'8px 12px', border:'1px solid rgba(255,252,245,.3)', borderRadius:999 }}>CANCELAR</button>
              <button className="btn-yellow" style={{ flex:1, justifyContent:'center' }}>ENVIAR →</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const adminPillStyle = {
  padding:'6px 12px', borderRadius:999, fontFamily:'var(--mono)',
  fontSize:10, letterSpacing:'.14em', textTransform:'uppercase', fontWeight:700, border:'1px solid var(--ink)'
};

function ChartBars(){
  const data = [22, 35, 41, 28, 64, 81, 47, 31, 24, 38, 52, 29];
  const max = Math.max(...data);
  return (
    <div>
      <div className="mono" style={{ fontSize:10, letterSpacing:'.14em', opacity:.6, marginBottom:10 }}>PALPITES POR HORA · ÚLT. 12H</div>
      <div style={{ display:'flex', alignItems:'flex-end', gap:6, height:120 }}>
        {data.map((v,i) => (
          <div key={i} style={{ flex:1, height: `${(v/max)*100}%`, background: i === 5 || i === 6 ? 'var(--yellow)' : 'var(--ink)', borderRadius:'4px 4px 0 0' }}/>
        ))}
      </div>
      <div style={{ display:'flex', justifyContent:'space-between', marginTop:6 }} className="mono">
        <span style={{ fontSize:9, opacity:.5 }}>02h</span>
        <span style={{ fontSize:9, opacity:.5 }}>14h</span>
      </div>
    </div>
  );
}

/* =========================================================
   ADMIN — Mobile (compact panel)
   ========================================================= */
function AdminMobile({ onNav }){
  return (
    <div style={{ height:'100%', display:'flex', flexDirection:'column', background:'var(--paper)' }}>
      {/* admin-only header */}
      <div style={{
        padding:'12px 18px', background:'var(--ink)', color:'var(--paper-white)',
        display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0
      }}>
        <div>
          <div className="mono" style={{ fontSize:9, letterSpacing:'.18em', color:'var(--yellow)' }}>⚙️ PAINEL ADMIN · RESTRITO RH</div>
          <div className="display" style={{ fontSize:22 }}>CONTROLE.</div>
        </div>
        <button onClick={()=>onNav('home')} className="mono" style={{
          fontSize:10, letterSpacing:'.14em', padding:'8px 12px',
          border:'1px solid rgba(255,252,245,.3)', borderRadius:999, color:'var(--paper-white)'
        }}>← BOLÃO</button>
      </div>

      <div style={{ flex:1, overflow:'auto' }} className="paper-grain">
        <div style={{ padding:'14px 14px 8px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
          {[['87','jogadores'],['412','palpites'],['8/8','jogos'],['1.284','líder']].map(([n,l],i)=>(
            <div key={i} style={{ background:'var(--paper-white)', border:'1.5px solid var(--ink)', borderRadius:10, padding:'12px 14px' }}>
              <div className="mono" style={{ fontSize:10, letterSpacing:'.18em', opacity:.6 }}>{l.toUpperCase()}</div>
              <div className="display" style={{ fontSize:32, lineHeight:.9, marginTop:4 }}>{n}</div>
            </div>
          ))}
        </div>

        <div style={{ padding:'8px 14px' }}>
          <div className="mono" style={{ fontSize:10, letterSpacing:'.18em', marginBottom:8, opacity:.6 }}>JOGOS · STATUS</div>
          <div style={{ background:'var(--paper-white)', border:'1.5px solid var(--ink)', borderRadius:12, overflow:'hidden' }}>
            {[
              [T.POR, T.URU, '1–1', 'AO VIVO', 'red'],
              [T.GER, T.MEX, '—', 'ABERTO', 'yellow'],
              [T.NED, T.CAN, '—', 'ABERTO', 'yellow'],
            ].map((r,i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 14px', borderTop: i? '1px dashed rgba(13,13,13,.12)':'none' }}>
                <Flag team={r[0]} size={22}/>
                <span className="display" style={{ fontSize:14, flex:1 }}>{r[0].code} × {r[1].code}</span>
                <span className="display" style={{ fontSize:18 }}>{r[2]}</span>
                <span className="mono" style={{ fontSize:9, letterSpacing:'.14em', color: r[4]==='red'? 'var(--red)':'var(--yellow-deep)' }}>{r[3]}</span>
              </div>
            ))}
          </div>

          <div style={{ height:14 }}/>
          <button className="btn-yellow" style={{ width:'100%', justifyContent:'center' }}>ABRIR PRÓX. RODADA</button>
          <div style={{ height:8 }}/>
          <button className="btn-ghost" style={{ width:'100%', justifyContent:'center' }}>CUTUCAR 23 ATRASADOS</button>

          <div style={{ height:18 }}/>
          <div className="mono" style={{ fontSize:10, letterSpacing:'.14em', marginBottom:8, opacity:.6 }}>JOGADORES SEM PALPITE</div>
          <div style={{ background:'var(--paper-white)', border:'1.5px solid var(--ink)', borderRadius:12 }}>
            {RANKING.slice(8,12).map((p, i) => (
              <div key={p.rank} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', borderTop: i? '1px dashed rgba(13,13,13,.12)':'none' }}>
                <Avatar p={p} size={28}/>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12, fontWeight:700, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</div>
                  <div className="mono" style={{ fontSize:9, opacity:.55 }}>{p.dept}</div>
                </div>
                <button className="mono" style={{ fontSize:10, letterSpacing:'.12em', padding:'6px 10px', border:'1px solid var(--ink)', borderRadius:999 }}>CUTUCAR</button>
              </div>
            ))}
          </div>
          <div style={{ height:18 }}/>
        </div>
      </div>

      <MobileNav current="admin" onNav={onNav}/>
    </div>
  );
}

Object.assign(window, { AdminDesktop, AdminMobile });
