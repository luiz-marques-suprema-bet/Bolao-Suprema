import type { Match } from '@/types'

// Posições GARANTIDAS por PONTOS — sem depender de qualquer critério de
// desempate (saldo, confronto direto, fair-play, ranking — que o app só
// aproxima). Um time só é dado como 1º/2º quando é matematicamente IMPOSSÍVEL
// mudar: os pontos ATUAIS dele são estritamente maiores que o MÁXIMO que cada
// rival ainda pode somar (pontos atuais + 3 × jogos restantes). Com desigualdade
// estrita de pontos, nenhum resultado ou desempate altera a posição → zero erro.
// Quando NÃO está cravado por pontos, devolve null e a UI mostra o rótulo até a
// fonte oficial materializar o confronto.
export function clinchedPositions(
  group: { id: string; teams: string[] },
  matches: Match[],
): { first: string | null; second: string | null } {
  const pts: Record<string, number> = {}
  const rem: Record<string, number> = {}
  for (const c of group.teams) { pts[c] = 0; rem[c] = 0 }

  for (const m of matches) {
    if (m.group !== group.id) continue
    const h = m.home.code, a = m.away.code
    if (!(h in pts) || !(a in pts)) continue
    if (m.status === 'finished' && m.homeScore != null && m.awayScore != null) {
      if (m.homeScore > m.awayScore) pts[h] += 3
      else if (m.homeScore < m.awayScore) pts[a] += 3
      else { pts[h] += 1; pts[a] += 1 }
    } else {
      rem[h] += 1
      rem[a] += 1
    }
  }

  const maxPoss = (c: string) => pts[c] + 3 * rem[c]
  let first: string | null = null
  let second: string | null = null
  for (const T of group.teams) {
    const above = group.teams.filter(r => r !== T && pts[r] > maxPoss(T)) // garantidamente acima de T
    const belowOk = group.teams.every(r => r === T || above.includes(r) || pts[T] > maxPoss(r))
    if (!belowOk) continue
    if (above.length === 0) first = T          // mais pontos que o teto de todos → 1º cravado
    else if (above.length === 1) second = T    // exatamente um acima e T acima do resto → 2º cravado
  }
  return { first, second }
}
