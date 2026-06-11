interface MarqueeProps {
  items: string[]
  speed?: number
  color?: string
  bg?: string
  separator?: string
}

export function Marquee({ items, speed = 40, color = '#0D0D0D', bg = 'transparent', separator = '·' }: MarqueeProps) {
  const content = items.join(` ${separator} `)
  // O trilho tem 2 metades idênticas e o giro é translateX(-50%) (uma metade).
  // Se uma metade for mais estreita que a tela, sobra vão em branco no fim do
  // giro. Repetimos o conteúdo para cada metade ficar mais larga que telas
  // largas (até ~4K/ultrawide). A duração escala junto para manter a MESMA
  // velocidade visual (px/seg) independente da repetição.
  const REPEAT = 3
  const block = Array.from({ length: REPEAT }, () => content).join(` ${separator} `)
  const spanClass = 'font-mono text-[11px] font-semibold tracking-eyebrow uppercase whitespace-nowrap pr-8'

  return (
    <div className="overflow-hidden" style={{ background: bg }}>
      <div
        className="inline-flex animate-marquee py-2.5"
        style={{ color, animationDuration: `${speed * REPEAT}s` }}
      >
        <span className={spanClass}>{block}</span>
        <span className={spanClass} aria-hidden="true">{block}</span>
      </div>
    </div>
  )
}
