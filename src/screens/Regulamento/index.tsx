import { BRAZIL_TIME_LABEL, formatMatchDateTime } from '@/lib/matchTime'
import { WC2026_MATCHES } from '@/data/wc2026'
import { FloatingTooltip } from '@/components/shared/FloatingTooltip'

const GROUP_RULES = [
  { pts: 10, label: 'Placar exato',                 detail: 'ex: colocou 2×1 e foi 2×1',            accent: 'bg-green' },
  { pts: 7,  label: 'Resultado + gols do vencedor', detail: 'ex: colocou 3×0 e foi 3×1',            accent: 'bg-yellow' },
  { pts: 5,  label: 'Resultado correto (V/E/D)',     detail: 'ex: colocou 2×1 e foi 1×0',            accent: 'bg-yellow/60' },
  { pts: 1,  label: 'Gols de uma equipe acertados', detail: 'ex: colocou 1×1 e foi 2×1',            accent: 'bg-paper-deep' },
]

const KO_RULES = [
  { pts: 12, label: 'Placar exato (tempo regulamentar)', detail: 'apenas 90 min',                     accent: 'bg-green' },
  { pts: 8,  label: 'Resultado + gols de um time',       detail: 'no tempo regulamentar',              accent: 'bg-yellow' },
  { pts: 5,  label: 'Resultado correto',                  detail: 'vencedor no regulamentar',           accent: 'bg-yellow/60' },
  { pts: 2,  label: 'Classificado acertado',              detail: 'incluindo prorrogação e pênaltis',   accent: 'bg-paper-deep' },
]

const GENERAL_RULES = [
  { pts: 25, label: 'Campeão',      detail: 'seleção campeã do mundo',  accent: 'bg-green' },
  { pts: 15, label: 'Vice-campeão', detail: 'seleção vice-campeã',      accent: 'bg-yellow' },
  { pts: 10, label: 'Artilheiro',   detail: 'critério de desempate',    accent: 'bg-yellow/60' },
]

const TIEBREAKERS = [
  'Maior número de acertos de placar exato',
  'Acerto do artilheiro (quem acertou leva; se nenhum, vai quem escolheu o jogador com mais gols)',
  'Maior pontuação na fase eliminatória',
  'Acerto do placar da final',
  'Ordem de envio das apostas (quem apostou primeiro)',
]

