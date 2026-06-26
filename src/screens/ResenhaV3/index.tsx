import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useAuthStore } from '@/stores/auth.store'
import { useChatStore, type ChatProfile } from '@/stores/chat.store'
import { useIsDesktop } from '@/hooks/useBreakpoint'
import { uploadChatMedia } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { optimizedImageUrl } from '@/lib/img'
import { isSafeHttpUrl } from '@/lib/security'
import type { ChatMessage, ChatPoll } from '@/types'
import { Avatar } from '@/components/shared/Avatar'
import { FloatingTooltip } from '@/components/shared/FloatingTooltip'
import { PollModal } from '@/screens/ResenhaV2/components/PollModal'
import { ProfileSheet } from '@/screens/ResenhaV2/components/ProfileSheet'
import { ImageViewer } from '@/screens/ResenhaV2/components/ImageViewer'
import { PollCard } from '@/screens/ResenhaV2/components/PollCard'
import { AudioBubble } from '@/screens/ResenhaV2/components/AudioBubble'
import { VideoBubble } from '@/screens/ResenhaV2/components/VideoBubble'
import { MentionText } from '@/screens/ResenhaV2/components/MentionText'
import { formatDayLabel, getContentPreview, minutesBetween } from '@/screens/ResenhaV2/utils/chatUi'
import { useAudioRecorder } from '@/screens/ResenhaV2/hooks/useAudioRecorder'
import { fetchGifs, type GifResult } from '@/screens/ResenhaV2/utils/gifApi'

const CHANNEL_ID = 'geral'
const QUICK_REACTIONS = ['👍', '😂', '🔥', '👏', '😮', '💚']

type TimelineItem =
  | { kind: 'date'; key: string; label: string }
  | { kind: 'message'; message: ChatMessage; grouped: boolean }

function buildReply(message: ChatMessage) {
  return {
    id: message.id,
    who: message.who,
    text: message.text,
    type: message.type ?? 'text',
  }
}

function chooseFile(accept: string, capture?: 'user' | 'environment'): Promise<File | null> {
  return new Promise(resolve => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    if (capture) input.setAttribute('capture', capture)
    input.style.position = 'fixed'
    input.style.left = '-9999px'
    input.onchange = () => {
      const file = input.files?.[0] ?? null
      input.remove()
      resolve(file)
    }
    input.oncancel = () => {
      input.remove()
      resolve(null)
    }
    document.body.appendChild(input)
    input.click()
  })
}

function initialsName(profile?: ChatProfile) {
  if (!profile) return 'Alguem'
  return profile.firstName || profile.initials || 'Alguem'
}

function useVideoNoteRecorder() {
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startRef = useRef(0)

  const start = useCallback(async () => {
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 480, height: 480 },
        audio: true,
      })
      const recorder = new MediaRecorder(media)
      chunksRef.current = []
      recorderRef.current = recorder
      startRef.current = Date.now()
      recorder.ondataavailable = event => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }
      recorder.start(100)
      setStream(media)
      setSeconds(0)
      setRecording(true)
      if (timerRef.current) clearInterval(timerRef.current)
      timerRef.current = setInterval(() => setSeconds(Math.floor((Date.now() - startRef.current) / 1000)), 500)
      return true
    } catch {
      return false
    }
  }, [])

  const stop = useCallback((): Promise<{ blob: Blob; duration: number } | null> => {
    return new Promise(resolve => {
      const recorder = recorderRef.current
      if (!recorder) {
        resolve(null)
        return
      }
      const duration = Math.max(1, Math.round((Date.now() - startRef.current) / 1000))
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'video/webm' })
        recorder.stream.getTracks().forEach(track => track.stop())
        if (timerRef.current) clearInterval(timerRef.current)
        setRecording(false)
        setSeconds(0)
        setStream(null)
        resolve({ blob, duration })
      }
      recorder.stop()
    })
  }, [])

  const cancel = useCallback(() => {
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') recorder.stop()
    stream?.getTracks().forEach(track => track.stop())
    if (timerRef.current) clearInterval(timerRef.current)
    chunksRef.current = []
    setRecording(false)
    setSeconds(0)
    setStream(null)
  }, [stream])

  return { recording, seconds, stream, start, stop, cancel }
}

