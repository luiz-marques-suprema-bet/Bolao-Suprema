/* global React, Logo, Flag, Stamp, T, ME, LIVE, UPCOMING, RANKING, PAST, Marquee, Eyebrow, Avatar, MobileNav, DesktopNav */

/* =========================================================
   HOME — Mobile (cinematic feed)
   ========================================================= */
function HomeMobile({ onNav }){
  return (
    <div style={{ height:'100%', display:'flex', flexDirection:'column', background:'var(--paper)' }}>
      <div style={{ flex:1, overflow:'auto' }} className="paper-grain">
        {/* top bar */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 18px' }}>
          <Logo height={26}/>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <span className="badge" style={{ background:'var(--ink)', color:'var(--paper-white)' }}><span className="dot-live"/> AO VIVO</span>
            <span className="avatar" style={{ width:30, height:30, fontSize:11, background:'var(--yellow)' }}>FS</span>
          </div>
        </div>

        {/* live hero */}
        <div style={{ margin:'6px 14px 0', borderRadius:14, overflow:'hidden', position:'relative', height:280, border:'1.5px solid var(--ink)' }}>
          <div className="pitch-turf" style={{ position:'absolute', inset:0 }}/>
          <img src="assets/hero-portrait.webp" alt="" style={{
            position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', objectPosition:'center 25%', opacity:.55, mixBlendMode:'screen'
          }}/>
          <div style={{ position:'absolute', inset:0, background:'linear-gradient(180deg, rgba(0,0,0,.1), rgba(0,0,0,.6))' }}/>

          <div style={{ position:'absolute', inset:0, padding:14, display:'flex', flexDirection:'column', color:'var(--paper-white)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span className="badge" style={{ background:'var(--red)', color:'var(--paper-white)' }}><span className="dot-live" style={{ background:'var(--paper-white)' }}/> AO VIVO · {LIVE.minute}</span>
              <span className="mono" style={{ fontSize:10, letterSpacing:'.16em', opacity:.85 }}>OITAVAS · GRUPO F vs G</span>
            </div>

            <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:14 }}>
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
                <Flag team={LIVE.home} size={56} ring/>
                <span className="mono" style={{ fontSize:11, letterSpacing:'.14em' }}>{LIVE.home.code}</span>
              </div>
              <div className="display" style={{ fontSize:88, lineHeight:.85 }}>{LIVE.homeScore}<span style={{ opacity:.5 }}>:</span>{LIVE.awayScore}</div>
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
                <Flag team={LIVE.away} size={56} ring/>
                <span className="mono" style={{ fontSize:11, letterSpacing:'.14em' }}>{LIVE.away.code}</span>
              </div>
            </div>

            <div style={{
              background:'rgba(255,252,245,.12)', backdropFilter:'blur(10px)',
              border:'1px solid rgba(255,252,245,.18)', borderRadius:10, padding:'8px 12px',
              display:'flex', justifyContent:'space-between', alignItems:'center'
            }}>
              <div>
                <div className="mono" style={{ fontSize:9, letterSpacing:'.18em', opacity:.8 }}>SEU PALPITE</div>
                <div className="display" style={{ fontSize:18 }}>{LIVE.yourPick.home}–{LIVE.yourPick.away}</div>
              </div>
              <div style={{ textAlign:'right' }}>
                <div className="mono" style={{ fontSize:9, letterSpacing:'.18em', opacity:.8 }}>SE FICAR ASSIM</div>
                <div className="display" style={{ fontSize:18, color:'var(--yellow)' }}>+3 PTS</div>
              </div>
            </div>
          </div>
        </div>

        {/* you-card */}
        <div style={{ margin:'14px 14px 0', padding:'14px', background:'var(--ink)', color:'var(--paper-white)', borderRadius:14, display:'flex', alignItems:'center', gap:12 }}>
          <span className="avatar" style={{ width:48, height:48, background:'var(--yellow)', color:'var(--ink)' }}>FS</span>
          <div style={{ flex:1 }}>
            <div className="mono" style={{ fontSize:9, letterSpacing:'.18em', opacity:.7 }}>VOCÊ · 6º LUGAR · +3 ESSA SEMANA</div>
            <div className="display" style={{ fontSize:24, lineHeight:.96 }}>1.204 PTS</div>
          </div>
          <button onClick={()=>onNav('ranking')} className="mono" style={{ fontSize:10, letterSpacing:'.16em', padding:'8px 12px', border:'1px solid rgba(255,252,245,.3)', borderRadius:999 }}>RANKING →</button>
        </div>

        {/* CTA palpite */}
        <div style={{ margin:'14px 14px 0', padding:14, background:'var(--yellow)', borderRadius:14, border:'1.5px solid var(--ink)', display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ flex:1 }}>
            <div className="mono" style={{ fontSize:9, letterSpacing:'.18em' }}>PRAZO · FECHA EM 2H 14MIN</div>
            <div className="display" style={{ fontSize:22, lineHeight:.95 }}>2 jogos<br/>esperando<br/>seu palpite.</div>
          </div>
          <button onClick={()=>onNav('prediction')} className="btn-ink">PALPITAR →</button>
        </div>

        {/* bracket peek */}
        <div style={{ margin:'18px 14px 0' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:8 }}>
            <span className="display" style={{ fontSize:30 }}>A CHAVE.</span>
            <button onClick={()=>onNav('bracket')} className="mono" style={{ fontSize:10, letterSpacing:'.16em' }}>VER COMPLETA →</button>
          </div>
          <div style={{ background:'var(--paper-white)', border:'1.5px solid var(--ink)', borderRadius:14, padding:12 }}>
            <div className="mono" style={{ fontSize:10, letterSpacing:'.14em', opacity:.6, marginBottom:8 }}>OITAVAS · 8 JOGOS · 5 CONFIRMADOS</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:8 }}>
              {[
                [T.BRA, T.MAR, '2','1','✓ 5pt'],
                [T.ARG, T.AUS, '3','0','✓ 0pt'],
                [T.FRA, T.SEN, '1','0','✓ 10pt'],
                [T.POR, T.URU, '1','1','LIVE'],
              ].map(([h,a,hs,as_,note], i)=>(
                <div key={i} style={{ border:'1px solid var(--hairline)', borderRadius:8, padding:8 }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:6 }}>
                    <Flag team={h} size={20}/>
                    <span className="mono" style={{ fontSize:11 }}>{h.code}</span>
                    <span className="display" style={{ fontSize:18, marginLeft:'auto' }}>{hs}</span>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:6, marginTop:4 }}>
                    <Flag team={a} size={20}/>
                    <span className="mono" style={{ fontSize:11 }}>{a.code}</span>
                    <span className="display" style={{ fontSize:18, marginLeft:'auto' }}>{as_}</span>
                  </div>
                  <div className="mono" style={{ fontSize:9, letterSpacing:'.14em', marginTop:6,
                    color: note === 'LIVE' ? 'var(--red)' : note.includes('10') ? 'var(--green-deep)' : note.includes('0pt') ? 'var(--ink-3)' : 'var(--ink)'}}>
                    {note === 'LIVE' ? <><span className="dot-live" style={{ marginRight:4 }}/> AO VIVO</> : note}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* resenha peek — empty state */}
        <div style={{ margin:'18px 14px 0' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:8 }}>
            <span className="display" style={{ fontSize:30 }}>RESENHA.</span>
            <button onClick={()=>onNav('resenha')} className="mono" style={{ fontSize:10, letterSpacing:'.16em' }}>ENTRAR →</button>
          </div>
          <div style={{ background:'var(--paper-white)', border:'1.5px solid var(--ink)', borderRadius:14, padding:18 }}>
            <div style={{ textAlign:'center', padding:'8px 0 14px' }}>
              <div style={{ fontSize:36 }}>⚽</div>
              <div className="display" style={{ fontSize:22, lineHeight:.95, marginTop:8 }}>NINGUÉM<br/>FALOU NADA.</div>
              <div className="serif-it" style={{ fontSize:14, color:'var(--ink-3)', marginTop:6, lineHeight:1.4 }}>
                87 colegas inscritos.<br/>Silêncio total. Isso é histórico.
              </div>
            </div>
            <button onClick={()=>onNav('resenha')} className="btn-yellow" style={{ width:'100%', justifyContent:'center' }}>
              ABRE O JOGO →
            </button>
          </div>
        </div>

        {/* how it works */}
        <div style={{ margin:'18px 14px 0' }}>
          <div style={{ background:'var(--paper-deep)', border:'1.5px solid var(--ink)', borderRadius:14, padding:16, display:'flex', alignItems:'center', gap:14 }}>
            <div style={{ fontSize:32 }}>📋</div>
            <div style={{ flex:1 }}>
              <div className="mono" style={{ fontSize:10, letterSpacing:'.14em', opacity:.6 }}>NOVO POR AQUI?</div>
              <div className="display" style={{ fontSize:18, lineHeight:.95, marginTop:2 }}>COMO FUNCIONA</div>
              <div style={{ fontSize:12, color:'var(--ink-3)', marginTop:2 }}>Regras em 30 segundos.</div>
            </div>
            <button onClick={()=>onNav('onboarding')} className="btn-ghost" style={{ padding:'8px 12px', fontSize:11, flexShrink:0 }}>VER →</button>
          </div>
        </div>

        {/* friends activity */}
        <div style={{ margin:'18px 14px 18px' }}>
          <Eyebrow num="03" sub="HOJE">A FIRMA TÁ PALPITANDO</Eyebrow>
          <div style={{ height:8 }}/>
          <div style={{ background:'var(--paper-white)', border:'1.5px solid var(--ink)', borderRadius:14 }}>
            {[
              ['Lucas Mendes','#00A651','LM','palpitou 2x1 em','BRA','vs','MAR','2min'],
              ['Bia Yamashita','#1D3557','BY','palpitou empate em','POR','vs','URU','5min'],
              ['Renan Albuq.','#E63946','RA','reagiu 🔥 ao palpite do','Mathzi','','','12min'],
            ].map((row, i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 14px', borderTop: i? '1px dashed rgba(13,13,13,.15)':'none' }}>
                <span className="avatar" style={{ width:32, height:32, fontSize:11, background: row[1] }}>{row[2]}</span>
                <div style={{ flex:1, fontSize:13, lineHeight:1.3 }}>
                  <strong>{row[0]}</strong> <span style={{ color:'var(--ink-3)' }}>{row[3]}</span> <span style={{ fontWeight:700 }}>{row[4]}{row[5]?` ${row[5]} `:''}{row[6]}</span>
                </div>
                <span className="mono" style={{ fontSize:9, letterSpacing:'.14em', opacity:.5 }}>{row[7]}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ height:8 }}/>
      </div>

      <MobileNav current="home" onNav={onNav}/>
    </div>
  );
}

