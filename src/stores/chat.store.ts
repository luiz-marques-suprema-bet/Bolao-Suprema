import { create } from 'zustand'
import type { ChatMessage } from '@/types'
import { supabase, isMockMode } from '@/lib/supabase'
import { sanitizeText } from '@/services/product'

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserSnap {
  firstName: string; lastName: string
  dept: string; initials: string; color: string
  avatarUrl?: string
}

interface UserRow {
  id: string; first_name: string | null; last_name: string | null
  dept: string | null; initials: string | null; color: string | null; avatar_url: string | null
}

interface MessageRow {
  id: string; user_id: string; channel_id: string | null
  text: string | null; type: string | null; gif_url: string | null
  image_url: string | null; audio_url: string | null; audio_duration: number | null
  poll_data: Record<string, unknown> | null; reaction: string | null
  reply_to: unknown | null; created_at: string
  users?: UserRow | null
}

interface VoteRow {
  message_id: string; user_id: string; option_id: string
}

interface PinRow {
  channel_id: string; message_id: string | null
}

// ─── User profile cache ───────────────────────────────────────────────────────

const _userCache = new Map<string, UserSnap>()

function cacheFrom(row: UserRow) {
  _userCache.set(row.id, {
    firstName: row.first_name ?? '',
    lastName:  row.last_name  ?? '',
    dept:      row.dept       ?? '',
    initials:  row.initials   ?? '?',
    color:     row.color      ?? '#777',
    avatarUrl: row.avatar_url ?? undefined,
  })
}

async function ensureCached(userId: string) {
  if (_userCache.has(userId)) return
  const { data } = await supabase
    .from('users')
    .select('id,first_name,last_name,dept,initials,color,avatar_url')
    .eq('id', userId)
    .single()
  if (data) cacheFrom(data as UserRow)
}

// ─── Row mappers ──────────────────────────────────────────────────────────────

