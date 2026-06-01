import { useEffect, useMemo, useState } from 'react'
import { WC2026_MATCHES } from '@/data/wc2026'
import { useMatchStore } from '@/stores/match.store'
import { usePredictionStore } from '@/stores/prediction.store'
import { getBettingDeadline } from '@/lib/matchTime'
import { isBetOpen } from '@/lib/markets'
import { isPlaceholderMatch } from '@/lib/matchGuards'
import { supabase, isMockMode } from '@/lib/supabase'
import type { Match } from '@/types'

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

function mergeMatch(base: Match, override: ReturnType<typeof useMatchStore.getState>['overrides'][string] | undefined): Match {
  if (!override) return base
  return {
    ...base,
    status: override.status,
    marketStatus: override.marketStatus ?? undefined,
    lockedAt: override.lockedAt ?? null,
    lockReason: override.lockReason ?? null,
    settledAt: override.settledAt ?? null,
    kickoffUtc: override.kickoffUtc ?? base.kickoffUtc,
  }
}

export function useNavAlerts() {
  const overrides = useMatchStore(s => s.overrides)
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
    return WC2026_MATCHES
      .map(match => mergeMatch(match, overrides[match.id]))
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
  }, [overrides, predictions])

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
