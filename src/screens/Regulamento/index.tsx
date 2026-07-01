import { BRAZIL_TIME_LABEL, formatMatchDateTime } from '@/lib/matchTime'
import { WC2026_MATCHES } from '@/data/wc2026'
import { FloatingTooltip } from '@/components/shared/FloatingTooltip'
import { cn } from '@/lib/utils'

// Prêmios oficiais do bolão — premiação até o 20º colocado.
const PRIZES_TOP = [
  { place: '1º', tag: 'MAIOR PRÊMIO', accent: 'bg-yellow', prize: 'Pacote para o Vale Suíço + Moletom' },
  { place: '2º', tag: '',             accent: 'bg-ink/40', prize: 'Voucher R$ 600 + Par de ingressos pro Beef Tour + Day Off + Moletom' },
  { place: '3º', tag: '',             accent: 'bg-ink/25', prize: 'Voucher R$ 550 + Day Off + Kit Artilheiro' },
]

const PRIZES_REST = [
  { place: '4º',       prize: 'Voucher R$ 500 + Day Off + Moletom' },
  { place: '5º',       prize: 'Voucher R$ 450 + Day Off + Moletom' },
  { place: '6º',       prize: 'Voucher R$ 400 + Kit Artilheiro' },
  { place: '7º',       prize: 'Voucher R$ 400 + Kit Capitão' },
  { place: '8º',       prize: 'Voucher R$ 350 + Kit Capitão' },
  { place: '9º',       prize: 'Voucher R$ 300 + Kit Capitão' },
  { place: '10º',      prize: 'Voucher R$ 250 + Kit Capitão' },
  { place: '11º',      prize: 'Voucher R$ 200 + Kit Capitão' },
  { place: '12º–15º',  prize: 'Kit Artilheiro' },
  { place: '16º–20º',  prize: 'Kit Capitão' },
]

const GROUP_RULES = [
  { pts: 10, label: 'Placar exato',                 detail: 'ex: colocou 2×1 e foi 2×1',            accent: 'bg-green' },
  { pts: 7,  label: 'Resultado + gols do vencedor', detail: 'ex: colocou 3×0 e foi 3×1',            accent: 'bg-yellow' },
  { pts: 5,  label: 'Resultado correto (V/E/D)',     detail: 'ex: colocou 2×1 e foi 1×0',            accent: 'bg-yellow/60' },
  { pts: 1,  label: 'Gols de uma equipe acertados', detail: 'ex: colocou 1×1 e foi 2×1',            accent: 'bg-paper-deep' },
]

