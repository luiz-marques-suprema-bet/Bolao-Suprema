import { useState } from 'react'
import { Eyebrow } from '@/components/shared/Eyebrow'
import { Flag } from '@/components/shared/Flag'
import { useAuthStore } from '@/stores/auth.store'
import { useChatStore } from '@/stores/chat.store'
import { useIsDesktop } from '@/hooks/useBreakpoint'
import { MOCK_UPCOMING } from '@/data/mock'
import { POINT_RULES } from '@/types'
import { cn } from '@/lib/utils'

// ─── Toast ────────────────────────────────────────────────────────────────────

function useToast() {
  const [msg, setMsg] = useState('')
  const show = (text: string) => {
    setMsg(text)
    setTimeout(() => setMsg(''), 3000)
  }
  return { msg, show }
}

export function AdminScreen() {
  const user = useAuthStore(s => s.user)
  const isDesktop = useIsDesktop()

  if (!user?.isAdmin) {
    return (
      <div className="flex h-dvh items-center justify-center bg-paper flex-col gap-4">
        <span className="font-display text-4xl">✗</span>
        <p className="font-mono text-[12px] tracking-eyebrow text-ink-3">ACESSO RESTRITO · SOMENTE ADMIN</p>
      </div>
    )
  }

  return isDesktop ? <AdminDesktop /> : <AdminMobile />
}

// ─── Mobile ───────────────────────────────────────────────────────────────────

