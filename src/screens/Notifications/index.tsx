import { useCallback, useEffect, useState } from 'react'
import { Eyebrow } from '@/components/shared/Eyebrow'
import { useAuthStore } from '@/stores/auth.store'
import { supabase, isMockMode } from '@/lib/supabase'
import { fetchNotifications, markNotificationRead } from '@/services/product'
import type { Notification } from '@/types'

interface GlobalNotice {
  id: string
  title: string
  body: string | null
  created_at: string
}

function formatWhen(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(value))
}

export function NotificationsScreen() {
  const user = useAuthStore(s => s.user)
  const [notices, setNotices]   = useState<GlobalNotice[]>([])
  const [items, setItems]       = useState<Notification[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [noticesRes, notifsRes] = await Promise.all([
      isMockMode
        ? Promise.resolve({ data: [] as GlobalNotice[] })
        : supabase.from('global_notices').select('id,title,body,created_at').order('created_at', { ascending: false }),
      user?.id
        ? fetchNotifications(user.id)
        : Promise.resolve({ data: [] as Notification[], error: null }),
    ])
    setNotices((noticesRes.data ?? []) as GlobalNotice[])
    setItems((notifsRes as { data: Notification[] | null; error: string | null }).data ?? [])
    setError((notifsRes as { data: Notification[] | null; error: string | null }).error)
    setLoading(false)
  }, [user?.id])

  useEffect(() => { load() }, [load])

  async function markRead(id: string) {
    const res = await markNotificationRead(id)
    if (res.error) { setError(res.error); return }
    setItems(current => current.map(item => item.id === id ? { ...item, readAt: new Date().toISOString() } : item))
  }

  const hasContent = notices.length > 0 || items.length > 0

  return (
    <div className="min-h-dvh bg-paper pb-24">
      <div className="max-w-screen-lg mx-auto px-5 md:px-8 py-8">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 border-b border-hairline pb-5 mb-5">
          <div>
            <div className="font-display text-5xl md:text-7xl leading-none text-ink">AVISOS</div>
            <div className="flex items-baseline gap-3">
              <span className="font-serif-it text-3xl md:text-5xl text-green-deep leading-none">sérios,</span>
              <span className="font-mono text-[10px] tracking-eyebrow text-ink-3 self-end mb-1">da organização.</span>
            </div>
          </div>
          <button onClick={load} className="btn-ghost text-[10px] self-start md:self-auto">ATUALIZAR</button>
        </div>

        {error && (
          <div className="border-2 border-red/50 bg-red/5 text-red p-3 mb-4 font-mono text-[11px]">{error}</div>
        )}

        {loading ? (
          <div className="py-12 font-mono text-[11px] text-ink-3 animate-pulse">CARREGANDO...</div>
        ) : !hasContent ? (
          <div className="border-2 border-ink p-8 flex flex-col items-center text-center gap-3">
            <span className="font-display text-5xl text-ink-4">!</span>
            <div className="font-display text-3xl">SEM AVISOS</div>
            <p className="font-mono text-[11px] text-ink-3 max-w-xs leading-relaxed">
              Quando a organização publicar um comunicado ele aparece aqui.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Global notices from admin */}
            {notices.length > 0 && (
              <div>
                <p className="font-mono text-[9px] tracking-eyebrow text-ink-4 mb-3">COMUNICADOS DA ORGANIZAÇÃO</p>
                <div className="border-2 border-ink divide-y divide-hairline">
                  {notices.map(n => (
                    <article key={n.id} className="p-4 bg-yellow/10">
                      <div className="font-mono text-[9px] tracking-eyebrow text-ink-4 mb-1">
                        AVISO · {formatWhen(n.created_at)}
                      </div>
                      <h2 className="font-display text-2xl leading-tight">{n.title}</h2>
                      {n.body && (
                        <p className="font-mono text-[12px] text-ink-2 mt-2 leading-relaxed">{n.body}</p>
                      )}
                    </article>
                  ))}
                </div>
              </div>
            )}

            {/* Per-user notifications */}
            {items.length > 0 && (
              <div>
                <p className="font-mono text-[9px] tracking-eyebrow text-ink-4 mb-3">NOTIFICAÇÕES DO SISTEMA</p>
                <div className="border-2 border-ink divide-y divide-hairline">
                  {items.map(item => (
                    <article key={item.id} className={item.readAt ? 'p-4' : 'p-4 bg-yellow/30'}>
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="font-mono text-[9px] tracking-eyebrow text-ink-4">
                            {item.type.replace(/_/g, ' ').toUpperCase()} · {formatWhen(item.createdAt)}
                          </div>
                          <h2 className="font-display text-2xl leading-tight mt-1">{item.title}</h2>
                          <p className="font-mono text-[11px] text-ink-3 leading-relaxed mt-2">{item.body}</p>
                        </div>
                        {!item.readAt && (
                          <button onClick={() => markRead(item.id)} className="btn-yellow text-[9px] flex-shrink-0">
                            LIDO
                          </button>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