export function ResenhaScreen() {
  const isDesktop = useIsDesktop()
  const { user } = useAuthStore()
  const {
    messages,
    profiles,
    pinnedId,
    onlineUserIds,
    typingUserIds,
    isLoaded,
    lastError,
    addMessage,
    clearError,
    setPinned,
    voteOnPoll,
    deleteMessage,
    toggleReaction,
    setTyping,
  } = useChatStore()

  const [draft, setDraft] = useState(() => {
    try { return localStorage.getItem('resenha-v3-draft') ?? '' } catch { return '' }
  })
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null)
  const [profileMsg, setProfileMsg] = useState<ChatMessage | null>(null)
  const [gifOpen, setGifOpen] = useState(false)
  const [pollOpen, setPollOpen] = useState(false)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [actionMenu, setActionMenu] = useState(false)
  const [onlineMenuOpen, setOnlineMenuOpen] = useState(false)
  const [messageMenuId, setMessageMenuId] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const endRef = useRef<HTMLDivElement | null>(null)
  const initialScrollDone = useRef(false)
  const nearBottomRef = useRef(true)

  // Mantém registro de "o usuário está coladinho no fim?" — define se mensagens
  // novas devem rolar sozinhas (sim, se está no fim) ou respeitar a leitura dele.
  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (el) nearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 160
  }, [])
  const actionButtonRef = useRef<HTMLButtonElement | null>(null)
  const actionPanelRef = useRef<HTMLDivElement | null>(null)
  const videoAutoStopRef = useRef(false)
  const audio = useAudioRecorder()
  const videoNote = useVideoNoteRecorder()

  const isAdmin = Boolean(user?.isAdmin || user?.isOwner)
  const combinedError = error || lastError
  const pinnedMsg = pinnedId ? messages.find(message => message.id === pinnedId) : null

  const onlineProfiles = useMemo(() => {
    const ids = onlineUserIds.length > 0 ? onlineUserIds : user?.id ? [user.id] : []
    const uniqueIds = Array.from(new Set(ids))
    return uniqueIds
      .map(id => {
        const profile = profiles.find(item => item.id === id)
        if (profile) return profile
        if (id === user?.id) {
          return {
            id,
            firstName: user.firstName,
            lastName: user.lastName,
            dept: user.dept,
            initials: user.initials,
            color: user.color,
            avatarUrl: user.avatarUrl,
          } satisfies ChatProfile
        }
        return null
      })
      .filter((profile): profile is ChatProfile => Boolean(profile))
      .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`, 'pt-BR'))
  }, [onlineUserIds, profiles, user])

  // Conta apenas quem conseguimos exibir, para o número bater com a lista.
  const onlineCount = onlineProfiles.length || 1

  const typingLabel = useMemo(() => {
    if (typingUserIds.length === 0) return ''
    const names = typingUserIds
      .slice(0, 2)
      .map(id => initialsName(profiles.find(profile => profile.id === id)))
      .join(', ')
    return `${names} ${typingUserIds.length > 1 ? 'estao digitando' : 'esta digitando'}`
  }, [profiles, typingUserIds])

  const timeline = useMemo<TimelineItem[]>(() => {
    const items: TimelineItem[] = []
    let lastDay = ''
    let lastUser = ''
    let lastTime = ''

    for (const message of messages) {
      const day = new Date(message.createdAt).toDateString()
      if (day !== lastDay) {
        items.push({ kind: 'date', key: `date-${message.createdAt}`, label: formatDayLabel(message.createdAt) })
        lastDay = day
        lastUser = ''
        lastTime = ''
      }
      const grouped = message.userId === lastUser && message.type !== 'poll' && lastTime && minutesBetween(lastTime, message.createdAt) <= 5
      items.push({ kind: 'message', message, grouped: Boolean(grouped) })
      lastUser = message.userId
      lastTime = message.createdAt
    }
    return items
  }, [messages])

  const mentionSuggestions = useMemo(() => {
    const match = draft.match(/(?:^|\s)@([\p{L}\p{N}_-]{0,24})$/u)
    if (!match) return []
    const query = (match[1] ?? '').toLocaleLowerCase('pt-BR')
    return profiles
      .filter(profile => {
        const name = `${profile.firstName} ${profile.lastName}`.trim().toLocaleLowerCase('pt-BR')
        return name.includes(query) || profile.dept.toLocaleLowerCase('pt-BR').includes(query)
      })
      .slice(0, 6)
  }, [draft, profiles])

  // Posiciona no FIM antes de o navegador pintar (useLayoutEffect) → abre já na
  // última mensagem, sem aquele "pulo pro meio e depois pro fim". Depois, só
  // acompanha mensagem nova se o usuário já estava no fim; senão respeita a
  // rolagem dele. Imagens têm tamanho reservado (abaixo), então não empurram.
  useLayoutEffect(() => {
    if (!messages.length) return
    const el = scrollRef.current
    if (!el) return
    if (!initialScrollDone.current) {
      initialScrollDone.current = true
      el.scrollTop = el.scrollHeight
      nearBottomRef.current = true
    } else if (nearBottomRef.current) {
      el.scrollTop = el.scrollHeight
    }
  }, [messages.length])

  // Backstop do realtime. ANTES o 1º poll só rodava +12s depois de abrir, então,
  // quando o WebSocket não entregava na hora (comum no mobile/ao navegar), a
  // Resenha demorava ~10s pra mostrar mensagens novas. Agora busca NA HORA que
  // abre e ao voltar o foco, e segue de backstop a cada 8s.
  useEffect(() => {
    const tick = () => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        void useChatStore.getState().pollNewMessages()
      }
    }
    tick() // catch-up imediato ao abrir
    const onVisible = () => { if (document.visibilityState === 'visible') tick() }
    document.addEventListener('visibilitychange', onVisible)
    const id = window.setInterval(tick, 8000)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  useEffect(() => {
    return () => setTyping(false)
  }, [setTyping])

  useEffect(() => {
    if (!isAdmin) setOnlineMenuOpen(false)
  }, [isAdmin])

  useEffect(() => {
    if (!actionMenu) return

    const handlePointerDown = (event: PointerEvent | MouseEvent) => {
      const target = event.target as Node | null
      if (!target) return
      if (actionButtonRef.current?.contains(target)) return
      if (actionPanelRef.current?.contains(target)) return
      setActionMenu(false)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActionMenu(false)
    }
    const handleScroll = () => setActionMenu(false)

    document.addEventListener('pointerdown', handlePointerDown, true)
    document.addEventListener('mousedown', handlePointerDown, true)
    document.addEventListener('click', handlePointerDown, true)
    document.addEventListener('keydown', handleKeyDown)
    window.addEventListener('scroll', handleScroll, true)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true)
      document.removeEventListener('mousedown', handlePointerDown, true)
      document.removeEventListener('click', handlePointerDown, true)
      document.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('scroll', handleScroll, true)
    }
  }, [actionMenu])

  useEffect(() => {
    if (videoNote.recording && videoNote.seconds >= 10 && !videoAutoStopRef.current) {
      videoAutoStopRef.current = true
      void finishVideoNoteRecording()
    }
    if (!videoNote.recording) videoAutoStopRef.current = false
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoNote.seconds, videoNote.recording])

  const buildMessage = useCallback((overrides: Partial<ChatMessage>): ChatMessage => ({
    id: crypto.randomUUID(),
    userId: user?.id ?? 'me',
    channelId: CHANNEL_ID,
    who: user ? `${user.firstName} ${user.lastName}`.trim() : 'Voce',
    dept: user?.dept ?? '',
    initials: user?.initials ?? 'EU',
    color: user?.color ?? '#00A651',
    avatarUrl: user?.avatarUrl,
    time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    text: '',
    type: 'text',
    createdAt: new Date().toISOString(),
    isYou: true,
    ...overrides,
  }), [user])

  const sendText = useCallback(() => {
    const text = draft.trim()
    if (!text) return
    addMessage(buildMessage({
      type: 'text',
      text,
      replyTo: replyingTo ? buildReply(replyingTo) : undefined,
    }))
    setDraft('')
    setReplyingTo(null)
    setTyping(false)
    try { localStorage.removeItem('resenha-v3-draft') } catch { /* ignore */ }
  }, [addMessage, buildMessage, draft, replyingTo, setTyping])

  const setDraftValue = (value: string) => {
    setDraft(value)
    setTyping(value.trim().length > 0)
    try { localStorage.setItem('resenha-v3-draft', value) } catch { /* ignore */ }
  }

  const insertMention = (profile: ChatProfile) => {
    const label = `@${profile.firstName || profile.initials}`
    setDraftValue(draft.replace(/(?:^|\s)@([\p{L}\p{N}_-]{0,24})$/u, match => `${match.startsWith(' ') ? ' ' : ''}${label} `))
  }

  const sendGif = (url: string) => {
    addMessage(buildMessage({
      type: 'gif',
      gifUrl: url,
      mediaUrl: url,
      mediaKind: 'gif',
      replyTo: replyingTo ? buildReply(replyingTo) : undefined,
    }))
    setReplyingTo(null)
    setGifOpen(false)
  }

  const sendPoll = (poll: ChatPoll) => {
    addMessage(buildMessage({ type: 'poll', text: poll.question, poll }))
    setPollOpen(false)
  }

  const sendMedia = async (kind: 'image' | 'video' | 'video_note', source?: File | Blob, duration?: number) => {
    if (!user?.id) return
    const file = source ?? await chooseFile(kind === 'image' ? 'image/*' : 'video/*', kind === 'video_note' ? 'user' : undefined)
    if (!file) return
    setUploading(kind)
    try {
      const url = await uploadChatMedia(user.id, file, kind)
      const size = file.size
      const mime = file.type
      addMessage(buildMessage({
        type: kind,
        imageUrl: kind === 'image' ? url : undefined,
        videoUrl: kind === 'video' || kind === 'video_note' ? url : undefined,
        mediaUrl: url,
        mediaKind: kind,
        mediaMime: mime,
        mediaSize: size,
        mediaDuration: duration,
        replyTo: replyingTo ? buildReply(replyingTo) : undefined,
      }))
      setReplyingTo(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao enviar midia.')
    } finally {
      setUploading(null)
      setActionMenu(false)
    }
  }

  const startAudioRecording = async () => {
    const ok = await audio.start()
    if (!ok) setError('Permissao de microfone negada.')
  }

  const finishAudioRecording = async () => {
    if (!user?.id) return
    const result = await audio.stop()
    if (!result) return
    audio.setUploading(true)
    try {
      const url = await uploadChatMedia(user.id, result.blob, 'audio')
      addMessage(buildMessage({
        type: 'audio',
        audioUrl: url,
        audioDuration: result.duration,
        mediaUrl: url,
        mediaKind: 'audio',
        mediaMime: result.blob.type || 'audio/webm',
        mediaSize: result.blob.size,
        mediaDuration: result.duration,
        replyTo: replyingTo ? buildReply(replyingTo) : undefined,
      }))
      setReplyingTo(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao enviar audio.')
    } finally {
      audio.setUploading(false)
    }
  }

  const startVideoNoteRecording = async () => {
    const ok = await videoNote.start()
    if (!ok) setError('Permissao de camera negada.')
  }

  const finishVideoNoteRecording = async () => {
    if (!user?.id) return
    const result = await videoNote.stop()
    if (!result) return
    await sendMedia('video_note', result.blob, result.duration)
  }

  const deleteMessageById = async () => {
    if (!deleteId) return
    await deleteMessage(deleteId)
    setDeleteId(null)
  }

  const openActionMenu = () => {
    setMessageMenuId(null)
    setActionMenu(value => !value)
  }

  return (
    <div className="min-h-0 flex-1 bg-app text-ink">
      <div
        className="overflow-hidden"
        style={{
          height: isDesktop
            ? 'calc(100dvh - 5.75rem)'
            : 'calc(100dvh - 3.5rem - env(safe-area-inset-bottom, 0px))',
        }}
      >
        <section className="flex h-full min-h-0 flex-col">
          <header className="flex shrink-0 items-center justify-between gap-2 border-b border-hairline bg-paper px-3 py-2 shadow-card sm:gap-3 sm:px-4 sm:py-3">
            <div className="min-w-0">
              <div className="flex items-end gap-3">
                <div className="font-display text-3xl leading-none sm:text-4xl">RESENHA</div>
                <div className="flex items-baseline gap-1.5 pb-0.5 sm:gap-2">
                  <span className="font-serif-it text-2xl text-green-deep leading-none">aí,</span>
                  {isAdmin ? (
                    <OnlineUsersDropdown
                      count={onlineCount}
                      open={onlineMenuOpen}
                      profiles={onlineProfiles}
                      onToggle={() => setOnlineMenuOpen(value => !value)}
                    />
                  ) : (
                    <span className="rounded-full bg-green px-2 py-0.5 font-mono text-[9px] font-bold text-white flex-shrink-0">
                      {onlineCount} ONLINE
                    </span>
                  )}
                </div>
              </div>
              <p className="mt-0.5 truncate font-mono text-[10px] text-ink-3">
                {typingLabel || 'grupo oficial do bolao'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setPollOpen(true)} className="hidden border border-line-strong bg-inverse px-3 py-2 font-mono text-[10px] font-bold text-inverse-text transition hover:bg-surface-hover sm:block">
                ENQUETE
              </button>
              <button type="button" onClick={() => setGifOpen(true)} className="border border-yellow bg-yellow px-2.5 py-1.5 font-mono text-[9px] font-bold text-[#0D0D0D] shadow-btn transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-none sm:px-3 sm:py-2 sm:text-[10px]">
                GIF
              </button>
            </div>
          </header>

          <AnimatePresence>
            {pinnedMsg && (
              <motion.div
                initial={{ y: -12, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -12, opacity: 0 }}
                className="flex shrink-0 items-center gap-3 border-b border-yellow/60 bg-yellow/20 px-4 py-2"
              >
                <button type="button" onClick={() => setReplyingTo(pinnedMsg)} className="min-w-0 flex-1 text-left">
                  <span className="font-mono text-[9px] font-bold text-ink">FIXADA</span>
                  <span className="ml-2 font-sans text-sm text-ink-2">{getContentPreview(pinnedMsg)}</span>
                </button>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => void setPinned(null)}
                    className="shrink-0 border border-yellow/70 bg-card px-2.5 py-1 font-mono text-[9px] font-bold text-ink transition hover:bg-yellow hover:text-[#0D0D0D]"
                  >
                    DESFIXAR
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <div ref={scrollRef} onScroll={handleScroll} className="min-h-0 flex-1 overflow-y-auto px-1.5 py-2.5 sm:px-4 sm:py-4">
            {!isLoaded && <LoadingChat />}
            {isLoaded && messages.length === 0 && <EmptyResenha />}

            <AnimatePresence initial={false}>
              {timeline.map((item, index) => {
                if (item.kind === 'date') return <DateMarker key={item.key} label={item.label} />
                const messagesAfter = timeline.slice(index + 1).filter(next => next.kind === 'message').length
                return (
                  <MessageRow
                    key={item.message.id}
                    message={item.message}
                    grouped={item.grouped}
                    currentUserId={user?.id}
                    profiles={profiles}
                    isAdmin={isAdmin}
                    isPinned={pinnedId === item.message.id}
                    menuOpen={messageMenuId === item.message.id}
                    openMenuUp={messagesAfter < 2}
                    onToggleMenu={() => { setActionMenu(false); setMessageMenuId(messageMenuId === item.message.id ? null : item.message.id) }}
                    onCloseMenu={() => setMessageMenuId(null)}
                    onReact={emoji => { void toggleReaction(item.message.id, emoji); setMessageMenuId(null) }}
                    onReply={() => { setReplyingTo(item.message); setMessageMenuId(null) }}
                    onOpenProfile={() => setProfileMsg(item.message)}
                    onPin={() => { void setPinned(pinnedId === item.message.id ? null : item.message.id); setMessageMenuId(null) }}
                    onDelete={() => { setDeleteId(item.message.id); setMessageMenuId(null) }}
                    onVote={optionId => void voteOnPoll(item.message.id, user?.id ?? 'me', optionId)}
                    onImage={setLightboxUrl}
                  />
                )
              })}
            </AnimatePresence>
            <div ref={endRef} />
          </div>

          <footer className="shrink-0 border-t border-hairline bg-paper/95 shadow-[0_-6px_16px_rgba(0,0,0,0.06)] backdrop-blur-sm">
            <AnimatePresence>
              {gifOpen && (
                <GifDock
                  onSelect={sendGif}
                  onClose={() => setGifOpen(false)}
                />
              )}
            </AnimatePresence>

            <AnimatePresence>
              {combinedError && (
                <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                  <div className="flex items-center justify-between border-b border-red/20 bg-red/8 px-4 py-2">
                    <span className="font-mono text-[10px] text-red">{combinedError}</span>
                    <button type="button" onClick={() => { setError(null); clearError() }} className="font-mono text-[10px] text-red">FECHAR</button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {replyingTo && (
              <div className="flex items-center justify-between gap-3 border-b border-hairline bg-surface-2 px-4 py-2">
                <div className="min-w-0 border-l-2 border-green pl-3">
                  <div className="font-mono text-[9px] font-bold text-green">RESPONDENDO {replyingTo.who}</div>
                  <div className="truncate font-sans text-xs text-ink-3">{getContentPreview(replyingTo)}</div>
                </div>
                <button type="button" onClick={() => setReplyingTo(null)} className="font-mono text-[10px] text-ink-3 hover:text-ink">CANCELAR</button>
              </div>
            )}

            {mentionSuggestions.length > 0 && (
              <div className="flex gap-2 overflow-x-auto border-b border-hairline px-3 py-2">
                {mentionSuggestions.map(profile => (
                  <button key={profile.id} type="button" onClick={() => insertMention(profile)} className="flex shrink-0 items-center gap-2 border border-hairline bg-card px-2 py-1.5 hover:border-line-strong">
                    <Avatar initials={profile.initials} color={profile.color} src={profile.avatarUrl} size={24} />
                    <span className="font-mono text-[10px] font-bold">{profile.firstName} {profile.lastName}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-end gap-1.5 px-2 py-2 sm:gap-2 sm:px-4 sm:py-2.5">
              <div className="relative">
                <button ref={actionButtonRef} type="button" onClick={openActionMenu} className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 border-line-strong bg-card font-display text-lg transition hover:bg-yellow hover:text-[#0D0D0D] sm:h-11 sm:w-11 sm:text-xl', actionMenu && 'bg-yellow text-[#0D0D0D]')}>
                  +
                </button>
                <AnimatePresence>
                  {actionMenu && (
                    <motion.div ref={actionPanelRef} initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 8, opacity: 0 }} className="absolute bottom-full left-0 z-50 mb-2 w-56 overflow-hidden rounded-2xl ui-card">
                      <ActionButton label="Foto" detail="imagem do celular" busy={uploading === 'image'} onClick={() => { setActionMenu(false); void sendMedia('image') }} />
                      <ActionButton label="Video" detail="arquivo ou camera" busy={uploading === 'video'} onClick={() => { setActionMenu(false); void sendMedia('video') }} />
                      <ActionButton label="Enquete" detail="votacao do grupo" onClick={() => { setPollOpen(true); setActionMenu(false) }} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <textarea
                value={draft}
                onChange={event => setDraftValue(event.target.value.slice(0, 1000))}
                onFocus={() => setMessageMenuId(null)}
                onBlur={() => setTyping(false)}
                onKeyDown={event => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    sendText()
                  }
                }}
                rows={1}
                placeholder="Mensagem"
                className="max-h-24 min-h-9 flex-1 resize-none rounded-[18px] border border-hairline bg-card px-3 py-2 font-sans text-sm leading-5 outline-none transition placeholder:text-ink-4 focus:border-line-strong sm:max-h-32 sm:min-h-11 sm:rounded-[22px] sm:px-4 sm:py-3 sm:text-[15px]"
              />

              <button type="button" onClick={startVideoNoteRecording} disabled={videoNote.recording || audio.recording} className={cn('hidden h-11 w-11 shrink-0 place-items-center rounded-full border border-hairline bg-card font-mono text-[9px] font-bold text-ink-3 transition hover:border-line-strong hover:bg-surface-hover hover:text-ink disabled:opacity-40 sm:grid', videoNote.recording && 'border-red bg-red text-white')}>
                CAM
              </button>
              <button type="button" onClick={startAudioRecording} disabled={audio.uploading || audio.recording || videoNote.recording} className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-full border border-hairline bg-card font-mono text-[8px] font-bold text-ink-3 transition hover:border-red hover:bg-surface-hover hover:text-red disabled:opacity-50 sm:h-11 sm:w-11 sm:text-[9px]', audio.recording && 'border-red bg-red text-white')}>
                {audio.recording ? `${audio.seconds}s` : 'MIC'}
              </button>
              <button type="button" onClick={sendText} disabled={!draft.trim()} className="h-9 min-w-12 shrink-0 rounded-[18px] bg-green px-3 font-mono text-[9px] font-bold text-white shadow-btn transition hover:bg-green/90 disabled:opacity-40 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none sm:h-11 sm:min-w-16 sm:rounded-[22px] sm:px-4 sm:text-[10px]">
                ENVIAR
              </button>
            </div>

            <AnimatePresence>
              {(audio.recording || audio.uploading) && (
                <motion.div initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 16, opacity: 0 }} className="flex flex-col gap-3 border-t border-red/20 bg-red/8 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <span className="h-3 w-3 rounded-full bg-red animate-pulse" />
                    <div>
                      <div className="font-mono text-[10px] font-bold text-red">GRAVANDO AUDIO · {audio.seconds}s</div>
                      {audio.uploading && <div className="font-sans text-xs text-ink-3">enviando...</div>}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={audio.cancel} disabled={audio.uploading} className="flex-1 border border-red px-3 py-2 font-mono text-[10px] text-red disabled:opacity-40 sm:flex-none">CANCELAR</button>
                    <button type="button" onClick={() => void finishAudioRecording()} disabled={audio.uploading} className="flex-1 bg-red px-4 py-2 font-mono text-[10px] font-bold text-white disabled:opacity-40 sm:flex-none">ENVIAR</button>
                  </div>
                </motion.div>
              )}

              {videoNote.recording && (
                <motion.div initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 16, opacity: 0 }} className="flex flex-col gap-3 border-t border-red/20 bg-red/8 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4">
                    <VideoPreview stream={videoNote.stream} />
                    <div>
                      <div className="font-mono text-[10px] font-bold text-red">GRAVANDO BOLINHA · {videoNote.seconds}s / 10s</div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={videoNote.cancel} className="flex-1 border border-red px-3 py-2 font-mono text-[10px] text-red sm:flex-none">CANCELAR</button>
                    <button type="button" onClick={() => void finishVideoNoteRecording()} className="flex-1 bg-red px-4 py-2 font-mono text-[10px] font-bold text-white sm:flex-none">ENVIAR</button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </footer>
        </section>
      </div>

      <AnimatePresence>
        {pollOpen && <PollModal onCreate={sendPoll} onClose={() => setPollOpen(false)} />}
        {profileMsg && <ProfileSheet m={profileMsg} onClose={() => setProfileMsg(null)} />}
        {lightboxUrl && <ImageViewer url={lightboxUrl} onClose={() => setLightboxUrl(null)} />}
        {deleteId && (
          <ConfirmDialog
            title="Apagar mensagem?"
            body="A mensagem sai da Resenha para todos."
            onCancel={() => setDeleteId(null)}
            onConfirm={() => void deleteMessageById()}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function MessageRow({
  message,
  grouped,
  currentUserId,
  profiles,
  isAdmin,
  isPinned,
  menuOpen,
  openMenuUp,
  onToggleMenu,
  onCloseMenu,
  onReact,
  onReply,
  onOpenProfile,
  onPin,
  onDelete,
  onVote,
  onImage,
}: {
  message: ChatMessage
  grouped: boolean
  currentUserId?: string
  profiles: ChatProfile[]
  isAdmin: boolean
  isPinned: boolean
  menuOpen: boolean
  openMenuUp: boolean
  onToggleMenu: () => void
  onCloseMenu: () => void
  onReact: (emoji: string) => void
  onReply: () => void
  onOpenProfile: () => void
  onPin: () => void
  onDelete: () => void
  onVote: (optionId: string) => void
  onImage: (url: string) => void
}) {
  const mine = message.isYou ?? message.userId === currentUserId
  const canDelete = mine || isAdmin
  const isMedia = message.type === 'image' || message.type === 'gif' || message.type === 'video' || message.type === 'video_note'
  const menuButtonRef = useRef<HTMLButtonElement | null>(null)
  const menuPanelRef = useRef<HTMLDivElement | null>(null)
  const [menuAnchor, setMenuAnchor] = useState<DOMRect | null>(null)
  const reactions = message.reactions ?? []
  const groupedReactions = QUICK_REACTIONS
    .map(emoji => {
      const who = reactions.filter(reaction => reaction.emoji === emoji)
      return {
        emoji,
        count: who.length,
        mine: who.some(reaction => reaction.userId === currentUserId),
        reactors: who.map(reaction => {
          const profile = profiles.find(p => p.id === reaction.userId)
          return {
            id: reaction.userId,
            name: profile ? (`${profile.firstName} ${profile.lastName}`.trim() || profile.initials) : 'Participante',
            initials: profile?.initials ?? '?',
            color: profile?.color ?? '#777',
            avatarUrl: profile?.avatarUrl,
          }
        }),
      }
    })
    .filter(reaction => reaction.count > 0)

  useEffect(() => {
    if (!menuOpen) {
      setMenuAnchor(null)
      return
    }

    if (menuButtonRef.current) {
      setMenuAnchor(menuButtonRef.current.getBoundingClientRect())
    }

    const handlePointerDown = (event: PointerEvent | MouseEvent) => {
      const target = event.target as Node | null
      if (!target) return
      if (menuButtonRef.current?.contains(target)) return
      if (menuPanelRef.current?.contains(target)) return
      onCloseMenu()
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseMenu()
    }
    const handleScroll = () => onCloseMenu()

    document.addEventListener('pointerdown', handlePointerDown, true)
    document.addEventListener('mousedown', handlePointerDown, true)
    document.addEventListener('click', handlePointerDown, true)
    document.addEventListener('keydown', handleKeyDown)
    window.addEventListener('scroll', handleScroll, true)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true)
      document.removeEventListener('mousedown', handlePointerDown, true)
      document.removeEventListener('click', handlePointerDown, true)
      document.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('scroll', handleScroll, true)
    }
  }, [menuOpen, onCloseMenu])

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className={cn('flex w-full gap-2 px-1', grouped ? 'mt-1' : 'mt-3', mine ? 'justify-end' : 'justify-start')}
    >
      {!mine && (
        <div className="w-9 shrink-0 self-start">
          {!grouped && (
            <button type="button" onClick={onOpenProfile} className="transition hover:scale-105">
              <Avatar initials={message.initials} color={message.color} src={message.avatarUrl} size={34} />
            </button>
          )}
        </div>
      )}

      <div className={cn('group relative max-w-[82%] sm:max-w-[72%] xl:max-w-[620px]', mine && 'items-end')}>
        <div
          className={cn(
            'relative min-w-0 overflow-visible border shadow-sm',
            mine ? 'rounded-[20px] rounded-br-[6px] border-green/40 bg-green/15' : 'rounded-[20px] rounded-bl-[6px] border-hairline bg-card',
            isMedia ? 'p-2' : 'pl-3.5 pr-9 pt-2.5 pb-2',
          )}
        >
          {!mine && !grouped && (
            <button type="button" onClick={onOpenProfile} className="mb-1 block max-w-full truncate text-left font-mono text-[10px] font-bold text-green hover:underline">
              {message.who}
              {message.dept && <span className="font-normal text-ink-4"> · {message.dept}</span>}
            </button>
          )}

          {message.replyTo && (
            <div className="mb-2 rounded-xl border-l-2 border-green bg-surface-2 px-3 py-2">
              <div className="font-mono text-[9px] font-bold text-green">{message.replyTo.who}</div>
              <div className="truncate font-sans text-xs text-ink-3">{getContentPreview({ type: message.replyTo.type as ChatMessage['type'], text: message.replyTo.text })}</div>
            </div>
          )}

          <MessageBody message={message} mine={mine} profiles={profiles} currentUserId={currentUserId} onVote={onVote} onImage={onImage} />

          <div className={cn('mt-1 flex items-center justify-end gap-1 font-mono text-[9px] text-ink-4', !isMedia && '-mr-6')}>
            {isPinned && <span>FIXADA</span>}
            <span>{message.time}</span>
          </div>
        </div>

        <button
          ref={menuButtonRef}
          type="button"
          onClick={onToggleMenu}
          className={cn(
            'absolute right-1.5 top-1.5 z-30 grid h-6 w-6 place-items-center rounded-full border border-hairline bg-card/85 font-mono text-[10px] leading-none text-ink-3 shadow-sm backdrop-blur-sm transition hover:border-yellow hover:bg-yellow hover:text-[#0D0D0D]',
            menuOpen && 'border-yellow bg-yellow text-[#0D0D0D]',
          )}
          aria-label="Opcoes da mensagem"
        >
          •••
        </button>

        <AnimatePresence>
          {menuOpen && (
            <MessageActionPanel
              anchorRect={menuAnchor}
              panelRef={menuPanelRef}
              mine={mine}
              openUp={openMenuUp}
              isAdmin={isAdmin}
              isPinned={isPinned}
              canDelete={canDelete}
              onReply={onReply}
              onPin={onPin}
              onDelete={onDelete}
              onReact={onReact}
            />
          )}
        </AnimatePresence>

        {groupedReactions.length > 0 && (
          <div className={cn('mt-1 flex flex-wrap gap-1', mine && 'justify-end')}>
            {groupedReactions.map(reaction => (
              <FloatingTooltip
                key={reaction.emoji}
                className="cursor-pointer"
                label={
                  <div className="space-y-1">
                    <div className="text-[11px] opacity-60">{reaction.emoji} {reaction.count === 1 ? 'reagiu' : 'reagiram'}</div>
                    {reaction.reactors.map(r => (
                      <div key={r.id} className="flex items-center gap-2">
                        <Avatar initials={r.initials} color={r.color} src={r.avatarUrl} size={18} />
                        <span>{r.name}</span>
                      </div>
                    ))}
                  </div>
                }
              >
                <span className={cn('inline-flex items-center rounded-full border px-2 py-1 text-xs', reaction.mine ? 'border-green bg-green text-white' : 'border-hairline bg-card')}>
                  {reaction.emoji} <span className="ml-1 font-mono text-[10px]">{reaction.count}</span>
                </span>
              </FloatingTooltip>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  )
}

function MessageBody({
  message,
  mine,
  profiles,
  currentUserId,
  onVote,
  onImage,
}: {
  message: ChatMessage
  mine: boolean
  profiles: ChatProfile[]
  currentUserId?: string
  onVote: (optionId: string) => void
  onImage: (url: string) => void
}) {
  if (message.type === 'poll' && message.poll) {
    return <PollCard poll={message.poll} userId={currentUserId} profiles={profiles} onVote={onVote} />
  }
  if (message.type === 'gif' && isSafeHttpUrl(message.gifUrl)) {
    // Altura reservada (h-44) → não empurra o layout ao carregar (chat liso).
    return <img src={message.gifUrl} alt="GIF" loading="lazy" className="h-44 w-full max-w-[260px] rounded-2xl object-contain bg-paper-deep" />
  }
  if (message.type === 'image' && isSafeHttpUrl(message.imageUrl)) {
    return (
      <button type="button" onClick={() => onImage(message.imageUrl!)} className="block overflow-hidden rounded-2xl active:scale-[0.98] transition-transform">
        <img src={optimizedImageUrl(message.imageUrl, { w: 540, fit: 'inside' })} alt="Foto" loading="lazy" className="h-44 w-[240px] object-cover bg-paper-deep transition hover:brightness-90" />
      </button>
    )
  }
  if (message.type === 'audio' && message.audioUrl) {
    return <AudioBubble src={message.audioUrl} initialDuration={message.audioDuration} isMine={mine} />
  }
  if ((message.type === 'video' || message.type === 'video_note') && (message.videoUrl || message.mediaUrl)) {
    return <VideoBubble src={message.videoUrl ?? message.mediaUrl} isNote={message.type === 'video_note'} />
  }
  return <MentionText text={message.text} profiles={profiles} />
}

function ActionButton({ label, detail, busy, onClick }: { label: string; detail: string; busy?: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} disabled={busy} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-yellow/30 disabled:opacity-50">
      <span>
        <span className="block font-mono text-[11px] font-bold text-ink">{label}</span>
        <span className="block font-sans text-xs text-ink-3">{detail}</span>
      </span>
      <span className="font-mono text-[10px] text-ink-4">{busy ? '...' : '→'}</span>
    </button>
  )
}

function MessageActionPanel({
  anchorRect,
  panelRef,
  mine,
  openUp,
  isAdmin,
  isPinned,
  canDelete,
  onReply,
  onPin,
  onDelete,
  onReact,
}: {
  anchorRect: DOMRect | null
  panelRef: RefObject<HTMLDivElement | null>
  mine: boolean
  openUp: boolean
  isAdmin: boolean
  isPinned: boolean
  canDelete: boolean
  onReply: () => void
  onPin: () => void
  onDelete: () => void
  onReact: (emoji: string) => void
}) {
  if (!anchorRect || typeof document === 'undefined') return null

  const panelWidth = Math.min(288, window.innerWidth - 16)
  const hasSpaceAbove = anchorRect.top > 280
  const opensUp = (openUp && hasSpaceAbove) || anchorRect.bottom > window.innerHeight - 330
  const preferredLeft = mine ? anchorRect.left - panelWidth - 10 : anchorRect.right + 10
  const left = Math.max(8, Math.min(preferredLeft, window.innerWidth - panelWidth - 8))
  const verticalStyle = opensUp
    ? { bottom: Math.max(8, window.innerHeight - anchorRect.top + 8) }
    : { top: Math.min(anchorRect.bottom + 8, window.innerHeight - 16) }

  return createPortal(
    <motion.div
      ref={panelRef}
      initial={{ opacity: 0, y: -4, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4, scale: 0.98 }}
      style={{ position: 'fixed', left, width: panelWidth, zIndex: 80, ...verticalStyle }}
      className="overflow-hidden rounded-2xl ui-card shadow-[0_18px_42px_rgba(0,0,0,0.18)]"
    >
      <div className="border-b border-hairline p-2">
        <div className="mb-2 px-2 font-mono text-[9px] font-bold text-ink-4">REAGIR</div>
        <div className="grid grid-cols-6 gap-1">
          {QUICK_REACTIONS.map(emoji => (
            <button
              key={emoji}
              type="button"
              onClick={() => onReact(emoji)}
              className="grid h-10 place-items-center rounded-xl border border-hairline bg-surface-2 text-lg transition hover:border-yellow hover:bg-yellow hover:text-[#0D0D0D]"
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
      <div className="p-1">
        <MenuAction label="Responder" detail="citar esta mensagem" onClick={onReply} />
        {isAdmin && <MenuAction label={isPinned ? 'Desafixar' : 'Fixar'} detail="destacar no topo" onClick={onPin} />}
        {canDelete && <MenuAction label="Apagar" detail={mine ? 'remover minha mensagem' : 'moderacao admin'} danger onClick={onDelete} />}
      </div>
    </motion.div>,
    document.body,
  )
}

function MenuAction({ label, detail, danger, onClick }: { label: string; detail: string; danger?: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={cn('flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition hover:bg-surface-hover', danger && 'text-red hover:bg-red/10')}>
      <span>
        <span className="block font-mono text-[11px] font-bold">{label}</span>
        <span className={cn('block font-sans text-xs text-ink-4', danger && 'text-red/60')}>{detail}</span>
      </span>
      <span className="font-mono text-[10px]">→</span>
    </button>
  )
}

function OnlineUsersDropdown({
  count,
  open,
  profiles,
  onToggle,
}: {
  count: number
  open: boolean
  profiles: ChatProfile[]
  onToggle: () => void
}) {
  return (
    <div className="relative flex-shrink-0">
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          'inline-flex items-center gap-1 rounded-full bg-green px-2 py-0.5 font-mono text-[9px] font-bold text-white transition hover:bg-green-deep',
          open && 'bg-green-deep',
        )}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        {count} ONLINE
        <span className={cn('text-[8px] transition-transform', open && 'rotate-180')}>v</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            className="absolute left-0 top-full z-50 mt-2 w-64 max-w-[calc(100vw-2rem)] overflow-hidden border border-line-strong bg-card shadow-[0_14px_34px_rgba(0,0,0,0.16)]"
            role="menu"
          >
            <div className="border-b border-hairline bg-surface-2 px-3 py-2 font-mono text-[9px] font-bold tracking-eyebrow text-ink-4">
              ONLINE AGORA
            </div>
            <div className="max-h-72 overflow-auto">
              {profiles.length > 0 ? (
                profiles.map(profile => {
                  const name = `${profile.firstName} ${profile.lastName}`.trim() || profile.initials

                  return (
                    <div key={profile.id} className="flex items-center gap-2 border-b border-hairline px-3 py-2 last:border-b-0" role="menuitem">
                      <Avatar initials={profile.initials} color={profile.color} src={profile.avatarUrl} size={26} />
                      <div className="min-w-0">
                        <div className="truncate font-mono text-[11px] font-bold">{name}</div>
                        <div className="truncate font-mono text-[9px] text-ink-4">{profile.dept || 'sem depto'}</div>
                      </div>
                      <span className="ml-auto h-2 w-2 flex-shrink-0 rounded-full bg-green" />
                    </div>
                  )
                })
              ) : (
                <div className="px-3 py-3 font-mono text-[10px] text-ink-4">
                  Aguardando presenca.
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function DateMarker({ label }: { label: string }) {
  return (
    <div className="my-4 flex justify-center">
      <span className="rounded-full border border-hairline bg-card px-3 py-1 font-mono text-[9px] font-bold text-ink-4">{label}</span>
    </div>
  )
}

function LoadingChat() {
  return (
    <div className="space-y-4 px-4">
      {[0, 1, 2, 3].map(index => (
        <div key={index} className={cn('h-16 animate-pulse rounded-2xl bg-surface-2', index % 2 ? 'ml-auto w-2/3' : 'w-1/2')} />
      ))}
    </div>
  )
}

function EmptyResenha() {
  return (
    <div className="mx-auto mt-16 max-w-md text-center">
      <div className="font-display text-3xl leading-none">COMECA A RESENHA</div>
      <p className="mt-3 font-sans text-sm text-ink-3">Mande a primeira mensagem, crie uma enquete ou solte um audio.</p>
    </div>
  )
}

function GifDock({ onSelect, onClose }: { onSelect: (url: string) => void; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [gifs, setGifs] = useState<GifResult[]>([])
  const [loading, setLoading] = useState(true)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchGifs('').then(result => {
      if (!cancelled) {
        setGifs(result)
        setLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      setLoading(true)
      fetchGifs(query).then(result => {
        setGifs(result)
        setLoading(false)
      })
    }, query.trim() ? 350 : 0)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [query])

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 280, opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ type: 'spring', damping: 28, stiffness: 320 }}
      className="overflow-hidden border-b border-hairline bg-surface-2"
    >
      <div className="flex items-center gap-2 border-b border-hairline px-3 py-2">
        <span className="font-mono text-[10px] font-bold text-ink">GIF</span>
        <input
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder="pesquisar gif..."
          autoFocus
          className="min-w-0 flex-1 bg-transparent font-sans text-[13px] outline-none placeholder:text-ink-4"
        />
        <button type="button" onClick={onClose} className="rounded-full border border-hairline px-3 py-1.5 font-mono text-[10px] text-ink-3 hover:border-red hover:text-red">
          FECHAR
        </button>
      </div>
      <div className="h-[238px] overflow-y-auto overscroll-contain p-2">
        {loading ? (
          <div className="grid h-full place-items-center font-mono text-[10px] text-ink-4">BUSCANDO...</div>
        ) : gifs.length === 0 ? (
          <div className="grid h-full place-items-center font-mono text-[10px] text-ink-4">NENHUM GIF</div>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
            {gifs.map(gif => (
              <button
                key={gif.id}
                type="button"
                onClick={() => { onSelect(gif.url); onClose() }}
                className="aspect-video overflow-hidden rounded-xl border border-hairline bg-hairline transition hover:scale-[1.02] hover:border-line-strong"
              >
                <img src={gif.preview} alt="" className="h-full w-full object-cover" loading="lazy" />
              </button>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  )
}

function ConfirmDialog({ title, body, onCancel, onConfirm }: { title: string; body: string; onCancel: () => void; onConfirm: () => void }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] grid place-items-center bg-black/60 px-4" onClick={onCancel}>
      <motion.div initial={{ scale: 0.96, y: 8 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 8 }} className="w-full max-w-sm ui-card p-5" onClick={event => event.stopPropagation()}>
        <div className="font-display text-xl leading-none">{title}</div>
        <p className="mt-2 font-sans text-sm text-ink-3">{body}</p>
        <div className="mt-5 flex gap-2">
          <button type="button" onClick={onCancel} className="flex-1 border border-hairline py-3 font-mono text-[10px] font-bold hover:bg-surface-hover">CANCELAR</button>
          <button type="button" onClick={onConfirm} className="flex-1 bg-red py-3 font-mono text-[10px] font-bold text-white">APAGAR</button>
        </div>
      </motion.div>
    </motion.div>
  )
}

function VideoPreview({ stream }: { stream: MediaStream | null }) {
  const videoRef = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream
  }, [stream])

  return <video ref={videoRef} autoPlay muted playsInline className="h-28 w-28 rounded-full border-2 border-red object-cover bg-ink sm:h-36 sm:w-36" />
}