/* =========================================================
   HOME — Desktop (editorial broadsheet)
   ========================================================= */
function HomeDesktop({ onNav }){
  return (
    <div style={{ background:'var(--paper)', minHeight:'100%', display:'flex', flexDirection:'column' }} className="paper-grain">
      <DesktopNav current="home" onNav={onNav}/>

      {/* mast */}
      <div style={{ display:'flex', alignItems:'center', gap:24, padding:'14px 32px', borderBottom:'1.5px solid var(--ink)' }}>
        <span className="mono" style={{ fontSize:11, letterSpacing:'.18em' }}>03 · JUL · 2026 · SEX</span>
        <span className="mono" style={{ fontSize:11, letterSpacing:'.18em' }}>EDIÇÃO Nº 04 · OITAVAS</span>
        <div style={{ flex:1 }}/>
        <span className="mono" style={{ fontSize:11, letterSpacing:'.18em', display:'flex', gap:8, alignItems:'center' }}>
          <span className="dot-live"/> POR 1 — 1 URU · {LIVE.minute}
        </span>
        <span className="mono" style={{ fontSize:11, letterSpacing:'.18em', opacity:.6 }}>POOL: 87 JOGADORES</span>
        <button onClick={()=>onNav('onboarding')} className="btn-ghost" style={{ padding:'6px 12px', fontSize:11 }}>COMO FUNCIONA →</button>
      </div>

      {/* huge masthead with logo as art */}
      <div style={{ padding:'14px 32px 6px', display:'flex', alignItems:'flex-end', justifyContent:'space-between', borderBottom:'1.5px solid var(--ink)' }}>
        <Logo height={68}/>
        <div className="serif-it" style={{ fontSize:28, color:'var(--green-deep)' }}>boletim oficial · oitavas de final</div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <Stamp color="var(--ink)" rot={-2}>edição '26</Stamp>
        </div>
      </div>

      {/* hero grid */}
      <div style={{ display:'grid', gridTemplateColumns:'1.4fr 1fr 1fr', borderBottom:'1.5px solid var(--ink)' }}>
        {/* live hero */}
        <div style={{ padding:'24px 28px', borderRight:'1.5px solid var(--ink)' }}>
          <div className="eyebrow" style={{ color:'var(--red)' }}>● MATCH AO VIVO · OITAVAS Nº 5</div>
          <h2 className="display" style={{ fontSize:'clamp(44px, 4.4vw, 68px)', lineHeight:.88, margin:'8px 0 0', color:'var(--ink)' }}>
            EMPATA EMPATA,<br/>VAI PROS <span style={{ color:'var(--green-deep)' }}>PÊNALTIS?</span>
          </h2>
          <p className="serif-it" style={{ fontSize:18, margin:'10px 0 0', color:'var(--ink-2)' }}>
            68 minutos jogados, ninguém quer perder. {LIVE.home.name} e {LIVE.away.name} se anulam num jogo travado, e a firma toda já tá no chat.
          </p>
          <div style={{ height:18 }}/>
          <div style={{ display:'flex', alignItems:'center', gap:18, padding:'18px 22px', background:'var(--ink)', color:'var(--paper-white)', borderRadius:16, position:'relative', overflow:'hidden' }}>
            <div className="pitch-turf" style={{ position:'absolute', inset:0, opacity:.4 }}/>
            <div style={{ position:'relative', display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
              <Flag team={LIVE.home} size={64} ring/>
              <div className="display" style={{ fontSize:18 }}>{LIVE.home.code}</div>
            </div>
            <div style={{ position:'relative', flex:1, textAlign:'center' }}>
              <div className="display" style={{ fontSize:96, lineHeight:.86, color:'var(--paper-white)' }}>
                {LIVE.homeScore}<span style={{ opacity:.4 }}>—</span>{LIVE.awayScore}
              </div>
              <div className="mono" style={{ fontSize:11, letterSpacing:'.18em', opacity:.7, marginTop:4 }}>{LIVE.minute} · 2T</div>
            </div>
            <div style={{ position:'relative', display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
              <Flag team={LIVE.away} size={64} ring/>
              <div className="display" style={{ fontSize:18 }}>{LIVE.away.code}</div>
            </div>
          </div>
          <div style={{ marginTop:14, display:'flex', gap:10 }}>
            <PickPill label="seu palpite" value={`${LIVE.yourPick.home}–${LIVE.yourPick.away}`} accent="var(--yellow)"/>
            <PickPill label="se ficar assim" value="+3 pts"/>
            <PickPill label="bolão palpitou" value="empate · 28%"/>
            <button onClick={()=>onNav('bracket')} className="btn-ghost" style={{ marginLeft:'auto' }}>VER PRÓXIMO →</button>
          </div>
        </div>

        {/* you card */}
        <div style={{ padding:'24px 28px', borderRight:'1.5px solid var(--ink)', background:'var(--ink)', color:'var(--paper-white)', position:'relative', overflow:'hidden' }}>
          <div className="eyebrow" style={{ color:'var(--yellow)' }}>VOCÊ · NA TABELA</div>
          <div style={{ display:'flex', alignItems:'baseline', gap:12, marginTop:6 }}>
            <span className="display" style={{ fontSize:120, lineHeight:.85 }}>06</span>
            <span className="serif-it" style={{ fontSize:24, color:'var(--yellow)' }}>º</span>
          </div>
          <div className="display" style={{ fontSize:34, lineHeight:.95, marginTop:4 }}>1.204 pts</div>
          <div className="mono" style={{ fontSize:11, letterSpacing:'.16em', opacity:.7, marginTop:4 }}>+3 NA SEMANA · 5 ACERTOS EXATOS</div>
          <div style={{ height:14 }}/>
          <div style={{ borderTop:'1px dashed rgba(255,252,245,.3)', paddingTop:12 }}>
            <div className="mono" style={{ fontSize:10, letterSpacing:'.18em', opacity:.7, marginBottom:6 }}>FALTAM PRO PÓDIO</div>
            <div className="display" style={{ fontSize:30 }}>44 PTS</div>
            <div className="mono" style={{ fontSize:10, letterSpacing:'.14em', opacity:.65, marginTop:4 }}>↳ 5 PALPITES EXATOS RESOLVEM</div>
          </div>
          <div style={{ flex:1 }}/>
          <button onClick={()=>onNav('ranking')} className="btn-yellow" style={{ marginTop:18, alignSelf:'flex-start' }}>ABRIR RANKING →</button>
        </div>

        {/* CTA palpite + photo */}
        <div style={{ position:'relative', overflow:'hidden' }}>
          <div className="stripe-bg" style={{ position:'absolute', inset:0, opacity:.95 }}/>
          <img src="assets/hero-jogadores.webp" alt="" style={{
            position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', objectPosition:'right 30%'
          }}/>
          <div style={{ position:'absolute', inset:0, background:'linear-gradient(180deg, rgba(0,0,0,.0) 30%, rgba(0,0,0,.7))' }}/>
          <div style={{ position:'relative', height:'100%', padding:24, display:'flex', flexDirection:'column', color:'var(--paper-white)' }}>
            <Stamp color="var(--paper-white)" rot={-3}>fecha em 2h 14min</Stamp>
            <div style={{ flex:1 }}/>
            <h2 className="display" style={{ fontSize:54, lineHeight:.85, margin:0 }}>2 JOGOS<br/>SEM<br/>PALPITE.</h2>
            <p className="serif-it" style={{ fontSize:18, marginTop:10, opacity:.95 }}>esquece e perde 20 pts. <strong>fácil assim.</strong></p>
            <button onClick={()=>onNav('prediction')} className="btn-yellow" style={{ marginTop:14, alignSelf:'flex-start' }}>
              PALPITAR AGORA →
            </button>
          </div>
        </div>
      </div>

      {/* pool stats */}
      <div style={{ display:'grid', gridTemplateColumns:'1.6fr 1fr 1fr', borderBottom:'1.5px solid var(--ink)' }}>
        <div style={{ padding:'20px 28px', borderRight:'1.5px solid var(--ink)' }}>
          <Eyebrow num="04" sub="OITAVAS · CAMPO TODO">PRÓXIMOS NA AGENDA</Eyebrow>
          <div style={{ height:12 }}/>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:10 }}>
            {UPCOMING.slice(0,4).map(m => (
              <div key={m.id} style={{ border:'1.5px solid var(--ink)', borderRadius:10, padding:'12px 14px', background:'var(--paper-white)' }}>
                <div className="mono" style={{ fontSize:10, letterSpacing:'.14em', opacity:.6 }}>{m.stage} · {m.date} · {m.time}</div>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:8 }}>
                  <Flag team={m.home} size={36}/>
                  <div className="display" style={{ fontSize:22, flex:1 }}>{m.home.name}</div>
                  <span className="mono" style={{ fontSize:11, opacity:.5 }}>vs</span>
                  <div className="display" style={{ fontSize:22, flex:1, textAlign:'right' }}>{m.away.name}</div>
                  <Flag team={m.away} size={36}/>
                </div>
                {m.yourPick ? (
                  <div className="mono" style={{ fontSize:10, letterSpacing:'.14em', marginTop:8, color:'var(--green-deep)' }}>
                    ✓ SEU PALPITE: {m.yourPick.home}–{m.yourPick.away}
                  </div>
                ) : (
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:8 }}>
                    <div className="mono" style={{ fontSize:10, letterSpacing:'.14em', color:'var(--red)' }}>
                      ⚠ SEM PALPITE
                    </div>
                    <button onClick={()=>onNav('prediction')} className="mono" style={{ fontSize:10, letterSpacing:'.14em', color:'var(--green-deep)', fontWeight:700 }}>PALPITAR →</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        <div style={{ padding:'20px 28px', borderRight:'1.5px solid var(--ink)' }}>
          <Eyebrow num="05">RANKING · TOP 6</Eyebrow>
          <div style={{ height:12 }}/>
          {RANKING.slice(0,6).map((p, i) => (
            <div key={p.rank} style={{
              display:'flex', alignItems:'center', gap:10,
              padding: p.isYou ? '8px 10px' : '8px 0',
              borderBottom:'1px dashed rgba(13,13,13,.15)',
              background: p.isYou ? 'var(--yellow)' : 'transparent',
              margin: p.isYou ? '0 -10px' : 0,
              borderRadius: p.isYou ? 6 : 0,
            }}>
              <span className="display" style={{ fontSize:22, width:30 }}>{String(p.rank).padStart(2,'0')}</span>
              <Avatar p={p} size={32}/>
              <div style={{ flex:1, fontSize:13, fontWeight: p.isYou ? 700 : 500 }}>{p.name}</div>
              <span className="mono" style={{ fontSize:11, opacity:.6 }}>{p.mov}</span>
              <span className="display" style={{ fontSize:18 }}>{p.pts}</span>
            </div>
          ))}
          <button onClick={()=>onNav('ranking')} className="btn-ghost" style={{ marginTop:10, padding:'8px 12px', fontSize:11 }}>VER TODOS →</button>
        </div>
        <div style={{ padding:'20px 28px' }}>
          <Eyebrow num="06">RESENHA · CANAL #GERAL</Eyebrow>
          <div style={{ height:12 }}/>
          {/* empty state — no fake messages */}
          <div style={{
            display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
            padding:'28px 16px', border:'1.5px dashed var(--ink)', borderRadius:12,
            background:'var(--paper-white)', textAlign:'center', gap:8
          }}>
            <div style={{ fontSize:32 }}>⚽</div>
            <div className="display" style={{ fontSize:22, lineHeight:.9 }}>SILÊNCIO<br/>TOTAL.</div>
            <div className="serif-it" style={{ fontSize:14, color:'var(--ink-3)', lineHeight:1.4 }}>
              87 colegas inscritos.<br/>Ninguém falou nada ainda.
            </div>
            <div className="mono" style={{ fontSize:10, letterSpacing:'.14em', opacity:.6 }}>
              isso é histórico.
            </div>
          </div>
          <button onClick={()=>onNav('resenha')} className="btn-ghost" style={{ marginTop:10, padding:'8px 12px', fontSize:11 }}>ENTRAR NA RESENHA →</button>
        </div>
      </div>

      <Marquee items={[
        "BRA 2 — 1 MAR · GANHOU O LUCAS",
        "FRA 1 — 0 SEN · BIA ACERTOU EXATO · +10",
        "POR 1 — 1 URU · LIVE",
        "ARG 3 — 0 AUS · 47 ACERTOS NO POOL",
        "PRAZO DAS OITAVAS FECHA EM 02H 14MIN",
      ]}/>
    </div>
  );
}

function PickPill({ label, value, accent }){
  return (
    <div style={{
      padding:'8px 14px', border:'1.5px solid var(--ink)', borderRadius:12,
      background: accent || 'var(--paper-white)',
      color:'var(--ink)',
      display:'flex', flexDirection:'column', minWidth: 0
    }}>
      <span className="mono" style={{ fontSize:9, letterSpacing:'.14em', color:'var(--ink-3)' }}>{label.toUpperCase()}</span>
      <span className="display" style={{ fontSize:16, color:'var(--ink)', whiteSpace:'nowrap' }}>{value}</span>
    </div>
  );
}

Object.assign(window, { HomeMobile, HomeDesktop, PickPill });