function AdminMobile() {
  const matches = MOCK_UPCOMING.slice(0, 5)
  const { msg: toast, show: showToast } = useToast()

  return (
    <div className="min-h-dvh bg-paper pb-24">
      <div className="px-4 pt-5 pb-3 border-b border-line">
        <div className="flex items-center justify-between">
          <span className="font-display text-3xl">ADMIN</span>
          <span className="font-mono text-[10px] text-ink-4 tracking-eyebrow">BOLÃO DA SUPREMA</span>
        </div>
      </div>

      {/* Status */}
      <div className="px-4 pt-4 pb-2">
        <div className="border-2 border-ink p-4 bg-paper-deep">
          <div className="font-mono text-[10px] tracking-eyebrow text-ink-3 mb-1">STATUS DO TORNEIO</div>
          <div className="font-display text-2xl">PRÉ-TORNEIO</div>
          <div className="font-mono text-[11px] text-ink-3 mt-0.5">Fase de grupos começa em 11 Jun · 15:00</div>
        </div>
      </div>

      <div className="px-4 space-y-3 pt-2">
        {/* Upcoming matches */}
        <div className="border-2 border-ink">
          <div className="px-3 py-2 border-b border-hairline font-mono text-[10px] tracking-eyebrow text-ink-3">
            PRÓXIMAS PARTIDAS
          </div>
          {matches.map(m => (
            <div key={m.id} className="flex items-center gap-3 px-3 py-2.5 border-b border-hairline last:border-0">
              <Flag team={m.home} size={18} />
              <span className="font-mono text-[11px] font-bold">{m.home.code}</span>
              <span className="font-mono text-[10px] text-ink-4">×</span>
              <span className="font-mono text-[11px] font-bold">{m.away.code}</span>
              <Flag team={m.away} size={18} />
              <div className="flex-1 text-right">
                <div className="font-mono text-[10px] text-ink-3">{m.date}</div>
              </div>
              <span className="font-mono text-[9px] font-bold px-2 py-0.5 bg-yellow/60 text-ink">
                AGENDADO
              </span>
            </div>
          ))}
        </div>

        <button
          onClick={() => showToast('⚠ Configure o Supabase para gerenciar status das partidas')}
          className="btn-yellow w-full justify-center"
        >
          ABRIR APOSTAS →
        </button>

        {toast && (
          <div className="border-2 border-ink p-3 font-mono text-[11px] text-ink-3 bg-yellow/20">
            {toast}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Desktop ──────────────────────────────────────────────────────────────────

function AdminDesktop() {
  const user = useAuthStore(s => s.user)
  const addMessage = useChatStore(s => s.addMessage)
  const [broadcast, setBroadcast] = useState('')
  const [broadcastSent, setBroadcastSent] = useState(false)
  const [results, setResults] = useState<Record<string, string>>({})
  const [editingResult, setEditingResult] = useState<string | null>(null)
  const { msg: toast, show: showToast } = useToast()
  const matches = MOCK_UPCOMING.slice(0, 8)

  const handleSendBroadcast = () => {
    if (!broadcast.trim() || !user) return
    addMessage({
      id: `broadcast-${Date.now()}`,
      userId: user.id,
      channelId: 'geral',
      who: user.firstName,
      dept: user.dept,
      initials: user.initials,
      color: user.color,
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      text: `AVISO ADMIN: ${broadcast.trim()}`,
      type: 'text',
      isYou: false,
      createdAt: new Date().toISOString(),
    })
    setBroadcast('')
    setBroadcastSent(true)
    setTimeout(() => setBroadcastSent(false), 3000)
  }

  const handleExportCSV = () => {
    showToast('Exportação disponível após integração com Supabase')
  }

  const handleMatchAction = (action: string) => {
    showToast(`⚠ "${action}" requer Supabase configurado para persistir`)
  }

  return (
    <div className="min-h-dvh bg-paper">
      <div className="max-w-screen-xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <Eyebrow>ADMIN · BOLÃO DA SUPREMA</Eyebrow>
            <h1 className="font-display text-4xl mt-1">PAINEL DE CONTROLE</h1>
          </div>
          <div className="flex gap-2">
            <button onClick={handleExportCSV} className="btn-ghost">EXPORTAR CSV</button>
            <button onClick={() => handleMatchAction('Abrir Apostas')} className="btn-yellow">ABRIR APOSTAS →</button>
          </div>
        </div>

        {/* Toast */}
        {toast && (
          <div className="border-2 border-ink p-3 mb-4 font-mono text-[11px] text-ink-3 bg-yellow/20">
            {toast}
          </div>
        )}

        {/* Status strip */}
        <div className="border-2 border-ink p-4 mb-6 flex items-center justify-between bg-paper-deep">
          <div>
            <div className="font-mono text-[10px] tracking-eyebrow text-ink-3 mb-0.5">STATUS DO TORNEIO</div>
            <div className="font-display text-2xl">PRÉ-TORNEIO · APOSTAS ABERTAS</div>
          </div>
          <div className="text-right">
            <div className="font-mono text-[10px] text-ink-3">Fase de grupos</div>
            <div className="font-display text-xl">11 JUN · 15:00</div>
          </div>
        </div>

        <div className="grid grid-cols-[1.4fr_1fr] gap-5">

          {/* Left — matches + rules */}
          <div className="space-y-5">

            {/* Match control table */}
            <div className="border-2 border-ink">
              <div className="px-5 py-3 border-b border-hairline flex items-center justify-between">
                <span className="font-mono text-[10px] tracking-eyebrow text-ink-3">CONTROLE DE PARTIDAS</span>
                <span className="font-mono text-[10px] text-ink-4">{matches.length} PRÓXIMAS</span>
              </div>
              <div className="grid grid-cols-[1fr_1fr_120px_100px_80px] gap-2 px-5 py-2 border-b border-hairline font-mono text-[9px] tracking-eyebrow text-ink-4">
                <span>CASA</span><span>VISITANTE</span><span>DATA</span><span>RESULTADO</span><span>STATUS</span>
              </div>
              {matches.map(m => (
                <div key={m.id} className="grid grid-cols-[1fr_1fr_120px_100px_80px] gap-2 items-center px-5 py-3 border-b border-hairline last:border-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <Flag team={m.home} size={18} />
                    <span className="font-mono text-[12px] font-bold truncate">{m.home.name}</span>
                  </div>
                  <div className="flex items-center gap-2 min-w-0">
                    <Flag team={m.away} size={18} />
                    <span className="font-mono text-[12px] font-bold truncate">{m.away.name}</span>
                  </div>
                  <div className="font-mono text-[11px] text-ink-3">{m.date}</div>
                  <div>
                    {editingResult === m.id ? (
                      <input
                        defaultValue={results[m.id] ?? ''}
                        onBlur={e => {
                          const val = e.target.value.trim()
                          if (val) {
                            setResults(r => ({ ...r, [m.id]: val }))
                            showToast(`Resultado ${val} salvo localmente · sincronize com Supabase`)
                          }
                          setEditingResult(null)
                        }}
                        autoFocus
                        placeholder="0–0"
                        className="w-16 border border-ink px-1 py-0.5 font-mono text-[11px] text-center bg-yellow outline-none"
                      />
                    ) : (
                      <button
                        onClick={() => setEditingResult(m.id)}
                        className="font-mono text-[12px] font-bold text-center w-full hover:bg-yellow px-1 py-0.5 transition-colors"
                      >
                        {results[m.id] ?? '—'}
                      </button>
                    )}
                  </div>
                  <span className="font-mono text-[9px] font-bold px-2 py-1 text-center bg-yellow/40 text-ink">
                    AGENDADO
                  </span>
                </div>
              ))}
            </div>

            {/* Scoring rules */}
            <div className="border-2 border-ink p-5">
              <p className="font-mono text-[10px] tracking-eyebrow text-ink-3 mb-3">TABELA DE PONTUAÇÃO · REGULAMENTO</p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                {POINT_RULES.map(r => (
                  <div key={r.id} className="flex items-center gap-2">
                    <span className="font-display text-xl text-green w-8 flex-shrink-0">+{r.points}</span>
                    <span className="font-mono text-[10px] text-ink-3">{r.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right sidebar */}
          <div className="space-y-4">

            {/* Broadcast */}
            <div className="border-2 border-ink p-4">
              <p className="font-mono text-[10px] tracking-eyebrow text-ink-3 mb-3">AVISO PARA TODOS</p>
              <textarea
                value={broadcast}
                onChange={e => setBroadcast(e.target.value)}
                placeholder="Lembra galera: prazo de palpites fecha às 15h..."
                rows={4}
                className="w-full border-2 border-hairline p-3 font-sans text-[13px] bg-transparent outline-none resize-none focus:border-ink"
              />
              {broadcastSent && (
                <p className="font-mono text-[10px] text-green tracking-eyebrow mt-1">
                  ✓ AVISO ENVIADO PARA O #GERAL
                </p>
              )}
              <div className="flex gap-2 mt-2">
                <button onClick={() => setBroadcast('')} className="btn-ghost flex-1 text-[10px]">
                  CANCELAR
                </button>
                <button
                  onClick={handleSendBroadcast}
                  disabled={!broadcast.trim()}
                  className="btn-yellow flex-1 text-[10px] disabled:opacity-40"
                >
                  ENVIAR →
                </button>
              </div>
            </div>

            {/* Quick links */}
            <div className="border-2 border-ink p-4 space-y-2">
              <p className="font-mono text-[10px] tracking-eyebrow text-ink-3 mb-3">AÇÕES RÁPIDAS</p>
              <button
                onClick={() => handleMatchAction('Abrir Fase de Grupos')}
                className="btn-ghost w-full justify-center text-[10px]"
              >
                ABRIR FASE DE GRUPOS
              </button>
              <button
                onClick={() => handleMatchAction('Fechar Apostas do Grupo')}
                className="btn-ghost w-full justify-center text-[10px]"
              >
                FECHAR APOSTAS DO GRUPO
              </button>
              <button
                onClick={() => handleMatchAction('Publicar Resultado')}
                className="btn-ghost w-full justify-center text-[10px]"
              >
                PUBLICAR RESULTADO
              </button>
            </div>

            {/* Calendar overview */}
            <div className="border-2 border-ink p-4">
              <p className="font-mono text-[10px] tracking-eyebrow text-ink-3 mb-3">DATAS-CHAVE</p>
              <div className="space-y-2">
                {[
                  { date: '11 JUN', label: 'Início fase de grupos' },
                  { date: '27 JUN', label: 'Oitavas de final' },
                  { date: '4 JUL',  label: 'Quartas de final' },
                  { date: '14 JUL', label: 'Semifinais' },
                  { date: '19 JUL', label: 'Final' },
                ].map(d => (
                  <div key={d.date} className="flex items-center gap-3">
                    <span className="font-display text-lg w-16 flex-shrink-0">{d.date}</span>
                    <span className="font-mono text-[11px] text-ink-3">{d.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
