import { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuthStore } from '@/stores/auth.store'
import { useChatStore } from '@/stores/chat.store'
import { useIsDesktop } from '@/hooks/useBreakpoint'
import { uploadChatMedia } from '@/lib/supabase'
import type { ChatMessage, ChatPoll } from '@/types'

import { ResenhaHeader }   from './components/ResenhaHeader'
import { PinnedMessage }   from './components/PinnedMessage'
import { MessageList }     from './components/MessageList'
import { ChatComposer }    from './components/ChatComposer'
import { GifPicker }       from './components/GifPicker'
import { PollModal }       from './components/PollModal'
import { ChatProfilePanel } from './components/ChatProfilePanel'
import { useAutoScroll }   from './hooks/useAutoScroll'
import { getReplyPreview } from './utils/chatFormat'

export function ResenhaScreen() {
  const { messages, pinnedId, isLoaded, lastError, addMessage, clearError, setPinned, voteOnPoll, deleteMessage } =
    useChatStore()
  const { user }  = useAuthStore()
  const isAdmin   = user?.isAdmin ?? false
  const isDesktop = useIsDesktop()

  // UI state
  const [gifOpen,          setGifOpen]          = useState(false)
  const [pollOpen,         setPollOpen]         = useState(false)
  const [menuOpenId,       setMenuOpenId]       = useState<string | null>(null)
  const [replyingTo,       setReplyingTo]       = useState<ChatMessage | null>(null)
  const [deleteConfirmId,  setDeleteConfirmId]  = useState<string | null>(null)
  const [profileMsg,       setProfileMsg]       = useState<ChatMessage | null>(null)
  const [mediaErr,         setMediaErr]         = useState<string | null>(null)

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpenId) return
    const close = () => setMenuOpenId(null)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [menuOpenId])

  const { scrollRef, bottomRef, atBottom, handleScroll, scrollToBottom } = useAutoScroll(messages, isLoaded)

  // ── Message builders ──────────────────────────────────────────────────────

  const buildMsg = useCallback(
    (overrides: Partial<ChatMessage>): ChatMessage => ({
      id:        crypto.randomUUID(),
      userId:    user?.id ?? 'me',
      channelId: 'geral',
      who:       user ? `${user.firstName} ${user.lastName}` : 'Você',
      dept:      user?.dept ?? '',
      initials:  user?.initials ?? 'EU',
      color:     user?.color ?? '#00A651',
      avatarUrl: user?.avatarUrl,
      time:      new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      text:      '',
      type:      'text',
      isYou:     true,
      createdAt: new Date().toISOString(),
      ...overrides,
    }),
    [user],
  )

  const sendText = useCallback((text: string) => {
    const reply = replyingTo
      ? { id: replyingTo.id, who: replyingTo.who, text: replyingTo.text, type: replyingTo.type ?? 'text' }
      : undefined
    addMessage(buildMsg({ text, type: 'text', replyTo: reply }))
    setReplyingTo(null)
  }, [addMessage, buildMsg, replyingTo])

  const sendGif = useCallback((gifUrl: string) => {
    addMessage(buildMsg({ type: 'gif', gifUrl }))
    setGifOpen(false)
  }, [addMessage, buildMsg])

  const sendPoll = useCallback((poll: ChatPoll) => {
    setPollOpen(false)
    addMessage(buildMsg({ text: poll.question, type: 'poll', poll, isYou: false }))
  }, [addMessage, buildMsg])

  const sendImage = useCallback(async (file: File) => {
    if (!user?.id) return
    try {
      const url = await uploadChatMedia(user.id, file, 'image')
      addMessage(buildMsg({ type: 'image', imageUrl: url }))
    } catch (e) {
      setMediaErr(e instanceof Error ? e.message : 'Erro ao enviar imagem.')
    }
  }, [user, addMessage, buildMsg])

  const sendAudio = useCallback(async (blob: Blob, duration: number) => {
    if (!user?.id) return
    try {
      const url = await uploadChatMedia(user.id, blob, 'audio')
      addMessage(buildMsg({ type: 'audio', audioUrl: url, audioDuration: duration }))
    } catch (e) {
      setMediaErr(e instanceof Error ? e.message : 'Erro ao enviar áudio.')
    }
  }, [user, addMessage, buildMsg])

  const togglePin = useCallback((id: string) => {
    void setPinned(pinnedId === id ? null : id)
  }, [setPinned, pinnedId])

  const vote = useCallback((msgId: string, optId: string) => {
    void voteOnPoll(msgId, user?.id ?? 'me', optId)
  }, [user, voteOnPoll])

  const pinnedMsg = pinnedId ? messages.find(m => m.id === pinnedId) : null
  const combinedError = lastError || mediaErr

  return (
    <div
      className="relative flex flex-col bg-paper overflow-hidden"
      style={{
        height: isDesktop
          ? 'calc(100dvh - 5.75rem)'
          : 'calc(100dvh - 5.5rem - env(safe-area-inset-bottom, 0px))',
      }}
    >
      {/* Profile panel (fixed overlay) */}
      <AnimatePresence>
        {profileMsg && <ChatProfilePanel m={profileMsg} onClose={() => setProfileMsg(null)} />}
      </AnimatePresence>

      {/* Header — full width */}
      <ResenhaHeader
        messageCount={messages.length}
        isAdmin={isAdmin}
        onCreatePoll={() => setPollOpen(true)}
      />

      {/* Centered content column */}
      <div className="flex-1 flex flex-col min-h-0 mx-auto w-full max-w-4xl">

        {/* Pinned */}
        <AnimatePresence>
          {pinnedMsg && (
            <PinnedMessage
              key="pinned"
              msg={pinnedMsg}
              isAdmin={isAdmin}
              onUnpin={() => void setPinned(null)}
            />
          )}
        </AnimatePresence>

        {/* Messages */}
        <MessageList
          messages={messages}
          isLoaded={isLoaded}
          currentUserId={user?.id}
          pinnedId={pinnedId}
          menuOpenId={menuOpenId}
          isAdmin={isAdmin}
          scrollRef={scrollRef}
          bottomRef={bottomRef}
          onScroll={handleScroll}
          onOpenMenu={setMenuOpenId}
          onReply={setReplyingTo}
          onPin={togglePin}
          onDeleteRequest={setDeleteConfirmId}
          onVote={vote}
          onOpenProfile={setProfileMsg}
        />

        {/* Scroll-to-bottom */}
        <AnimatePresence>
          {!atBottom && (
            <motion.div
              initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.15 }}
              className="flex justify-center py-1.5 flex-shrink-0 border-t border-hairline bg-paper"
            >
              <button
                onClick={scrollToBottom}
                className="bg-ink text-paper font-mono text-[10px] px-3 py-1.5 shadow-card active:scale-95 transition-transform"
              >
                ↓ VER NOVAS MSGS
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error banner */}
        <AnimatePresence>
          {combinedError && (
            <motion.div
              initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
              className="overflow-hidden flex-shrink-0"
            >
              <div className="flex items-center justify-between px-4 py-2 bg-red/8 border-t border-red/20">
                <span className="font-mono text-[10px] text-red">{combinedError}</span>
                <button
                  onClick={() => { clearError(); setMediaErr(null) }}
                  className="font-mono text-[10px] text-red/60 hover:text-red ml-3"
                >✕</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* GIF picker */}
        <AnimatePresence>
          {gifOpen && <GifPicker onSelect={sendGif} onClose={() => setGifOpen(false)} />}
        </AnimatePresence>

        {/* Composer */}
        <ChatComposer
          replyingTo={replyingTo}
          onCancelReply={() => setReplyingTo(null)}
          onSendText={sendText}
          onToggleGif={() => setGifOpen(v => !v)}
          gifActive={gifOpen}
          onSendImage={sendImage}
          onSendAudio={sendAudio}
        />

      </div>

      {/* Poll modal */}
      <AnimatePresence>
        {pollOpen && <PollModal onCreate={sendPoll} onClose={() => setPollOpen(false)} />}
      </AnimatePresence>

      {/* Delete confirm */}
      <AnimatePresence>
        {deleteConfirmId && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 backdrop-blur-sm px-6"
            onClick={() => setDeleteConfirmId(null)}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 340, damping: 26 }}
              className="bg-paper rounded-2xl shadow-xl w-full max-w-xs p-6 flex flex-col gap-5"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex flex-col gap-1">
                <span className="font-display text-lg text-ink leading-none">Apagar mensagem?</span>
                <span className="font-sans text-sm text-ink-3">Esta ação não pode ser desfeita.</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setDeleteConfirmId(null)}
                  className="flex-1 font-mono text-[11px] tracking-widest py-3 border border-hairline text-ink-3 hover:border-ink hover:text-ink transition-colors rounded-lg"
                >
                  CANCELAR
                </button>
                <button
                  onClick={() => { void deleteMessage(deleteConfirmId); setDeleteConfirmId(null) }}
                  className="flex-1 font-mono text-[11px] tracking-widest py-3 bg-red text-white hover:bg-red/80 transition-colors rounded-lg"
                >
                  APAGAR
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
