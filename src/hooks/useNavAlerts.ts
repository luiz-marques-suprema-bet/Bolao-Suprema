import { useEffect, useMemo, useState } from 'react'
import { WC2026_MATCHES } from '@/data/wc2026'
import { useMatchesWithStatus } from '@/hooks/useMatchWithStatus'
import { usePredictionStore } from '@/stores/prediction.store'
import { getBettingDeadline } from '@/lib/matchTime'
import { isBetOpen } from '@/lib/markets'
import { isPlaceholderMatch } from '@/lib/matchGuards'
import { supabase, isMockMode } from '@/lib/supabase'

const SEEN_NOTICE_KEY = 'bolao-global-notices-seen-at'
const NOTICE_EVENT = 'bolao-global-notices-seen'
const URGENT_WINDOW_HOURS = 72

interface NoticeSummary {
  id: string
  created_at: string
}

export interface UrgentPickAlert {
  matchId: string
  label: string
  detail: string
  hoursLeft: number
}

export function markGlobalNoticesSeen() {
  localStorage.setItem(SEEN_NOTICE_KEY, new Date().toISOString())
  window.dispatchEvent(new Event(NOTICE_EVENT))
}

function formatDeadline(deadline: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  }).format(deadline)
}

export function useNavAlerts() {
  // useMatchesWithStatus faz o merge COMPLETO com o banco — inclusive home/away,
  // que materializam no mata-mata. (O merge antigo daqui ignorava os times, então
  // jogos de mata-mata já sorteados ficavam fora do lembrete de 72h.)
  const matches = useMatchesWithStatus(WC2026_MATCHES)
  const predictions = usePredictionStore(s => s.predictions)
  const [notices, setNotices] = useState<NoticeSummary[]>([])
  const [seenAt, setSeenAt] = useState(() => localStorage.getItem(SEEN_NOTICE_KEY) ?? '')

  useEffect(() => {
    function refreshSeen() {
      setSeenAt(localStorage.getItem(SEEN_NOTICE_KEY) ?? '')
    }
    window.addEventListener(NOTICE_EVENT, refreshSeen)
    window.addEventListener('storage', refreshSeen)
    return () => {
      window.removeEventListener(NOTICE_EVENT, refreshSeen)
      window.removeEventListener('storage', refreshSeen)
    }
  }, [])

  useEffect(() => {
    if (isMockMode) return
    let cancelled = false
    supabase
      .from('global_notices')
      .select('id,created_at')
      .order('created_at', { ascending: false })
      .limit(10)
      .then(({ data }) => {
        if (!cancelled) setNotices((data ?? []) as NoticeSummary[])
      })
    return () => { cancelled = true }
  }, [])

  const urgentPicks = useMemo<UrgentPickAlert[]>(() => {
    const now = new Date()
    return matches
      .filter(match => !predictions[match.id])
      .filter(match => !isPlaceholderMatch(match))
      .filter(match => isBetOpen(match, now))
      .map(match => {
        const deadline = getBettingDeadline(match)
        const hoursLeft = (deadline.getTime() - now.getTime()) / 3_600_000
        return { match, deadline, hoursLeft }
      })
      .filter(item => item.hoursLeft >= 0 && item.hoursLeft <= URGENT_WINDOW_HOURS)
      .sort((a, b) => a.deadline.getTime() - b.deadline.getTime())
      .slice(0, 5)
      .map(({ match, deadline, hoursLeft }) => ({
        matchId: match.id,
        label: `${match.home.code} x ${match.away.code}`,
        detail: `fecha ${formatDeadline(deadline)}`,
        hoursLeft: Math.max(0, Math.floor(hoursLeft)),
      }))
  }, [matches, predictions])

  const unseenNoticeCount = useMemo(() => {
    const seenTime = seenAt ? new Date(seenAt).getTime() : 0
    return notices.filter(notice => new Date(notice.created_at).getTime() > seenTime).length
  }, [notices, seenAt])

  return {
    urgentPicks,
    unseenNoticeCount,
    totalCount: urgentPicks.length + unseenNoticeCount,
    hasUrgentPick: urgentPicks.length > 0,
  }
}