function mapRow(row: MessageRow, myUserId?: string): ChatMessage {
  const u = _userCache.get(row.user_id)
  return {
    id:        row.id,
    userId:    row.user_id,
    channelId: row.channel_id ?? 'geral',
    who:       u ? `${u.firstName} ${u.lastName}`.trim() : '?',
    dept:      u?.dept     ?? '',
    initials:  u?.initials ?? '?',
    color:     u?.color    ?? '#777',
    avatarUrl: u?.avatarUrl,
    time:      new Date(row.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    text:          row.text ?? '',
    type:          (row.type as ChatMessage['type']) ?? 'text',
    gifUrl:        row.gif_url    ?? undefined,
    imageUrl:      row.image_url  ?? undefined,
    audioUrl:      row.audio_url  ?? undefined,
    audioDuration: row.audio_duration ?? undefined,
    poll:          row.poll_data as ChatMessage['poll'],
    reaction:      row.reaction  ?? undefined,
    replyTo:       row.reply_to  as ChatMessage['replyTo'],
    isPinned:  false,
    isYou:     row.user_id === myUserId,
    createdAt: row.created_at,
  }
}

// ─── Rate limiting (client-side) ─────────────────────────────────────────────
// Previne floods: máx 3 mensagens em 5 segundos por sessão.

const _msgTimestamps: number[] = []
const RATE_LIMIT_MAX = 3
const RATE_LIMIT_WINDOW = 5000

function isRateLimited(): boolean {
  const now = Date.now()
  while (_msgTimestamps.length > 0 && now - _msgTimestamps[0] > RATE_LIMIT_WINDOW) {
    _msgTimestamps.shift()
  }
  if (_msgTimestamps.length >= RATE_LIMIT_MAX) return true
  _msgTimestamps.push(now)
  return false
}

// ─── Local fallback persistence ──────────────────────────────────────────────
// GitHub Pages/dev builds can run without Supabase env vars. In that mode,
// the chat shows an explicit configuration error instead of simulating product data.

// ─── Store ────────────────────────────────────────────────────────────────────

interface ChatState {
  messages:   ChatMessage[]
  pinnedId:   string | null
  isLoaded:   boolean
  lastError:  string | null
  _myUserId:  string | undefined
  _channel:   ReturnType<typeof supabase.channel> | null

  init:        (myUserId: string) => Promise<void>
  destroy:     () => void
  addMessage:  (msg: ChatMessage) => void
  clearError:  () => void
  setPinned:     (id: string | null) => Promise<void>
  voteOnPoll:    (msgId: string, userId: string, optionId: string) => Promise<void>
  deleteMessage: (id: string) => Promise<void>
}

export const useChatStore = create<ChatState>()((set, get) => ({
  messages:  [],
  pinnedId:  null,
  isLoaded:  false,
  lastError: null,
  _myUserId: undefined,
  _channel:  null,

  // ── init ──────────────────────────────────────────────────────────────────

  init: async (myUserId) => {
    if (get().isLoaded && get()._myUserId === myUserId) return
    set({ _myUserId: myUserId })

    if (isMockMode) {
      set({
        messages: [],
        pinnedId: null,
        isLoaded: true,
        lastError: 'Supabase nao esta configurado. A Resenha exige persistencia real para funcionar.',
      })
      return
    }

    // 1. Load last 200 messages (ordered asc for display)
    const { data: rows, error: fetchError } = await supabase
      .from('chat_messages')
      .select(`
        id, user_id, channel_id, text, type, gif_url, image_url, audio_url, audio_duration, poll_data, reaction, created_at,
        users!user_id ( id, first_name, last_name, dept, initials, color, avatar_url )
      `)
      .eq('channel_id', 'geral')
      .order('created_at', { ascending: true })
      .limit(200)

    if (fetchError) console.error('[Chat] init fetch error:', fetchError.message)

    if (rows) {
      for (const row of rows) {
        if (row.users) cacheFrom(row.users as UserRow)
      }
      set({ messages: (rows as MessageRow[]).map(r => mapRow(r, myUserId)), isLoaded: true })
    } else {
      set({ isLoaded: true })
    }

    // 2. Load existing votes so polls show correctly on mount
    const { data: voteRows } = await supabase
      .from('poll_votes')
      .select('message_id, user_id, option_id')

    if (voteRows?.length) {
      set(s => ({
        messages: s.messages.map(m => {
          if (m.type !== 'poll' || !m.poll) return m
          const votes = { ...m.poll.votes }
          for (const v of voteRows as VoteRow[]) {
            if (v.message_id === m.id) votes[v.user_id] = v.option_id
          }
          return { ...m, poll: { ...m.poll, votes } }
        }),
      }))
    }

    // 3. Load current pin
    const { data: pinData } = await supabase
      .from('channel_pins')
      .select('message_id')
      .eq('channel_id', 'geral')
      .maybeSingle()

    if (pinData) {
      set({ pinnedId: (pinData as PinRow).message_id })
    }

    // 4. Realtime subscriptions
    const channel = supabase
      .channel('chat_geral_v2')
      // New messages
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: 'channel_id=eq.geral' },
        async (payload) => {
          const row = payload.new as MessageRow
          await ensureCached(row.user_id)
          const msg = mapRow(row, get()._myUserId)
          set(s => {
            if (s.messages.some(m => m.id === msg.id)) return s
            return { messages: [...s.messages, msg] }
          })
        })
      // New votes
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'poll_votes' },
        (payload) => {
          const v = payload.new as VoteRow
          set(s => ({
            messages: s.messages.map(m => {
              if (m.id !== v.message_id || !m.poll) return m
              return { ...m, poll: { ...m.poll, votes: { ...m.poll.votes, [v.user_id]: v.option_id } } }
            }),
          }))
        })
      // Updated votes (user changes vote)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'poll_votes' },
        (payload) => {
          const v = payload.new as VoteRow
          set(s => ({
            messages: s.messages.map(m => {
              if (m.id !== v.message_id || !m.poll) return m
              return { ...m, poll: { ...m.poll, votes: { ...m.poll.votes, [v.user_id]: v.option_id } } }
            }),
          }))
        })
      // Deleted messages (no filter — channel_id not in OLD record without REPLICA IDENTITY FULL)
      .on('postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'chat_messages' },
        (payload) => {
          const id = (payload.old as { id: string }).id
          set(s => {
            const messages = s.messages.filter(m => m.id !== id)
            const pinnedId = s.pinnedId === id ? null : s.pinnedId
            return { messages, pinnedId }
          })
        })
      // Pin changes
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'channel_pins', filter: 'channel_id=eq.geral' },
        (payload) => {
          const row = (payload.new ?? payload.old) as PinRow | null
          set({ pinnedId: row?.message_id ?? null })
        })
      .subscribe()

    set({ _channel: channel })
  },

  // ── destroy ───────────────────────────────────────────────────────────────

  destroy: () => {
    const { _channel } = get()
    if (_channel) supabase.removeChannel(_channel)
    set({ _channel: null, messages: [], pinnedId: null, isLoaded: false, lastError: null, _myUserId: undefined })
  },

  clearError: () => set({ lastError: null }),

  // ── addMessage (with rate limiting) ─────────────────────────────────────

  addMessage: (msg) => {
    if (msg.type === 'text' && isRateLimited()) {
      console.warn('[Chat] Rate limited — mensagem descartada')
      set({ lastError: 'Calma aí: muitas mensagens em sequência.' })
      return
    }
    const cleanText = sanitizeText(msg.text ?? '', 1000)
    if (msg.type === 'text' && !cleanText) {
      set({ lastError: 'Mensagem vazia ou invalida.' })
      return
    }
    msg = { ...msg, text: cleanText }

    if (isMockMode) {
      set({ lastError: 'Supabase nao esta configurado. Mensagens nao sao salvas em modo local.' })
      return
    }

    set(s => {
      const messages = [...s.messages, msg]
      return { messages }
    })

    if (msg.userId && !_userCache.has(msg.userId)) {
      _userCache.set(msg.userId, {
        firstName: msg.who.split(' ')[0] ?? '',
        lastName:  msg.who.split(' ').slice(1).join(' '),
        dept:      msg.dept,
        initials:  msg.initials,
        color:     msg.color,
        avatarUrl: msg.avatarUrl,
      })
    }

    const row: Record<string, unknown> = {
      id:         msg.id,
      user_id:    msg.userId,
      channel_id: msg.channelId ?? 'geral',
      text:       msg.text ?? '',
      type:       msg.type ?? 'text',
    }
    if (msg.gifUrl)        row.gif_url        = msg.gifUrl
    if (msg.imageUrl)      row.image_url      = msg.imageUrl
    if (msg.audioUrl)      row.audio_url      = msg.audioUrl
    if (msg.audioDuration) row.audio_duration = msg.audioDuration
    if (msg.reaction)      row.reaction       = msg.reaction
    if (msg.poll)          row.poll_data      = msg.poll
    if (msg.replyTo)       row.reply_to       = msg.replyTo

    const doInsert = (r: Record<string, unknown>) =>
      supabase.from('chat_messages').insert(r).then(({ error }) => {
        if (error) {
          // Migration not applied yet — retry without reply_to so the message still sends
          if (r.reply_to !== undefined && error.message.includes('reply_to')) {
            const { reply_to: _rt, ...withoutReply } = r
            return doInsert(withoutReply)
          }
          console.error('[Chat] Falha ao salvar mensagem:', error.message, error.code)
          set(s => ({
            messages: s.messages.filter(m => m.id !== msg.id),
            lastError: `Erro ao enviar: ${error.message}`,
          }))
        }
      })
    doInsert(row)
  },

  // ── setPinned (persisted) ─────────────────────────────────────────────────

  setPinned: async (id) => {
    const myUserId = get()._myUserId
    if (isMockMode) {
      set({ lastError: 'Supabase nao esta configurado. Fixar mensagens exige persistencia real.' })
      return
    }
    set({ pinnedId: id })

    if (id === null) {
      await supabase.from('channel_pins').delete().eq('channel_id', 'geral')
    } else if (myUserId) {
      await supabase.from('channel_pins').upsert(
        { channel_id: 'geral', message_id: id, pinned_by: myUserId },
        { onConflict: 'channel_id' }
      )
    }
  },

  // ── voteOnPoll (persisted) ────────────────────────────────────────────────

  voteOnPoll: async (msgId, userId, optionId) => {
    if (isMockMode) {
      set({ lastError: 'Supabase nao esta configurado. Votos nao sao salvos em modo local.' })
      return
    }

    // Optimistic update
    set(s => ({
      messages: s.messages.map(m => {
        if (m.id !== msgId || !m.poll) return m
        return { ...m, poll: { ...m.poll, votes: { ...m.poll.votes, [userId]: optionId } } }
      }),
    }))

    const { error } = await supabase.from('poll_votes').upsert(
      { message_id: msgId, user_id: userId, option_id: optionId, voted_at: new Date().toISOString() },
      { onConflict: 'message_id,user_id' }
    )

    if (error) {
      console.error('[Chat] Erro ao votar:', error.message)
      // Revert
      set(s => ({
        messages: s.messages.map(m => {
          if (m.id !== msgId || !m.poll) return m
          const votes = { ...m.poll.votes }
          delete votes[userId]
          return { ...m, poll: { ...m.poll, votes } }
        }),
      }))
    }
  },

  // ── deleteMessage (admin + own — RLS enforces ownership) ─────────────────

  deleteMessage: async (id) => {
    if (isMockMode) {
      set({ lastError: 'Supabase nao esta configurado. Moderacao exige persistencia real.' })
      return
    }

    // Optimistic remove
    set(s => ({ messages: s.messages.filter(m => m.id !== id) }))
    if (get().pinnedId === id) set({ pinnedId: null })

    const { error } = await supabase.from('chat_messages').delete().eq('id', id)
    if (error) {
      console.error('[Chat] Erro ao deletar mensagem:', error.message)
      set({ lastError: 'Erro ao deletar mensagem.' })
    }
  },
}))
