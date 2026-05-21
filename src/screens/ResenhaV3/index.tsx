import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useAuthStore } from '@/stores/auth.store'
import { useChatStore, type ChatProfile } from '@/stores/chat.store'
import { uploadChatMedia } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { isSafeHttpUrl } from '@/lib/security'
import type { ChatMessage, ChatPoll } from '@/types'
import { Avatar } from '@/components/shared/Avatar'
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
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000)
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
  const [messageMenuId, setMessageMenuId] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const endRef = useRef<HTMLDivElement | null>(null)
  const audio = useAudioRecorder()
  const videoNote = useVideoNoteRecorder()

  const isAdmin = user?.isAdmin ?? false
  const combinedError = error || lastError
  const pinnedMsg = pinnedId ? messages.find(message => message.id === pinnedId) : null

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

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [messages.length])

  useEffect(() => {
    return () => setTyping(false)
  }, [setTyping])

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

  const sendAudio = async () => {
    if (!user?.id) return
    if (!audio.recording) {
      const ok = await audio.start()
      if (!ok) setError('Permissao de microfone negada.')
      return
    }
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

  const sendVideoNoteRecording = async () => {
    if (!user?.id) return
    if (!videoNote.recording) {
      const ok = await videoNote.start()
      if (!ok) setError('Permissao de camera negada.')
      return
    }
    const result = await videoNote.stop()
    if (!result) return
    await sendMedia('video_note', result.blob, result.duration)
  }

  const deleteMessageById = async () => {
    if (!deleteId) return
    await deleteMessage(deleteId)
    setDeleteId(null)
  }

  return (
    <div className="min-h-0 flex-1 bg-[#f6f1e6] text-ink">
      <div className="grid h-[calc(100dvh-5.5rem)] grid-cols-1 overflow-hidden lg:h-[calc(100dvh-5.75rem)] lg:grid-cols-[minmax(0,1fr)_19rem]">
        <section className="flex min-h-0 flex-col border-r border-black/10">
          <header className="flex shrink-0 items-center justify-between gap-3 border-b border-black/10 bg-[#fbf7ed] px-4 py-3">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <h1 className="font-display text-3xl leading-none tracking-normal">RESENHA</h1>
                <span className="rounded-full bg-green px-2 py-0.5 font-mono text-[9px] font-bold text-white">
                  {onlineUserIds.length || 1} ONLINE
                </span>
              </div>
              <p className="mt-1 truncate font-mono text-[10px] text-ink-3">
                {typingLabel || 'grupo oficial do bolao'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setPollOpen(true)} className="hidden border border-ink bg-ink px-3 py-2 font-mono text-[10px] font-bold text-paper transition hover:bg-ink-2 sm:block">
                ENQUETE
              </button>
              <button type="button" onClick={() => setGifOpen(true)} className="border border-ink bg-yellow px-3 py-2 font-mono text-[10px] font-bold text-ink shadow-[3px_3px_0_#0D0D0D] transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-none">
                GIF
              </button>
            </div>
          </header>

          <AnimatePresence>
            {pinnedMsg && (
              <motion.button
                type="button"
                initial={{ y: -12, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -12, opacity: 0 }}
                onClick={() => setReplyingTo(pinnedMsg)}
                className="shrink-0 border-b border-yellow/60 bg-yellow/20 px-4 py-2 text-left"
              >
                <span className="font-mono text-[9px] font-bold text-ink">FIXADA</span>
                <span className="ml-2 font-sans text-sm text-ink-2">{getContentPreview(pinnedMsg)}</span>
              </motion.button>
            )}
          </AnimatePresence>

          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-2 py-4 sm:px-4">
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
                    onToggleMenu={() => setMessageMenuId(messageMenuId === item.message.id ? null : item.message.id)}
                    onReact={emoji => void toggleReaction(item.message.id, emoji)}
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

          <footer className="shrink-0 border-t border-black/10 bg-[#fbf7ed]">
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
              <div className="flex items-center justify-between gap-3 border-b border-black/10 bg-paper px-4 py-2">
                <div className="min-w-0 border-l-2 border-green pl-3">
                  <div className="font-mono text-[9px] font-bold text-green">RESPONDENDO {replyingTo.who}</div>
                  <div className="truncate font-sans text-xs text-ink-3">{getContentPreview(replyingTo)}</div>
                </div>
                <button type="button" onClick={() => setReplyingTo(null)} className="font-mono text-[10px] text-ink-3 hover:text-ink">CANCELAR</button>
              </div>
            )}

            {mentionSuggestions.length > 0 && (
              <div className="flex gap-2 overflow-x-auto border-b border-black/10 px-3 py-2">
                {mentionSuggestions.map(profile => (
                  <button key={profile.id} type="button" onClick={() => insertMention(profile)} className="flex shrink-0 items-center gap-2 border border-black/10 bg-paper px-2 py-1.5 hover:border-ink">
                    <Avatar initials={profile.initials} color={profile.color} src={profile.avatarUrl} size={24} />
                    <span className="font-mono text-[10px] font-bold">{profile.firstName} {profile.lastName}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-end gap-2 px-2 py-2 sm:px-3">
              <div className="relative">
                <button type="button" onClick={() => setActionMenu(value => !value)} className={cn('grid h-11 w-11 place-items-center rounded-full border-2 border-ink bg-paper font-display text-xl transition', actionMenu && 'bg-ink text-paper')}>
                  +
                </button>
                <AnimatePresence>
                  {actionMenu && (
                    <motion.div initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 8, opacity: 0 }} className="absolute bottom-13 left-0 z-30 w-48 overflow-hidden border-2 border-ink bg-paper shadow-[5px_5px_0_#0D0D0D]">
                      <ActionButton label="Foto" detail="imagem do celular" busy={uploading === 'image'} onClick={() => void sendMedia('image')} />
                      <ActionButton label="Video" detail="arquivo ou camera" busy={uploading === 'video'} onClick={() => void sendMedia('video')} />
                      <ActionButton label="Bolinha" detail="video circular" busy={uploading === 'video_note'} onClick={() => void sendMedia('video_note')} />
                      <ActionButton label="Enquete" detail="votacao do grupo" onClick={() => { setPollOpen(true); setActionMenu(false) }} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <textarea
                value={draft}
                onChange={event => setDraftValue(event.target.value.slice(0, 1000))}
                onBlur={() => setTyping(false)}
                onKeyDown={event => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    sendText()
                  }
                }}
                rows={1}
                placeholder="Mensagem"
                className="max-h-32 min-h-11 flex-1 resize-none rounded-[22px] border border-black/10 bg-paper px-4 py-3 font-sans text-[15px] leading-5 outline-none transition placeholder:text-ink-4 focus:border-ink"
              />

              <button type="button" onClick={() => setGifOpen(true)} className="hidden h-11 border border-black/10 bg-paper px-3 font-mono text-[10px] font-bold text-ink-3 hover:border-ink hover:text-ink sm:block">
                GIF
              </button>
              <button type="button" onClick={sendVideoNoteRecording} className={cn('grid h-11 w-11 place-items-center rounded-full border border-black/10 bg-paper font-mono text-[9px] font-bold text-ink-3 hover:border-ink hover:text-ink', videoNote.recording && 'border-red bg-red text-white')}>
                CAM
              </button>
              <button type="button" onClick={sendAudio} disabled={audio.uploading} className={cn('grid h-11 w-11 place-items-center rounded-full border border-black/10 bg-paper font-mono text-[9px] font-bold text-ink-3 hover:border-red hover:text-red disabled:opacity-50', audio.recording && 'border-red bg-red text-white')}>
                {audio.recording ? `${audio.seconds}s` : 'MIC'}
              </button>
              <button type="button" onClick={sendText} disabled={!draft.trim()} className="h-11 min-w-16 rounded-[22px] bg-green px-4 font-mono text-[10px] font-bold text-white shadow-[3px_3px_0_#0D0D0D] transition disabled:opacity-40 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none">
                ENVIAR
              </button>
            </div>

            <AnimatePresence>
              {videoNote.recording && (
                <motion.div initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 16, opacity: 0 }} className="flex flex-col gap-3 border-t border-red/20 bg-red/8 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4">
                    <VideoPreview stream={videoNote.stream} />
                    <div>
                      <div className="font-mono text-[10px] font-bold text-red">GRAVANDO BOLINHA · {videoNote.seconds}s</div>
                      <div className="font-sans text-xs text-ink-3">toque CAM para enviar</div>
                    </div>
                  </div>
                  <button type="button" onClick={videoNote.cancel} className="border border-red px-3 py-2 font-mono text-[10px] text-red">CANCELAR</button>
                </motion.div>
              )}
            </AnimatePresence>
          </footer>
        </section>

        <aside className="hidden min-h-0 flex-col bg-[#111] text-paper lg:flex">
          <div className="border-b border-white/10 p-5">
            <div className="font-display text-2xl leading-none">AO VIVO</div>
            <p className="mt-2 font-sans text-sm text-white/60">Tudo da firma em tempo real, sem depender do admin para conversa acontecer.</p>
          </div>
          <div className="space-y-4 overflow-y-auto p-5">
            <PanelStat label="mensagens" value={messages.length} />
            <PanelStat label="online agora" value={onlineUserIds.length || 1} />
            <div>
              <div className="mb-2 font-mono text-[10px] text-white/40">PARTICIPANTES</div>
              <div className="flex flex-wrap gap-2">
                {profiles.slice(0, 18).map(profile => (
                  <button key={profile.id} type="button" className="rounded-full border border-white/10 bg-white/5 px-2 py-1 font-mono text-[9px] text-white/80">
                    {profile.firstName || profile.initials}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </aside>
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
  const reactions = message.reactions ?? []
  const groupedReactions = QUICK_REACTIONS
    .map(emoji => ({ emoji, count: reactions.filter(reaction => reaction.emoji === emoji).length, mine: reactions.some(reaction => reaction.userId === currentUserId && reaction.emoji === emoji) }))
    .filter(reaction => reaction.count > 0)

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className={cn('flex w-full gap-2 px-1', grouped ? 'mt-1' : 'mt-4', mine ? 'justify-end' : 'justify-start')}
    >
      {!mine && (
        <div className="w-9 shrink-0 self-end">
          {!grouped && (
            <button type="button" onClick={onOpenProfile} className="transition hover:scale-105">
              <Avatar initials={message.initials} color={message.color} src={message.avatarUrl} size={34} />
            </button>
          )}
        </div>
      )}

      <div className={cn('group relative max-w-[86%] sm:max-w-[72%] xl:max-w-[620px]', mine && 'items-end')}>
        <div
          className={cn(
            'relative min-w-0 overflow-visible border px-3.5 py-2.5 shadow-sm',
            mine ? 'rounded-[20px] rounded-br-[6px] border-green/30 bg-[#dff7d6]' : 'rounded-[20px] rounded-bl-[6px] border-black/10 bg-paper',
            (message.type === 'image' || message.type === 'gif' || message.type === 'video' || message.type === 'video_note') ? 'p-2' : 'pb-6',
            mine ? 'pr-4' : 'pl-4',
          )}
        >
          {!mine && !grouped && (
            <button type="button" onClick={onOpenProfile} className="mb-1 block max-w-full truncate text-left font-mono text-[10px] font-bold text-green hover:underline">
              {message.who}
              {message.dept && <span className="font-normal text-ink-4"> · {message.dept}</span>}
            </button>
          )}

          {message.replyTo && (
            <div className="mb-2 rounded-xl border-l-2 border-green bg-black/5 px-3 py-2">
              <div className="font-mono text-[9px] font-bold text-green">{message.replyTo.who}</div>
              <div className="truncate font-sans text-xs text-ink-3">{getContentPreview({ type: message.replyTo.type as ChatMessage['type'], text: message.replyTo.text })}</div>
            </div>
          )}

          <MessageBody message={message} mine={mine} profiles={profiles} currentUserId={currentUserId} onVote={onVote} onImage={onImage} />

          <div className="mt-1 flex items-center justify-end gap-1 font-mono text-[9px] text-ink-4">
            {isPinned && <span>FIXADA</span>}
            <span>{message.time}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={onToggleMenu}
          className={cn(
            'absolute z-30 grid h-7 w-7 place-items-center rounded-full border border-ink/60 bg-paper font-mono text-[11px] leading-none shadow-[1px_1px_0_#0D0D0D] transition hover:border-ink hover:bg-yellow',
            mine ? '-left-9 top-2' : '-right-9 top-2',
            menuOpen && 'bg-yellow',
          )}
          aria-label="Opcoes da mensagem"
        >
          •••
        </button>

        <AnimatePresence>
          {menuOpen && (
            <MessageActionPanel
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
              <button key={reaction.emoji} type="button" onClick={() => onReact(reaction.emoji)} className={cn('rounded-full border px-2 py-1 text-xs', reaction.mine ? 'border-green bg-green text-white' : 'border-black/10 bg-paper')}>
                {reaction.emoji} <span className="font-mono text-[10px]">{reaction.count}</span>
              </button>
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
    return <PollCard poll={message.poll} userId={currentUserId} onVote={onVote} />
  }
  if (message.type === 'gif' && isSafeHttpUrl(message.gifUrl)) {
    return <img src={message.gifUrl} alt="GIF" loading="lazy" className="max-h-72 w-full rounded-2xl object-contain" />
  }
  if (message.type === 'image' && isSafeHttpUrl(message.imageUrl)) {
    return (
      <button type="button" onClick={() => onImage(message.imageUrl!)} className="block w-full">
        <img src={message.imageUrl} alt="Foto" loading="lazy" className="max-h-80 w-full rounded-2xl object-cover transition hover:brightness-95" />
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
  return (
    <motion.div
      initial={{ opacity: 0, y: -4, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4, scale: 0.98 }}
      className={cn(
        'absolute z-40 w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-black/10 bg-paper shadow-[0_18px_50px_rgba(0,0,0,0.16)]',
        mine ? 'right-0' : 'left-0',
        openUp ? 'bottom-full mb-2' : 'top-full mt-2',
      )}
    >
      <div className="border-b border-black/10 p-2">
        <div className="mb-2 px-2 font-mono text-[9px] font-bold text-ink-4">REAGIR</div>
        <div className="grid grid-cols-6 gap-1">
          {QUICK_REACTIONS.map(emoji => (
            <button
              key={emoji}
              type="button"
              onClick={() => onReact(emoji)}
              className="grid h-10 place-items-center rounded-xl border border-black/10 bg-paper-deep text-lg transition hover:border-ink hover:bg-yellow"
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
    </motion.div>
  )
}

function MenuAction({ label, detail, danger, onClick }: { label: string; detail: string; danger?: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={cn('flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition hover:bg-black/5', danger && 'text-red hover:bg-red/10')}>
      <span>
        <span className="block font-mono text-[11px] font-bold">{label}</span>
        <span className={cn('block font-sans text-xs text-ink-4', danger && 'text-red/60')}>{detail}</span>
      </span>
      <span className="font-mono text-[10px]">→</span>
    </button>
  )
}

function DateMarker({ label }: { label: string }) {
  return (
    <div className="my-4 flex justify-center">
      <span className="rounded-full border border-black/10 bg-paper px-3 py-1 font-mono text-[9px] font-bold text-ink-4">{label}</span>
    </div>
  )
}

function LoadingChat() {
  return (
    <div className="space-y-4 px-4">
      {[0, 1, 2, 3].map(index => (
        <div key={index} className={cn('h-16 animate-pulse rounded-2xl bg-black/5', index % 2 ? 'ml-auto w-2/3' : 'w-1/2')} />
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
      className="overflow-hidden border-b border-black/10 bg-paper"
    >
      <div className="flex items-center gap-2 border-b border-black/10 px-3 py-2">
        <span className="font-mono text-[10px] font-bold text-ink">GIF</span>
        <input
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder="pesquisar gif..."
          autoFocus
          className="min-w-0 flex-1 bg-transparent font-sans text-[13px] outline-none placeholder:text-ink-4"
        />
        <button type="button" onClick={onClose} className="rounded-full border border-black/10 px-3 py-1.5 font-mono text-[10px] text-ink-3 hover:border-red hover:text-red">
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
                className="aspect-video overflow-hidden rounded-xl border border-black/10 bg-hairline transition hover:scale-[1.02] hover:border-ink"
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

function PanelStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-white/10 bg-white/5 p-4">
      <div className="font-display text-3xl leading-none text-yellow">{value}</div>
      <div className="mt-1 font-mono text-[10px] text-white/50">{label}</div>
    </div>
  )
}

function ConfirmDialog({ title, body, onCancel, onConfirm }: { title: string; body: string; onCancel: () => void; onConfirm: () => void }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 grid place-items-center bg-black/60 px-4" onClick={onCancel}>
      <motion.div initial={{ scale: 0.96, y: 8 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 8 }} className="w-full max-w-sm border-2 border-ink bg-paper p-5 shadow-[6px_6px_0_#0D0D0D]" onClick={event => event.stopPropagation()}>
        <div className="font-display text-xl leading-none">{title}</div>
        <p className="mt-2 font-sans text-sm text-ink-3">{body}</p>
        <div className="mt-5 flex gap-2">
          <button type="button" onClick={onCancel} className="flex-1 border border-black/10 py-3 font-mono text-[10px] font-bold">CANCELAR</button>
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
