import { create } from 'zustand'
import type { ChatMessage, ChatReaction } from '@/types'
import { supabase, isMockMode } from '@/lib/supabase'
import { sanitizeText } from '@/services/product'

export interface ChatProfile {
  id: string
  firstName: string
  lastName: string
  dept: string
  initials: string
  color: string
  avatarUrl?: string
}

interface UserRow {
  id: string
  first_name: string | null
  last_name: string | null
  dept: string | null
  initials: string | null
  color: string | null
  avatar_url: string | null
}

interface MessageRow {
  id: string
  user_id: string
  channel_id: string | null
  text: string | null
  type: string | null
  gif_url?: string | null
  image_url?: string | null
  audio_url?: string | null
  audio_duration?: number | null
  media_url?: string | null
  media_kind?: string | null
  media_mime?: string | null
  media_size?: number | null
  media_duration?: number | null
  media_thumbnail_url?: string | null
  mentions?: string[] | null
  poll_data: Record<string, unknown> | null
  reaction: string | null
  reply_to: unknown | null
  deleted_at?: string | null
  edited_at?: string | null
  created_at: string
}

interface VoteRow {
  message_id: string
  user_id: string
  option_id: string
}

interface ReactionRow {
  message_id: string
  user_id: string
  emoji: string
  created_at: string
}

interface PinRow {
  channel_id: string
  message_id: string | null
}

interface PresencePayload {
  userId?: string
  typing?: boolean
  onlineAt?: string
}

const CHANNEL_ID = 'geral'
const MESSAGE_SELECT = [
  'id',
  'user_id',
  'channel_id',
  'text',
  'type',
  'gif_url',
  'image_url',
  'audio_url',
  'audio_duration',
  'media_url',
  'media_kind',
  'media_mime',
  'media_size',
  'media_duration',
  'media_thumbnail_url',
  'mentions',
  'poll_data',
  'reaction',
  'reply_to',
  'deleted_at',
  'edited_at',
  'created_at',
].join(', ')

const LEGACY_MESSAGE_SELECT = [
  'id',
  'user_id',
  'channel_id',
  'text',
  'type',
  'gif_url',
  'image_url',
  'audio_url',
  'audio_duration',
  'poll_data',
  'reaction',
  'reply_to',
  'created_at',
].join(', ')

const MINIMAL_MESSAGE_SELECT = [
  'id',
  'user_id',
  'channel_id',
  'text',
  'type',
  'gif_url',
  'poll_data',
  'reaction',
  'created_at',
].join(', ')

const profileCache = new Map<string, ChatProfile>()
const msgTimestamps: number[] = []
const RATE_LIMIT_MAX = 4
const RATE_LIMIT_WINDOW = 5000

function normalizeProfile(row: UserRow): ChatProfile {
  return {
    id: row.id,
    firstName: row.first_name ?? '',
    lastName: row.last_name ?? '',
    dept: row.dept ?? '',
    initials: row.initials ?? '?',
    color: row.color ?? '#777',
    avatarUrl: row.avatar_url ?? undefined,
  }
}

function cacheProfile(row: UserRow) {
  profileCache.set(row.id, normalizeProfile(row))
}

async function fetchProfiles(ids: string[]): Promise<void> {
  const missing = Array.from(new Set(ids.filter(id => id && !profileCache.has(id))))
  if (missing.length === 0) return

  const { data, error } = await supabase
    .from('public_profiles')
    .select('id,first_name,last_name,dept,initials,color,avatar_url')
    .in('id', missing)

  if (error) {
    console.error('[Chat] profiles:', error.message)
    return
  }
  for (const row of (data ?? []) as UserRow[]) cacheProfile(row)
}

