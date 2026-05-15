import { useCallback, useEffect, useState } from 'react'
import { Eyebrow } from '@/components/shared/Eyebrow'
import { useAuthStore } from '@/stores/auth.store'
import { fetchNotifications, markNotificationRead } from '@/services/product'
import type { Notification } from '@/types'

const TYPE_LABEL: Record<string, string> = {
  market_closing: 'PALPITE FECHANDO',
  match_starting: 'JOGO COMEÇANDO',
  ranking_updated: 'RANKING',
  bulletin_published: 'BOLETIM',
  chat_important: 'RESENHA',
  participant_status: 'PARTICIPANTE',
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
  const [items, setItems] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    const res = await fetchNotifications(user.id)
    setItems(res.data ?? [])
    setError(res.error)
    setLoading(false)
  }, [user?.id])

  useEffect(() => { load() }, [load])

  async function markRead(id: string) {
    const res = await markNotificationRead(id)
    if (res.error) {
      setError(res.error)
      return
    }
    setItems(current => current.map(item => item.id === id ? { ...item, readAt: new Date().toISOString() } : item))
  }

  return (
    <div className="min-h-dvh bg-paper pb-24">
      <div className="max-w-screen-lg mx-auto px-5 md:px-8 py-8">
        <Eyebrow className="mb-4">AVISOS · BOLÃO DA SUPREMA</Eyebrow>
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 border-b border-hairline pb-5 mb-5">
          <div>
            <h1 className="font-display text-4xl md:text-6xl leading-none">NOTIFICAÇÕES</h1>
            <p className="font-mono text-[11px] text-ink-3 mt-2 max-w-xl">
              Central interna para prazos de palpite, boletins, ranking, convites e comunicados importantes da Resenha.
            </p>
          </div>
          <button onClick={load} className="btn-ghost text-[10px] self-start md:self-auto">ATUALIZAR</button>
        </div>

        {error && (
          <div className="border-2 border-red/50 bg-red/5 text-red p-3 mb-4 font-mono text-[11px]">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-12 font-mono text-[11px] text-ink-3 animate-pulse">CARREGANDO...</div>
        ) : items.length === 0 ? (
          <div className="border-2 border-ink p-6">
            <div className="font-display text-3xl">SEM AVISOS AGORA</div>
            <p className="font-mono text-[11px] text-ink-3 mt-2">
              Quando um mercado estiver perto de fechar, um boletim sair ou o ranking atualizar, aparece aqui.
            </p>
          </div>
        ) : (
          <div className="border-2 border-ink divide-y divide-hairline">
            {items.map(item => (
              <article key={item.id} className={item.readAt ? 'p-4 bg-paper' : 'p-4 bg-yellow/30'}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-mono text-[9px] tracking-eyebrow text-ink-4">
                      {TYPE_LABEL[item.type] ?? item.type.toUpperCase()} · {formatWhen(item.createdAt)}
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
        )}
      </div>
    </div>
  )
}
