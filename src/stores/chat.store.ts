import { create } from 'zustand'
import type { ChatMessage } from '@/types'
import { supabase, isMockMode } from '@/lib/supabase'

// ─── User profile cache (avoids repeated fetches) ────────────────────────────

interface UserSnap {
  firstName: string; lastName: string
  dept: string; initials: string; color: string
  avatarUrl?: string
}

const _cache = new Map<string, UserSnap>()

function cacheFrom(row: Record<string, string | null>) {
  _cache.set(row.id, {
    firstName: row.first_name ?? '',
    lastName:  row.last_name  ?? '',
    dept:      row.dept       ?? '',
    initials:  row.initials   ?? '?',
    color:     row.color      ?? '#777',
    avatarUrl: row.avatar_url  ?? undefined,
  })
}

async function ensureCached(userId: string) {
  if (_cache.has(userId)) return
  const { data } = await supabase
    .from('users')
    .select('id,first_name,last_name,dept,initials,color,avatar_url')
    .eq('id', userId)
    .single()
  if (data) cacheFrom(data as Record<string, string | null>)
}

// ─── DB row → ChatMessage ──────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRow(row: any, myUserId?: string): ChatMessage {
  const u = _cache.get(row.user_id)
  return {
    id:        row.id,
    userId:    row.user_id,
    channelId: row.channel_id ?? 'geral',
    who:       u ? `${u.firstName} ${u.lastName}`.trim() : '?',
    dept:      u?.dept      ?? '',
    initials:  u?.initials   ?? '?',
    color:     u?.color      ?? '#777',
    avatarUrl: u?.avatarUrl  ?? undefined,
    time:      new Date(row.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    text:      row.text      ?? '',
    type:      row.type      ?? 'text',
    gifUrl:    row.gif_url   ?? undefined,
    poll:      row.poll_data ?? undefined,
    reaction:  row.reaction  ?? undefined,
    isPinned:  false,
    isYou:     row.user_id === myUserId,
    createdAt: row.created_at,
  }
}

// ─── Store ────────────────────────────────────────────────────────────────────

interface ChatState {
  messages:  ChatMessage[]
  pinnedId:  string | null
  isLoaded:  boolean
  _myUserId: string | undefined
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _channel:  any | null

  init:       (myUserId: string) => Promise<void>
  destroy:    () => void
  addMessage: (msg: ChatMessage) => void
  setPinned:  (id: string | null) => void
  voteOnPoll: (msgId: string, userId: string, optionId: string) => void
}

export const useChatStore = create<ChatState>()((set, get) => ({
  messages:  [],
  pinnedId:  null,
  isLoaded:  false,
  _myUserId: undefined,
  _channel:  null,

  // ── init: load messages + subscribe ────────────────────────────────────────

  init: async (myUserId) => {
    // Skip if already loaded for same user
    if (get().isLoaded && get()._myUserId === myUserId) return

    set({ _myUserId: myUserId })

    if (isMockMode) {
      set({ isLoaded: true })
      return
    }

    // Fetch last 150 messages with user profiles joined
    const { data: rows } = await supabase
      .from('chat_messages')
      .select(`
        id, user_id, channel_id, text, type, gif_url, poll_data, reaction, created_at,
        users ( id, first_name, last_name, dept, initials, color, avatar_url )
      `)
      .eq('channel_id', 'geral')
      .order('created_at', { ascending: true })
      .limit(150)

    if (rows) {
      for (const row of rows) {
        if (row.users) cacheFrom(row.users as Record<string, string | null>)
      }
      const messages = rows.map(r => mapRow(r, myUserId))
      set({ messages, isLoaded: true })
    } else {
      set({ isLoaded: true })
    }

    // Subscribe to new inserts via Realtime
    const channel = supabase
      .channel('chat_geral_v1')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: 'channel_id=eq.geral' },
        async (payload) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const row = payload.new as any
          await ensureCached(row.user_id)
          const msg = mapRow(row, get()._myUserId)
          set(s => {
            if (s.messages.some(m => m.id === msg.id)) return s  // deduplicate
            return { messages: [...s.messages, msg] }
          })
        }
      )
      .subscribe()

    set({ _channel: channel })
  },

  // ── destroy: unsubscribe ────────────────────────────────────────────────────

  destroy: () => {
    const { _channel } = get()
    if (_channel) supabase.removeChannel(_channel)
    set({ _channel: null, messages: [], isLoaded: false, _myUserId: undefined })
  },

  // ── addMessage: optimistic add + Supabase insert ────────────────────────────

  addMessage: (msg) => {
    // Optimistic update — render immediately
    set(s => ({ messages: [...s.messages, msg] }))

    if (isMockMode) return

    // Ensure our profile is cached so realtime echo can map the row
    if (msg.userId && !_cache.has(msg.userId)) {
      _cache.set(msg.userId, {
        firstName: msg.who.split(' ')[0] ?? '',
        lastName:  msg.who.split(' ').slice(1).join(' '),
        dept:      msg.dept,
        initials:  msg.initials,
        color:     msg.color,
        avatarUrl: msg.avatarUrl,
      })
    }

    // Build DB row
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row: Record<string, any> = {
      id:         msg.id,
      user_id:    msg.userId,
      channel_id: msg.channelId ?? 'geral',
      text:       msg.text ?? '',
      type:       msg.type ?? 'text',
    }
    if (msg.gifUrl)   row.gif_url   = msg.gifUrl
    if (msg.reaction) row.reaction  = msg.reaction
    if (msg.poll)     row.poll_data = msg.poll

    supabase.from('chat_messages').insert(row).then(({ error }) => {
      if (error) {
        console.error('[Chat] Falha ao salvar mensagem:', error.message)
        // Roll back optimistic update on error
        set(s => ({ messages: s.messages.filter(m => m.id !== msg.id) }))
      }
    })
  },

  // ── setPinned / voteOnPoll (local only) ────────────────────────────────────

  setPinned: (id) => set({ pinnedId: id }),

  voteOnPoll: (msgId, userId, optionId) =>
    set(s => ({
      messages: s.messages.map(m => {
        if (m.id !== msgId || !m.poll) return m
        return { ...m, poll: { ...m.poll, votes: { ...m.poll.votes, [userId]: optionId } } as ChatMessage['poll'] }
      }),
    })),
}))