async function fetchDirectory(): Promise<ChatProfile[]> {
  const { data, error } = await supabase
    .from('public_profiles')
    .select('id,first_name,last_name,dept,initials,color,avatar_url')
    .order('first_name', { ascending: true })
    .limit(120)

  if (error) {
    console.error('[Chat] directory:', error.message)
    return Array.from(profileCache.values())
  }

  const profiles = ((data ?? []) as UserRow[]).map(normalizeProfile)
  profiles.forEach(p => profileCache.set(p.id, p))
  return profiles
}

async function ensureProfile(userId: string) {
  if (profileCache.has(userId)) return
  await fetchProfiles([userId])
}

function fullName(profile?: ChatProfile): string {
  return profile ? `${profile.firstName} ${profile.lastName}`.trim() || profile.initials : '?'
}

function mapRow(row: MessageRow, myUserId?: string): ChatMessage {
  const profile = profileCache.get(row.user_id)
  const kind = row.media_kind ?? row.type ?? 'text'
  const mediaUrl = row.media_url ?? row.image_url ?? row.audio_url ?? row.gif_url ?? undefined

  return {
    id: row.id,
    userId: row.user_id,
    channelId: row.channel_id ?? CHANNEL_ID,
    who: fullName(profile),
    dept: profile?.dept ?? '',
    initials: profile?.initials ?? '?',
    color: profile?.color ?? '#777',
    avatarUrl: profile?.avatarUrl,
    time: new Date(row.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    text: row.text ?? '',
    type: (row.type as ChatMessage['type']) ?? 'text',
    gifUrl: row.gif_url ?? (kind === 'gif' ? mediaUrl : undefined),
    imageUrl: row.image_url ?? (kind === 'image' ? mediaUrl : undefined),
    audioUrl: row.audio_url ?? (kind === 'audio' ? mediaUrl : undefined),
    videoUrl: kind === 'video' || kind === 'video_note' ? mediaUrl : undefined,
    mediaUrl,
    mediaKind: kind as ChatMessage['mediaKind'],
    mediaMime: row.media_mime ?? undefined,
    mediaSize: row.media_size ?? undefined,
    audioDuration: row.audio_duration ?? row.media_duration ?? undefined,
    mediaDuration: row.media_duration ?? row.audio_duration ?? undefined,
    mediaThumbnailUrl: row.media_thumbnail_url ?? undefined,
    mentions: row.mentions ?? [],
    poll: row.poll_data as ChatMessage['poll'],
    replyTo: row.reply_to as ChatMessage['replyTo'],
    reactions: row.reaction
      ? [{ emoji: row.reaction, userId: row.user_id, createdAt: row.created_at }]
      : [],
    isPinned: false,
    isYou: row.user_id === myUserId,
    createdAt: row.created_at,
    editedAt: row.edited_at ?? undefined,
  }
}

function isRateLimited(type?: ChatMessage['type']): boolean {
  if (type !== 'text') return false
  const now = Date.now()
  while (msgTimestamps.length > 0 && now - msgTimestamps[0] > RATE_LIMIT_WINDOW) {
    msgTimestamps.shift()
  }
  if (msgTimestamps.length >= RATE_LIMIT_MAX) return true
  msgTimestamps.push(now)
  return false
}

function sortMessages(messages: ChatMessage[]) {
  return [...messages].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
}

function mergeMessage(messages: ChatMessage[], msg: ChatMessage) {
  const without = messages.filter(m => m.id !== msg.id)
  return sortMessages([...without, msg])
}

function applyVotes(messages: ChatMessage[], votes: VoteRow[]) {
  return messages.map(m => {
    if (m.type !== 'poll' || !m.poll) return m
    const nextVotes = { ...m.poll.votes }
    for (const vote of votes) {
      if (vote.message_id === m.id) nextVotes[vote.user_id] = vote.option_id
    }
    return { ...m, poll: { ...m.poll, votes: nextVotes } }
  })
}

function applyReactions(messages: ChatMessage[], reactions: ReactionRow[]) {
  const grouped = new Map<string, ChatReaction[]>()
  for (const reaction of reactions) {
    const list = grouped.get(reaction.message_id) ?? []
    list.push({
      emoji: reaction.emoji,
      userId: reaction.user_id,
      createdAt: reaction.created_at,
    })
    grouped.set(reaction.message_id, list)
  }

  return messages.map(m => ({ ...m, reactions: grouped.get(m.id) ?? [] }))
}

function extractPresence(state: Record<string, PresencePayload[]>, myUserId?: string) {
  const online = new Set<string>()
  const typing = new Set<string>()

  for (const entries of Object.values(state)) {
    for (const entry of entries) {
      if (!entry.userId) continue
      online.add(entry.userId)
      if (entry.typing && entry.userId !== myUserId) typing.add(entry.userId)
    }
  }

  return {
    onlineUserIds: Array.from(online),
    typingUserIds: Array.from(typing),
  }
}

function mentionsFromText(text: string, profiles: ChatProfile[]): string[] {
  const lowered = text.toLocaleLowerCase('pt-BR')
  return profiles
    .filter(profile => {
      const first = profile.firstName.toLocaleLowerCase('pt-BR')
      const name = fullName(profile).toLocaleLowerCase('pt-BR')
      return (first && lowered.includes(`@${first}`)) || (name && lowered.includes(`@${name}`))
    })
    .map(profile => profile.id)
}

async function fetchMessageRows() {
  const attempts = [
    { select: MESSAGE_SELECT, filterDeleted: true },
    { select: LEGACY_MESSAGE_SELECT, filterDeleted: false },
    { select: MINIMAL_MESSAGE_SELECT, filterDeleted: false },
  ]
  let lastError: { message: string } | null = null

  for (const attempt of attempts) {
    let query = supabase
      .from('chat_messages')
      .select(attempt.select)
      .eq('channel_id', CHANNEL_ID)

    if (attempt.filterDeleted) query = query.is('deleted_at', null)

    const { data, error } = await query
      .order('created_at', { ascending: true })
      .limit(250)

    if (!error) return { rows: data as MessageRow[], error: null }
    lastError = error
    console.warn('[Chat] message select fallback:', error.message)
  }

  return { rows: null, error: lastError }
}

async function insertMessageRow(row: Record<string, unknown>) {
  const attempts: Record<string, unknown>[] = [
    row,
    withoutKeys(row, [
      'reply_to',
      'mentions',
      'media_url',
      'media_kind',
      'media_mime',
      'media_size',
      'media_duration',
      'media_thumbnail_url',
    ]),
    withoutKeys(row, [
      'reply_to',
      'mentions',
      'media_url',
      'media_kind',
      'media_mime',
      'media_size',
      'media_duration',
      'media_thumbnail_url',
      'image_url',
      'audio_url',
      'audio_duration',
    ]),
  ]
  let lastError: { message: string } | null = null

  for (const attempt of attempts) {
    const { error } = await supabase.from('chat_messages').insert(attempt)
    if (!error) return null
    lastError = error
    console.warn('[Chat] insert fallback:', error.message)
  }

  return lastError
}

function withoutKeys(row: Record<string, unknown>, keys: string[]) {
  const next = { ...row }
  for (const key of keys) delete next[key]
  return next
}

interface ChatState {
  messages: ChatMessage[]
  profiles: ChatProfile[]
  pinnedId: string | null
  onlineUserIds: string[]
  typingUserIds: string[]
  isLoaded: boolean
  lastError: string | null
  _myUserId: string | undefined
  _channel: ReturnType<typeof supabase.channel> | null
  _typingTimer: ReturnType<typeof setTimeout> | null

  init: (myUserId: string) => Promise<void>
  destroy: () => void
  addMessage: (msg: ChatMessage) => void
  clearError: () => void
  setTyping: (typing: boolean) => void
  toggleReaction: (messageId: string, emoji: string) => Promise<void>
  setPinned: (id: string | null) => Promise<void>
  voteOnPoll: (msgId: string, userId: string, optionId: string) => Promise<void>
  deleteMessage: (id: string) => Promise<void>
}

export const useChatStore = create<ChatState>()((set, get) => ({
  messages: [],
  profiles: [],
  pinnedId: null,
  onlineUserIds: [],
  typingUserIds: [],
  isLoaded: false,
  lastError: null,
  _myUserId: undefined,
  _channel: null,
  _typingTimer: null,

  init: async (myUserId) => {
    if (get().isLoaded && get()._myUserId === myUserId) return
    get().destroy()
    set({ _myUserId: myUserId, isLoaded: false, lastError: null })

    if (isMockMode) {
      set({
        isLoaded: true,
        lastError: 'Supabase nao esta configurado. A Resenha exige persistencia real para funcionar.',
      })
      return
    }

    const directoryPromise = fetchDirectory()

    const { rows, error } = await fetchMessageRows()

    if (error) {
      console.error('[Chat] init:', error.message)
      set({ isLoaded: true, lastError: `Erro ao carregar Resenha: ${error.message}` })
      return
    }

    const messageRows = rows ?? []
    await fetchProfiles(messageRows.map(row => row.user_id))
    let messages = messageRows.map(row => mapRow(row, myUserId))

    const [{ data: voteRows }, reactionsResult, { data: pinData }, profiles] = await Promise.all([
      supabase.from('poll_votes').select('message_id, user_id, option_id'),
      supabase.from('chat_message_reactions').select('message_id, user_id, emoji, created_at'),
      supabase.from('channel_pins').select('message_id').eq('channel_id', CHANNEL_ID).maybeSingle(),
      directoryPromise,
    ])

    messages = applyVotes(messages, (voteRows ?? []) as VoteRow[])
    if (!reactionsResult.error) {
      messages = applyReactions(messages, (reactionsResult.data ?? []) as ReactionRow[])
    }

    set({
      messages,
      profiles,
      pinnedId: (pinData as PinRow | null)?.message_id ?? null,
      isLoaded: true,
    })

    const channel = supabase
      .channel('resenha-geral', {
        config: {
          presence: { key: myUserId },
          broadcast: { self: false },
        },
      })
      .on('presence', { event: 'sync' }, () => {
        set(extractPresence(channel.presenceState() as Record<string, PresencePayload[]>, get()._myUserId))
      })
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chat_messages', filter: `channel_id=eq.${CHANNEL_ID}` },
        async (payload) => {
          const row = (payload.new ?? payload.old) as MessageRow
          if (!row?.id) return

          if (payload.eventType === 'DELETE' || row.deleted_at) {
            set(s => ({
              messages: s.messages.filter(m => m.id !== row.id),
              pinnedId: s.pinnedId === row.id ? null : s.pinnedId,
            }))
            return
          }

          await ensureProfile(row.user_id)
          const next = mapRow(row, get()._myUserId)
          set(s => ({ messages: mergeMessage(s.messages, next) }))
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'poll_votes' },
        (payload) => {
          const row = payload.new as VoteRow
          if (!row?.message_id) return
          set(s => ({ messages: applyVotes(s.messages, [row]) }))
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chat_message_reactions' },
        (payload) => {
          const row = (payload.new ?? payload.old) as ReactionRow
          if (!row?.message_id) return
          set(s => ({
            messages: s.messages.map(m => {
              if (m.id !== row.message_id) return m
              const without = (m.reactions ?? []).filter(r => !(r.userId === row.user_id && r.emoji === row.emoji))
              if (payload.eventType === 'DELETE') return { ...m, reactions: without }
              return {
                ...m,
                reactions: [...without, { emoji: row.emoji, userId: row.user_id, createdAt: row.created_at }],
              }
            }),
          }))
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'channel_pins', filter: `channel_id=eq.${CHANNEL_ID}` },
        (payload) => {
          const row = (payload.new ?? payload.old) as PinRow | null
          set({ pinnedId: row?.message_id ?? null })
        },
      )
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ userId: myUserId, typing: false, onlineAt: new Date().toISOString() })
        }
      })

    set({ _channel: channel })
  },

  destroy: () => {
    const { _channel, _typingTimer } = get()
    if (_typingTimer) clearTimeout(_typingTimer)
    if (_channel) supabase.removeChannel(_channel)
    set({
      messages: [],
      pinnedId: null,
      onlineUserIds: [],
      typingUserIds: [],
      isLoaded: false,
      lastError: null,
      _myUserId: undefined,
      _channel: null,
      _typingTimer: null,
    })
  },

  clearError: () => set({ lastError: null }),

  setTyping: (typing) => {
    const { _channel, _myUserId, _typingTimer } = get()
    if (!_channel || !_myUserId) return
    if (_typingTimer) clearTimeout(_typingTimer)

    void _channel.track({ userId: _myUserId, typing, onlineAt: new Date().toISOString() })
    if (typing) {
      const timer = setTimeout(() => get().setTyping(false), 3000)
      set({ _typingTimer: timer })
    } else {
      set({ _typingTimer: null })
    }
  },

  addMessage: (msg) => {
    if (isRateLimited(msg.type)) {
      set({ lastError: 'Calma ai: muitas mensagens em sequencia.' })
      return
    }

    const cleanText = sanitizeText(msg.text ?? '', 1000)
    const mediaUrl = msg.mediaUrl ?? msg.videoUrl ?? msg.imageUrl ?? msg.audioUrl ?? msg.gifUrl
    if (msg.type === 'text' && !cleanText) {
      set({ lastError: 'Mensagem vazia ou invalida.' })
      return
    }
    if (msg.type !== 'text' && msg.type !== 'poll' && !mediaUrl) {
      set({ lastError: 'Midia invalida ou nao enviada.' })
      return
    }
    if (isMockMode) {
      set({ lastError: 'Supabase nao esta configurado. Mensagens nao sao salvas em modo local.' })
      return
    }

    const normalized: ChatMessage = {
      ...msg,
      text: cleanText,
      reactions: msg.reactions ?? [],
      mentions: msg.mentions ?? mentionsFromText(cleanText, get().profiles),
    }

    if (normalized.userId && !profileCache.has(normalized.userId)) {
      profileCache.set(normalized.userId, {
        id: normalized.userId,
        firstName: normalized.who.split(' ')[0] ?? '',
        lastName: normalized.who.split(' ').slice(1).join(' '),
        dept: normalized.dept,
        initials: normalized.initials,
        color: normalized.color,
        avatarUrl: normalized.avatarUrl,
      })
    }

    set(s => ({ messages: mergeMessage(s.messages, normalized) }))
    get().setTyping(false)

    const row: Record<string, unknown> = {
      id: normalized.id,
      user_id: normalized.userId,
      channel_id: normalized.channelId ?? CHANNEL_ID,
      text: normalized.text ?? '',
      type: normalized.type ?? 'text',
      mentions: normalized.mentions ?? [],
    }

    if (normalized.replyTo) row.reply_to = normalized.replyTo
    if (normalized.poll) row.poll_data = normalized.poll
    if (normalized.gifUrl) row.gif_url = normalized.gifUrl
    if (normalized.imageUrl) row.image_url = normalized.imageUrl
    if (normalized.audioUrl) row.audio_url = normalized.audioUrl
    if (normalized.audioDuration) row.audio_duration = normalized.audioDuration
    if (mediaUrl) row.media_url = mediaUrl
    if (normalized.mediaKind) row.media_kind = normalized.mediaKind
    if (normalized.mediaMime) row.media_mime = normalized.mediaMime
    if (normalized.mediaSize) row.media_size = normalized.mediaSize
    if (normalized.mediaDuration) row.media_duration = normalized.mediaDuration
    if (normalized.mediaThumbnailUrl) row.media_thumbnail_url = normalized.mediaThumbnailUrl

    insertMessageRow(row).then((error) => {
      if (!error) return
      console.error('[Chat] send:', error.message)
      set(s => ({
        messages: s.messages.filter(m => m.id !== normalized.id),
        lastError: `Erro ao enviar: ${error.message}`,
      }))
    })
  },

  toggleReaction: async (messageId, emoji) => {
    const userId = get()._myUserId
    if (!userId) return
    if (isMockMode) {
      set({ lastError: 'Supabase nao esta configurado. Reacoes exigem persistencia real.' })
      return
    }

    const message = get().messages.find(m => m.id === messageId)
    const exists = message?.reactions?.some(r => r.userId === userId && r.emoji === emoji) ?? false
    const optimistic: ChatReaction = { emoji, userId, createdAt: new Date().toISOString() }

    set(s => ({
      messages: s.messages.map(m => {
        if (m.id !== messageId) return m
        const without = (m.reactions ?? []).filter(r => !(r.userId === userId && r.emoji === emoji))
        return { ...m, reactions: exists ? without : [...without, optimistic] }
      }),
    }))

    const request = exists
      ? supabase.from('chat_message_reactions').delete().eq('message_id', messageId).eq('user_id', userId).eq('emoji', emoji)
      : supabase.from('chat_message_reactions').insert({ message_id: messageId, user_id: userId, emoji })
    const { error } = await request

    if (error) {
      console.error('[Chat] reaction:', error.message)
      set({ lastError: `Erro na reacao: ${error.message}` })
      set(s => ({
        messages: s.messages.map(m => {
          if (m.id !== messageId) return m
          const without = (m.reactions ?? []).filter(r => !(r.userId === userId && r.emoji === emoji))
          return { ...m, reactions: exists ? [...without, optimistic] : without }
        }),
      }))
    }
  },

  setPinned: async (id) => {
    const myUserId = get()._myUserId
    if (isMockMode) {
      set({ lastError: 'Supabase nao esta configurado. Fixar mensagens exige persistencia real.' })
      return
    }

    set({ pinnedId: id })
    const { error } = id === null
      ? await supabase.from('channel_pins').delete().eq('channel_id', CHANNEL_ID)
      : await supabase.from('channel_pins').upsert(
        { channel_id: CHANNEL_ID, message_id: id, pinned_by: myUserId },
        { onConflict: 'channel_id' },
      )

    if (error) set({ lastError: `Erro ao fixar: ${error.message}` })
  },

  voteOnPoll: async (msgId, userId, optionId) => {
    if (isMockMode) {
      set({ lastError: 'Supabase nao esta configurado. Votos nao sao salvos em modo local.' })
      return
    }

    const before = get().messages
    set(s => ({ messages: applyVotes(s.messages, [{ message_id: msgId, user_id: userId, option_id: optionId }]) }))

    const { error } = await supabase.from('poll_votes').upsert(
      { message_id: msgId, user_id: userId, option_id: optionId, voted_at: new Date().toISOString() },
      { onConflict: 'message_id,user_id' },
    )

    if (error) {
      console.error('[Chat] vote:', error.message)
      set({ messages: before, lastError: `Erro ao votar: ${error.message}` })
    }
  },

  deleteMessage: async (id) => {
    if (isMockMode) {
      set({ lastError: 'Supabase nao esta configurado. Moderacao exige persistencia real.' })
      return
    }

    const before = get().messages
    set(s => ({
      messages: s.messages.filter(m => m.id !== id),
      pinnedId: s.pinnedId === id ? null : s.pinnedId,
    }))

    const { error } = await supabase.functions.invoke('delete-chat-message', {
      body: { id },
    })
    if (error) {
      console.error('[Chat] delete:', error.message)
      set({ messages: before, lastError: `Erro ao apagar: ${error.message}` })
      return
    }
  },
}))