// Mata-mata (regras 5.2 oficiais). O placar conta só o tempo regulamentar; o +2 do
// classificado só sai quando o jogo EMPATA nos 90 min (vai p/ pênaltis). Máximo: 12
// num jogo decidido no tempo normal, 14 num que foi p/ pênaltis.
const KO_RULES = [
  { pts: 12, label: 'Acerto do placar exato (apenas tempo regulamentar)',        detail: 'jogo decidido nos 90 min vale no máximo 12 — a prorrogação não conta pro placar', accent: 'bg-green' },
  { pts: 8,  label: 'Acerto do resultado com score de um time',                  detail: 'o resultado E o placar de um dos times',          accent: 'bg-yellow' },
  { pts: 5,    label: 'Acerto do resultado apenas',                                detail: 'acertou vitória, empate ou derrota',              accent: 'bg-yellow/60' },
  { pts: '+2', label: 'Acerto do classificado (incluindo prorrogação e pênaltis)', detail: 'só vale num jogo que empatou (pênaltis). SOMA ao placar: cravou o empate (12) + classificado = 14. Acertou SÓ o classificado, errando o placar = 2.', accent: 'bg-paper-deep' },
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

        {/* Prêmios — destaque logo no começo */}
        <section>
          <div className="ui-inverse p-6 md:p-7 border-l-4 border-l-yellow">
            <p className="font-mono text-[10px] tracking-eyebrow text-yellow">PRÊMIOS DO BOLÃO</p>
            <h2 className="font-display text-4xl md:text-6xl leading-none mt-1">
              <span className="text-yellow">4K</span> EM VOUCHERS
            </h2>
            <p className="font-mono text-[12px] text-white/70 mt-3 max-w-xl leading-relaxed">
              Garantidos e premiando <span className="text-white font-bold">até o 20º colocado</span>. Aqui
              ninguém joga só pela glória: tem voucher, moletom, day off, Beef Tour e até o Vale Suíço esperando.
            </p>
          </div>

          {/* Pódio — top 3 */}
          <div className="grid gap-3 mt-3 sm:grid-cols-3">
            {PRIZES_TOP.map(p => (
              <div
                key={p.place}
                className={cn('flex bg-card border-2', p.place === '1º' ? 'border-ink' : 'border-line-strong')}
              >
                <div className={cn('w-1.5 flex-shrink-0', p.accent)} />
                <div className="flex-1 p-4">
                  <div className="flex items-baseline gap-2">
                    <span className="font-display text-3xl leading-none text-ink">{p.place}</span>
                    {p.tag && <span className="font-mono text-[8px] tracking-eyebrow text-ink-4">{p.tag}</span>}
                  </div>
                  <p className="font-mono text-[12px] font-bold leading-snug text-ink-2 mt-3">{p.prize}</p>
                </div>
              </div>
            ))}
          </div>

          {/* 4º ao 20º */}
          <p className="font-mono text-[9px] tracking-eyebrow text-ink-4 mt-5 mb-2 px-1">DO 4º AO 20º</p>
          <div className="ui-panel divide-y divide-hairline">
            {PRIZES_REST.map(p => (
              <div key={p.place} className="flex items-center gap-4 px-5 py-2.5">
                <span className="font-display text-xl text-ink-3 w-16 flex-shrink-0 leading-none">{p.place}</span>
                <span className="font-mono text-[12px] text-ink-2 leading-snug">{p.prize}</span>
              </div>
            ))}
          </div>

          <p className="font-mono text-[10px] text-ink-4 mt-3 px-1 leading-relaxed">
            Prêmios são cortesias da Suprema Gaming · entrega e detalhes confirmados pela organização ao fim do torneio.
          </p>
        </section>

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
            'Campeão e vice não podem ser a mesma seleção.',
          ]} />
        </section>

        {/* Pontuação */}
        <section>
          <div className="border-2 border-line-strong border-b-0 bg-card px-4 py-3 text-ink flex items-baseline gap-3">
            <h2 className="font-display text-3xl">PONTUAÇÃO</h2>
            <span className="font-mono text-[10px] text-ink-4 tracking-eyebrow">COMO GANHAR PTS</span>
          </div>
          <div className="ui-panel border-t-0 divide-y divide-hairline">
            <RulesBlock title="FASE DE GRUPOS" rules={GROUP_RULES} />
            <RulesBlock title="MATA-MATA (fase eliminatória)" rules={KO_RULES} />
            <RulesBlock title="APOSTAS ESPECIAIS" rules={GENERAL_RULES} />
          </div>
        </section>

        {/* Mata-mata + Cancelamento */}
        <section className="grid md:grid-cols-2 gap-4">
          <InfoCard title="MATA-MATA" accent="border-l-4 border-l-green" items={[
            'O placar e o resultado (12 / 8 / 5) contam SÓ o tempo regulamentar (90 min).',
            'Jogo decidido nos 90 min vale no máximo 12 — a prorrogação não conta pro placar.',
            'Num jogo que EMPATA (pênaltis), acertar quem passa SOMA +2 ao seu placar.',
            'Cravou o empate (12) + acertou quem passa = 14. Acertou SÓ o classificado (errou o placar) = 2. São coisas diferentes.',
          ]} />
          <InfoCard title="CANCELAMENTO" accent="border-l-4 border-l-red/60" items={[
            'Em caso de cancelamento, a organização pode anular a rodada ou considerar o resultado oficial.',
            'Qualquer fraude resulta em desclassificação.',
          ]} />
        </section>

        {/* Desempate */}
        <section>
          <div className="border-2 border-line-strong border-b-0 bg-card px-4 py-3 text-ink flex items-baseline gap-3">
            <h2 className="font-display text-3xl">DESEMPATE</h2>
            <span className="font-mono text-[10px] text-ink-4 tracking-eyebrow">APLICADOS NESTA ORDEM</span>
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
