import { useEffect, useState } from 'react'
import { fetchScoringRules } from '@/services/product'
import { BRAZIL_TIME_LABEL, formatMatchDateTime } from '@/lib/matchTime'
import { WC2026_MATCHES } from '@/data/wc2026'
import type { ScoringRule } from '@/types'

export function RegulamentoScreen() {
  const [rules, setRules] = useState<ScoringRule[]>([])

  useEffect(() => {
    fetchScoringRules().then(res => setRules(res.data ?? []))
  }, [])

  return (
    <div className="min-h-dvh bg-paper px-4 py-6 md:px-8 md:py-8">
      <div className="max-w-4xl mx-auto space-y-5">
        <header className="border-2 border-ink p-5 bg-ink text-paper">
          <p className="font-mono text-[10px] tracking-eyebrow text-yellow">REGULAMENTO OFICIAL</p>
          <h1 className="font-display text-5xl md:text-7xl leading-none mt-1">BOLAO SUPREMA</h1>
          <p className="font-serif-it text-xl text-paper/70 mt-2">Tudo que o usuario precisa saber sem perguntar no WhatsApp.</p>
        </header>

        <section className="grid md:grid-cols-2 gap-4">
          <Info title="Como participar" items={[
            'Use seu e-mail corporativo @suprema.group.',
            'Novos usuarios podem entrar como pendentes ate aprovacao do admin.',
            'Participantes bloqueados ou removidos nao podem palpitar nem usar a Resenha.',
          ]} />
          <Info title="Prazos" items={[
            `Todas as datas e horas usam ${BRAZIL_TIME_LABEL}.`,
            `Primeiro jogo: ${formatMatchDateTime(WC2026_MATCHES[0])}.`,
            'Cada palpite fecha automaticamente no kickoff da partida.',
            'Admin pode bloquear/desbloquear mercados por necessidade operacional.',
          ]} />
          <Info title="Apostas gerais" items={[
            'Campeao, vice e artilheiro ficam salvos no Supabase.',
            'Campeao e vice precisam ser uma combinacao possivel pelo chaveamento.',
            'Apostas gerais fecham no inicio da competicao quando aplicavel.',
          ]} />
          <Info title="Administracao" items={[
            'Admin controla mercados, resultados, participantes, ranking, chat e exportacoes.',
            'Marketing gerencia boletins e uploads editoriais.',
            'Owner concede/revoga roles sensiveis.',
            'Acoes sensiveis ficam auditadas.',
          ]} />
        </section>

        <section className="border-2 border-ink">
          <div className="px-4 py-3 border-b border-hairline bg-ink text-paper flex items-baseline justify-between">
            <h2 className="font-display text-xl">PONTUACAO CONFIGURADA</h2>
            <span className="font-mono text-[9px] text-paper/50">fonte: Supabase</span>
          </div>
          <div className="divide-y divide-hairline">
            {(rules.length ? rules : fallbackRules).map(rule => (
              <div key={rule.id} className="px-4 py-3 flex items-center gap-3">
                <div className="flex-1">
                  <div className="font-mono text-[11px] font-bold">{rule.label}</div>
                  <div className="font-mono text-[9px] text-ink-3">{rule.stage.toUpperCase()} · {rule.category}</div>
                </div>
                <div className="font-display text-2xl">{rule.points}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="border-2 border-ink p-5 space-y-2">
          <h2 className="font-display text-2xl">HISTORICO DE ALTERACOES</h2>
          <p className="font-mono text-[11px] text-ink-3">v1 · Regulamento inicial publicado no app com horarios BRT, fechamento automatico, roles e auditoria.</p>
        </section>
      </div>
    </div>
  )
}

function Info({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="border-2 border-ink p-4">
      <h2 className="font-display text-2xl mb-3">{title}</h2>
      <ul className="space-y-2">
        {items.map(item => <li key={item} className="font-mono text-[11px] leading-relaxed text-ink-2">- {item}</li>)}
      </ul>
    </section>
  )
}

const fallbackRules: ScoringRule[] = [
  { id: 'group_exact', label: 'Placar exato', category: 'match', stage: 'group', points: 10, sortOrder: 10, isActive: true },
  { id: 'group_result', label: 'Acerto do vencedor/empate', category: 'match', stage: 'group', points: 5, sortOrder: 30, isActive: true },
  { id: 'champion', label: 'Campeao', category: 'general', stage: 'all', points: 25, sortOrder: 90, isActive: true },
  { id: 'vice', label: 'Vice', category: 'general', stage: 'all', points: 15, sortOrder: 100, isActive: true },
]