export function RegulamentoScreen() {
  const firstMatch = formatMatchDateTime(WC2026_MATCHES[0])

  return (
    <div className="min-h-dvh bg-paper pb-24 md:pb-10">
      <div className="app-shell py-6 md:py-8 space-y-5">

        {/* Hero */}
        <header className="ui-inverse p-6 md:p-8 relative overflow-hidden">
          <div className="absolute inset-0 opacity-5 pointer-events-none"
            style={{ backgroundImage: 'repeating-linear-gradient(45deg,#fff 0,#fff 1px,transparent 0,transparent 50%)', backgroundSize: '12px 12px' }} />
          <p className="font-mono text-[10px] tracking-eyebrow text-yellow relative">REGULAMENTO OFICIAL</p>
          <h1 className="font-display text-5xl md:text-7xl leading-none mt-1 relative">BOLÃO SUPREMA</h1>
          <p className="font-mono text-[12px] text-paper/50 mt-2 relative">Copa do Mundo FIFA 2026 · USA · CAN · MEX</p>
        </header>

        {/* Objetivo + Participação */}
        <section className="grid md:grid-cols-2 gap-4">
          <InfoCard title="OBJETIVO" accent="border-l-4 border-l-green" items={[
            'Bolão cumulativo: cada participante acumula pontos ao longo de toda a competição.',
            'Vence quem tiver a maior pontuação total ao final do torneio.',
            'Participação voluntária e gratuita — prêmios são cortesias da Suprema Gaming.',
          ]} />
          <InfoCard title="PARTICIPAÇÃO" accent="border-l-4 border-l-yellow" items={[
            'Aberto a todos os colaboradores da empresa.',
            'Cada participante pode realizar apenas um cadastro.',
            'Ao participar, o usuário concorda integralmente com este regulamento.',
          ]} />
        </section>

        {/* Apostas */}
        <section className="grid md:grid-cols-2 gap-4">
          <InfoCard title="APOSTAS POR PARTIDA" accent="border-l-4 border-l-green" items={[
            `Para cada jogo, informe o placar exato (ex: 2×1).`,
            `Todas as datas e horas usam ${BRAZIL_TIME_LABEL}.`,
            `Primeiro jogo: ${firstMatch}.`,
            'Cada palpite fecha automaticamente no kickoff da partida.',
          ]} />
          <InfoCard title="APOSTAS ESPECIAIS" accent="border-l-4 border-l-yellow" items={[
            'Devem ser realizadas antes do início da primeira partida.',
            'Campeão · Vice-campeão · Artilheiro.',
            'Campeão e vice não podem ser do mesmo grupo.',
          ]} />
        </section>

        {/* Pontuação */}
        <section>
          <div className="ui-panel-header flex items-baseline gap-3">
            <h2 className="font-display text-3xl">PONTUAÇÃO</h2>
            <span className="font-mono text-[10px] text-paper/40 tracking-eyebrow">COMO GANHAR PTS</span>
          </div>
          <div className="ui-panel border-t-0 divide-y divide-hairline">
            <RulesBlock title="FASE DE GRUPOS" rules={GROUP_RULES} />
            <RulesBlock title="MATA-MATA (fase eliminatória)" rules={KO_RULES} />
            <RulesBlock title="APOSTAS ESPECIAIS" rules={GENERAL_RULES} />
          </div>
        </section>

        {/* Prorrogação + Cancelamento */}
        <section className="grid md:grid-cols-2 gap-4">
          <InfoCard title="PRORROGAÇÃO E PÊNALTIS" accent="border-l-4 border-l-paper-deep" items={[
            'Placar considerado: tempo regulamentar (90 min).',
            'Bônus +2 pts (classificado) vale o resultado final, incluindo prorr./pênaltis.',
          ]} />
          <InfoCard title="CANCELAMENTO" accent="border-l-4 border-l-red/60" items={[
            'Em caso de cancelamento, a organização pode anular a rodada ou considerar o resultado oficial.',
            'Qualquer fraude resulta em desclassificação.',
          ]} />
        </section>

        {/* Desempate */}
        <section>
          <div className="ui-panel-header flex items-baseline gap-3">
            <h2 className="font-display text-3xl">DESEMPATE</h2>
            <span className="font-mono text-[10px] text-paper/40 tracking-eyebrow">APLICADOS NESTA ORDEM</span>
          </div>
          <div className="ui-panel border-t-0">
            {TIEBREAKERS.map((t, i) => (
              <div key={i} className="flex items-start gap-4 px-5 py-3.5 border-b border-hairline last:border-0">
                <span className="font-display text-3xl text-ink-4 flex-shrink-0 w-8 leading-tight">{i + 1}</span>
                <span className="font-mono text-[12px] text-ink-2 leading-relaxed pt-0.5">{t}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Disposições */}
        <section className="ui-card p-5">
          <h2 className="font-display text-xl text-ink-3 mb-2">DISPOSIÇÕES FINAIS</h2>
          <p className="font-mono text-[11px] text-ink-3 leading-relaxed">
            A organização se reserva o direito de resolver casos omissos. O regulamento pode ser complementado
            antes do início do torneio. Após o início da competição, nenhuma regra poderá ser alterada.
          </p>
          <p className="font-mono text-[10px] text-ink-4 mt-2">
            v1 · Alterações comunicadas via Boletim.
          </p>
        </section>

      </div>
    </div>
  )
}

function InfoCard({ title, items, accent }: { title: string; items: string[]; accent: string }) {
  return (
    <div className={`ui-card p-4 pl-5 ${accent}`}>
      <h2 className="font-display text-xl mb-3">{title}</h2>
      <ul className="space-y-2">
        {items.map(item => (
          <li key={item} className="font-mono text-[11px] leading-relaxed text-ink-2 flex gap-2">
            <span className="text-ink-4 flex-shrink-0">—</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function RulesBlock({ title, rules }: { title: string; rules: { pts: number; label: string; detail: string; accent: string }[] }) {
  return (
    <div className="px-5 py-4">
      <p className="font-mono text-[9px] tracking-eyebrow text-ink-4 mb-4">{title}</p>
      <div className="space-y-2">
        {rules.map(r => (
          <div key={r.label} className="flex items-stretch gap-3">
            <div className={`w-1 rounded-full flex-shrink-0 ${r.accent}`} />
            <div className="w-12 flex-shrink-0 flex items-center">
              <span className="font-display text-3xl leading-none">{r.pts}</span>
            </div>
            <div className="flex flex-col justify-center min-w-0">
              <FloatingTooltip label={r.detail}>
                <div className="font-mono text-[12px] font-bold leading-tight cursor-default underline decoration-dotted decoration-ink-4 underline-offset-2 w-fit">
                  {r.label}
                </div>
              </FloatingTooltip>
              <div className="font-mono text-[10px] text-ink-4 mt-0.5">{r.detail}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
