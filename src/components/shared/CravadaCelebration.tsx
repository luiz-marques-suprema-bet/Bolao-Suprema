import { useEffect, useMemo, useState } from 'react'
import { useAuthStore } from '@/stores/auth.store'
import { usePredictionStore } from '@/stores/prediction.store'
import { useMatchesWithStatus } from '@/hooks/useMatchWithStatus'
import { WC2026_MATCHES } from '@/data/wc2026'
import { formatMatchDate } from '@/lib/matchTime'
import { fetchRanking } from '@/lib/ranking'
import { standingsFromRanking } from '@/lib/espiadinha'
import { CravadaShareModal } from '@/components/shared/ShareCravada'
import type { CravadaCardData } from '@/lib/shareCard'
import type { RankingEntry } from '@/types'

const SEEN_KEY = 'bolao-cravada-seen-v1'
const INIT_KEY = 'bolao-cravada-init-v1'

function readSeen(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]') as string[]) } catch { return new Set() }
}
function writeSeen(s: Set<string>) {
  try { localStorage.setItem(SEEN_KEY, JSON.stringify([...s])) } catch { /* ignore */ }
}

/**
 * Celebração pós-jogo: quando um jogo encerra e o usuário CRAVOU o placar, abre
 * um pop-up parabenizando + botão de compartilhar. Mostra cada cravada uma vez.
 * Na primeira execução, marca as cravadas já existentes como vistas (sem pop-up
 * retroativo) — só dispara para cravadas novas dali em diante.
 */
export function CravadaCelebration() {
  const me = useAuthStore(s => s.user)
  const predictions = usePredictionStore(s => s.predictions)
  const matches = useMatchesWithStatus(WC2026_MATCHES)
  const [ranking, setRanking] = useState<RankingEntry[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)

  useEffect(() => {
    if (me?.id) fetchRanking(me.id).then(setRanking).catch(() => {})
  }, [me?.id])

  const cravadas = useMemo(() => matches.filter(m => {
    const p = predictions[m.id]
    return m.status === 'finished' && !!p && m.homeScore != null && m.awayScore != null
      && p.homeScore === m.homeScore && p.awayScore === m.awayScore
  }), [matches, predictions])

  useEffect(() => {
    if (!me || cravadas.length === 0) return
    const seen = readSeen()
    if (!localStorage.getItem(INIT_KEY)) {
      const next = new Set(seen)
      cravadas.forEach(m => next.add(m.id))
      writeSeen(next)
      try { localStorage.setItem(INIT_KEY, '1') } catch { /* ignore */ }
      return
    }
    if (activeId) return
    const fresh = cravadas.find(m => !seen.has(m.id))
    if (fresh) setActiveId(fresh.id)
  }, [cravadas, me, activeId])

  const match = cravadas.find(m => m.id === activeId)
  if (!match || !me) return null

  const pred = predictions[match.id]!
  const st = standingsFromRanking(ranking).find(s => s.user.id === me.id)

  const data: CravadaCardData = {
    home: { code: match.home.code, flag: match.home.flag, color: match.home.color },
    away: { code: match.away.code, flag: match.away.flag, color: match.away.color },
    homeScore: match.homeScore ?? 0,
    awayScore: match.awayScore ?? 0,
    points: pred.pointsEarned ?? (match.stage === 'group' ? 10 : 12),
    stageLabel: match.stage === 'group' ? `Grupo ${match.group}` : (match.stageLabel ?? 'Mata-mata'),
    dateLabel: formatMatchDate(match),
    userName: `${me.firstName} ${me.lastName ?? ''}`.trim() || me.firstName || 'Você',
    userInitials: me.initials ?? '?',
    userColor: me.color ?? '#777',
    userAvatarUrl: me.avatarUrl,
    rank: st?.rank,
    className: st?.tier.label,
  }

  const close = () => {
    const seen = readSeen()
    seen.add(match.id)
    writeSeen(seen)
    setActiveId(null)
  }

  return <CravadaShareModal data={data} open onClose={close} celebrate />
}
