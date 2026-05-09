import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Avatar } from '@/components/shared/Avatar'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth.store'
import { useChatStore } from '@/stores/chat.store'
import type { ChatMessage, ChatPoll } from '@/types'

// ─── Tenor GIF API ─────────────────────────────────────────────────────────────

const TENOR_KEY = (import.meta.env.VITE_TENOR_KEY as string | undefined) ?? 'LIVDSRZULELA'

interface GifResult {
  id: string
  url: string
  preview: string
}

async function fetchGifs(query: string): Promise<GifResult[]> {
  const endpoint = query.trim()
    ? `https://api.tenor.com/v1/search?q=${encodeURIComponent(query)}&key=${TENOR_KEY}&limit=20&contentfilter=medium&media_filter=minimal`
    : `https://api.tenor.com/v1/trending?key=${TENOR_KEY}&limit=20&contentfilter=medium&media_filter=minimal`
  try {
    const res = await fetch(endpoint)
    if (!res.ok) return []
    const data = await res.json() as { results: { id: string; media: { tinygif?: { url: string }; gif?: { url: string } }[] }[] }
    return (data.results ?? []).map(r => ({
      id: r.id,
      url: r.media[0]?.gif?.url ?? '',
      preview: r.media[0]?.tinygif?.url ?? r.media[0]?.gif?.url ?? '',
    })).filter(g => g.url)
  } catch {
    return []
  }
}

// ─── GIF Picker ────────────────────────────────────────────────────────────────

function GifPicker({ onSelect, onClose }: { onSelect: (url: string) => void; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [gifs, setGifs] = useState<GifResult[]>([])
  const [loading, setLoading] = useState(true)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    setLoading(true)
    fetchGifs('').then(g => { setGifs(g); setLoading(false) })
  }, [])

  useEffect(() => {
    clearTimeout(timerRef.current)
    if (!query.trim()) {
      setLoading(true)
      fetchGifs('').then(g => { setGifs(g); setLoading(false) })
      return
    }
    timerRef.current = setTimeout(() => {
      setLoading(true)
      fetchGifs(query).then(g => { setGifs(g); setLoading(false) })
    }, 450)
    return () => clearTimeout(timerRef.current)
  }, [query])

  return (
    <motion.div
      initial={{ height: 0 }}
      animate={{ height: 300 }}
      exit={{ height: 0 }}
      transition={{ type: 'spring', damping: 28, stiffness: 320 }}
      className="overflow-hidden border-t border-line bg-paper-deep flex-shrink-0"
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b border-hairline bg-paper">
        <span className="text-ink-3 text-sm leading-none">🔍</span>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="buscar GIF..."
          autoFocus
          className="flex-1 bg-transparent font-sans text-[13px] outline-none placeholder:text-ink-4"
        />
        <button onClick={onClose} className="font-mono text-[10px] text-ink-3 hover:text-ink px-1">
          ✕
        </button>
      </div>
      <div className="h-[calc(300px-44px)] overflow-y-auto overscroll-contain">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <span className="font-mono text-[11px] text-ink-3 animate-pulse">CARREGANDO...</span>
          </div>
        ) : gifs.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <span className="font-mono text-[11px] text-ink-3">NENHUM GIF ENCONTRADO</span>
          </div>
        ) : (
          <div className="grid grid-cols-3 md:grid-cols-4 gap-1 p-2">
            {gifs.map(g => (
              <button
                key={g.id}
                onClick={() => onSelect(g.url)}
                className="aspect-square overflow-hidden bg-paper-deep hover:opacity-75 transition-opacity"
              >
                <img src={g.preview} alt="" className="w-full h-full object-cover" loading="lazy" />
              </button>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ─── Poll Modal ─────────────────────────────────────────────────────────────────

function PollModal({ onCreate, onClose }: { onCreate: (poll: ChatPoll) => void; onClose: () => void }) {
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState(['', ''])

  const updateOption = (i: number, val: string) =>
    setOptions(prev => prev.map((o, idx) => (idx === i ? val : o)))

  const removeOption = (i: number) => {
    if (options.length <= 2) return
    setOptions(prev => prev.filter((_, idx) => idx !== i))
  }

  const valid = question.trim().length > 0 && options.filter(o => o.trim()).length >= 2

  const handleCreate = () => {
    if (!valid) return
    onCreate({
      question: question.trim(),
      options: options
        .filter(o => o.trim())
        .map((text, i) => ({ id: `o${i + 1}`, text: text.trim() })),
      votes: {},
    })
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-ink/50 px-0 md:px-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
        className="w-full md:max-w-md bg-paper border-2 border-ink p-6 md:p-6"
      >
        <div className="flex items-center justify-between mb-5">
          <p className="font-display text-xl tracking-wide">CRIAR ENQUETE</p>
          <button onClick={onClose} className="font-mono text-[10px] text-ink-3 hover:text-ink">
            FECHAR
          </button>
        </div>

        <div className="space-y-3">
          <input
            value={question}
            onChange={e => setQuestion(e.target.value)}
            placeholder="Qual é a pergunta?"
            className="w-full bg-paper-deep border border-line px-3 py-2.5 font-sans text-[14px] outline-none focus:border-ink placeholder:text-ink-4"
          />
          <p className="font-mono text-[9px] text-ink-4 tracking-wide">OPÇÕES (mín. 2, máx. 4)</p>
          <div className="space-y-2">
            {options.map((opt, i) => (
              <div key={i} className="flex gap-2 items-center">
                <span className="font-mono text-[10px] text-ink-4 w-4 text-right">{i + 1}</span>
                <input
                  value={opt}
                  onChange={e => updateOption(i, e.target.value)}
                  placeholder={`Opção ${i + 1}`}
                  className="flex-1 bg-paper-deep border border-line px-3 py-2 font-sans text-[13px] outline-none focus:border-ink placeholder:text-ink-4"
                />
                {options.length > 2 && (
                  <button
                    onClick={() => removeOption(i)}
                    className="font-mono text-[12px] text-ink-4 hover:text-red w-5 flex-shrink-0"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>

          {options.length < 4 && (
            <button
              onClick={() => setOptions(prev => [...prev, ''])}
              className="font-mono text-[10px] text-ink-3 hover:text-ink"
            >
              + ADICIONAR OPÇÃO
            </button>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 border border-line font-mono text-[11px] py-2.5 hover:border-ink transition-colors"
          >
            CANCELAR
          </button>
          <button
            onClick={handleCreate}
            disabled={!valid}
            className="flex-1 btn-yellow py-2.5 text-[11px] disabled:opacity-40"
          >
            CRIAR ENQUETE
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── Message Bubbles ────────────────────────────────────────────────────────────

function TextBubble({ m }: { m: ChatMessage }) {
  return (
    <div className={cn('flex gap-2.5', m.isYou ? 'flex-row-reverse' : '')}>
      <Avatar initials={m.initials} color={m.color} size={30} className="flex-shrink-0 mt-1" />
      <div className={cn('max-w-[75%] flex flex-col gap-1', m.isYou ? 'items-end' : 'items-start')}>
        {!m.isYou && (
          <span className="font-mono text-[10px] text-ink-3">
            {m.who} · {m.dept} · {m.time}
          </span>
        )}
        <div
          className={cn(
            'px-3 py-2 text-[13px] leading-snug break-words',
            m.isYou
              ? 'bg-yellow text-ink rounded-[14px_4px_14px_14px]'
              : 'bg-paper-deep text-ink rounded-[4px_14px_14px_14px]'
          )}
        >
          {m.text}
        </div>
        {m.isYou && (
          <span className="font-mono text-[9px] text-ink-4">{m.time}</span>
        )}
        {m.reaction && (
          <div className="flex items-center gap-1 border border-hairline px-2 py-0.5 rounded-full text-[12px]">
            <span>{m.reaction}</span>
            <span className="font-mono text-[10px] text-ink-3">12</span>
          </div>
        )}
      </div>
    </div>
  )
}

function GifBubble({ m }: { m: ChatMessage }) {
  return (
    <div className={cn('flex gap-2.5', m.isYou ? 'flex-row-reverse' : '')}>
      <Avatar initials={m.initials} color={m.color} size={30} className="flex-shrink-0 mt-1" />
      <div className={cn('max-w-[60%] flex flex-col gap-1', m.isYou ? 'items-end' : 'items-start')}>
        {!m.isYou && (
          <span className="font-mono text-[10px] text-ink-3">
            {m.who} · {m.dept} · {m.time}
          </span>
        )}
        <div
          className={cn(
            'overflow-hidden',
            m.isYou ? 'rounded-[14px_4px_14px_14px]' : 'rounded-[4px_14px_14px_14px]'
          )}
        >
          <img
            src={m.gifUrl}
            alt="GIF"
            className="max-w-full max-h-52 object-contain block"
            loading="lazy"
          />
        </div>
        {m.isYou && <span className="font-mono text-[9px] text-ink-4">{m.time}</span>}
      </div>
    </div>
  )
}

function PollBubble({ m, userVotes, onVote }: {
  m: ChatMessage
  userVotes: Record<string, string>
  onVote: (optionId: string) => void
}) {
  const poll = m.poll!
  const myVote = userVotes[m.id]
  const hasVoted = !!myVote

  const totalVotes = Object.keys(poll.votes).length

  return (
    <div className="flex gap-2.5">
      <Avatar initials={m.initials} color={m.color} size={30} className="flex-shrink-0 mt-1" />
      <div className="flex-1 max-w-sm">
        <span className="font-mono text-[10px] text-ink-3 block mb-2">
          {m.who} · {m.dept} · {m.time}
        </span>
        <div className="border-2 border-ink bg-paper p-4 shadow-card">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-base leading-none">📊</span>
            <p className="font-display text-[14px] tracking-wide text-ink">{poll.question}</p>
          </div>
          <div className="space-y-2">
            {poll.options.map(opt => {
              const count = Object.values(poll.votes).filter(v => v === opt.id).length
              const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0
              const isMyPick = myVote === opt.id
              return (
                <button
                  key={opt.id}
                  onClick={() => !hasVoted && onVote(opt.id)}
                  disabled={hasVoted && !isMyPick}
                  className={cn(
                    'w-full text-left relative overflow-hidden border transition-colors',
                    isMyPick ? 'border-ink' : 'border-hairline',
                    !hasVoted ? 'hover:border-line cursor-pointer' : 'cursor-default'
                  )}
                >
                  <div
                    className={cn(
                      'absolute inset-0 transition-all duration-700',
                      isMyPick ? 'bg-yellow/50' : 'bg-paper-deep/70'
                    )}
                    style={{ width: hasVoted ? `${pct}%` : '0%' }}
                  />
                  <div className="relative flex items-center justify-between px-3 py-2.5">
                    <span className={cn('font-sans text-[12px]', isMyPick ? 'font-bold text-ink' : 'text-ink-2')}>
                      {isMyPick && '✓ '}{opt.text}
                    </span>
                    {hasVoted && (
                      <span className="font-mono text-[10px] text-ink-3 ml-2 flex-shrink-0">{pct}%</span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
          <p className="font-mono text-[10px] text-ink-4 mt-3">
            {totalVotes} {totalVotes === 1 ? 'voto' : 'votos'}
            {!hasVoted && ' · clique para votar'}
          </p>
        </div>
      </div>
    </div>
  )
}

function MessageRow({ m, userVotes, onVote }: {
  m: ChatMessage
  userVotes: Record<string, string>
  onVote: (optionId: string) => void
}) {
  if (m.type === 'poll' && m.poll) return <PollBubble m={m} userVotes={userVotes} onVote={onVote} />
  if (m.type === 'gif' && m.gifUrl) return <GifBubble m={m} />
  return <TextBubble m={m} />
}

// ─── Chat Input ─────────────────────────────────────────────────────────────────

function ChatInput({
  onSend,
  onGifToggle,
  gifActive,
}: {
  onSend: (text: string) => void
  onGifToggle: () => void
  gifActive: boolean
}) {
  const [text, setText] = useState('')

  const handleSend = () => {
    if (!text.trim()) return
    onSend(text.trim())
    setText('')
  }

  return (
    <div className="flex items-center gap-2 border-t border-line px-3 py-2.5 bg-paper flex-shrink-0">
      <button
        onClick={onGifToggle}
        className={cn(
          'flex-shrink-0 font-mono text-[10px] font-bold px-2.5 py-1.5 border transition-colors',
          gifActive
            ? 'bg-ink text-paper border-ink'
            : 'border-line text-ink-3 hover:border-ink hover:text-ink'
        )}
        title="Enviar GIF"
      >
        GIF
      </button>
      <input
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSend()
          }
        }}
        placeholder="manda a sua..."
        className="flex-1 bg-transparent font-sans text-[14px] outline-none placeholder:text-ink-4"
      />
      <button
        onClick={handleSend}
        disabled={!text.trim()}
        className="btn-yellow px-3 py-1.5 text-[11px] disabled:opacity-40 flex-shrink-0"
      >
        ENVIAR
      </button>
    </div>
  )
}

// ─── Screen ─────────────────────────────────────────────────────────────────────

export function ResenhaScreen() {
  const { messages, pinnedId, addMessage, setPinned, voteOnPoll } = useChatStore()
  const [gifOpen, setGifOpen] = useState(false)
  const [pollOpen, setPollOpen] = useState(false)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const { user } = useAuthStore()
  const isAdmin = user?.isAdmin ?? false

  // derive per-user voted options from stored poll data
  const userVotes: Record<string, string> = {}
  if (user?.id) {
    messages.forEach(m => {
      if (m.poll?.votes[user.id]) userVotes[m.id] = m.poll.votes[user.id]
    })
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const me = user

  const buildMsg = useCallback(
    (overrides: Partial<ChatMessage>): ChatMessage => ({
      id: `m-${Date.now()}`,
      userId: me?.id ?? 'me',
      channelId: 'geral',
      who: me ? `${me.firstName} ${me.lastName}` : 'Você',
      dept: me?.dept ?? '',
      initials: me?.initials ?? 'EU',
      color: me?.color ?? '#00A651',
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      text: '',
      type: 'text',
      isYou: true,
      createdAt: new Date().toISOString(),
      ...overrides,
    }),
    [me]
  )

  const sendText = useCallback((text: string) => {
    addMessage(buildMsg({ text, type: 'text' }))
  }, [addMessage, buildMsg])

  const sendGif = useCallback((gifUrl: string) => {
    setGifOpen(false)
    addMessage(buildMsg({ type: 'gif', gifUrl }))
  }, [addMessage, buildMsg])

  const sendPoll = useCallback((poll: ChatPoll) => {
    setPollOpen(false)
    addMessage(buildMsg({ text: poll.question, type: 'poll', poll, isYou: false }))
  }, [addMessage, buildMsg])

  const togglePin = useCallback((id: string) => {
    setPinned(pinnedId === id ? null : id)
  }, [setPinned, pinnedId])

  const vote = useCallback((pollMsgId: string, optionId: string) => {
    const userId = me?.id ?? 'me'
    voteOnPoll(pollMsgId, userId, optionId)
  }, [me, voteOnPoll])

  const pinnedMsg = pinnedId ? messages.find(m => m.id === pinnedId) : null

  const pinnedPreview = pinnedMsg
    ? pinnedMsg.type === 'gif'
      ? 'GIF 🎬'
      : pinnedMsg.type === 'poll'
        ? pinnedMsg.poll?.question
        : pinnedMsg.text
    : null

  return (
    <div className="h-[calc(100dvh-80px)] md:h-[calc(100dvh-56px)] flex flex-col bg-paper overflow-hidden">

      {/* ── Header ── */}
      <div className="bg-paper border-b border-line px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="font-display text-2xl">#RESENHA</span>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green animate-pulse-live" />
            <span className="font-mono text-[10px] text-ink-3">87 ONLINE</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[10px] text-ink-4 hidden md:block">
            {messages.length} MSGS
          </span>
          {isAdmin && (
            <button
              onClick={() => setPollOpen(true)}
              className="font-mono text-[10px] font-bold px-3 py-1.5 bg-ink text-paper hover:bg-ink-2 transition-colors"
            >
              + ENQUETE
            </button>
          )}
        </div>
      </div>

      {/* ── Pinned bar ── */}
      <AnimatePresence>
        {pinnedMsg && (
          <motion.div
            key="pinned"
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden flex-shrink-0"
          >
            <div className="border-b border-yellow/50 bg-yellow/10 px-4 py-2 flex items-center gap-2">
              <span className="text-xs flex-shrink-0">📌</span>
              <p className="flex-1 font-sans text-[12px] text-ink-2 truncate min-w-0">
                <span className="font-semibold text-ink">{pinnedMsg.who}: </span>
                {pinnedPreview}
              </p>
              {isAdmin && (
                <button
                  onClick={() => setPinned(null)}
                  className="font-mono text-[9px] text-ink-4 hover:text-ink flex-shrink-0 ml-2"
                >
                  DESAFIXAR
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 space-y-3 min-h-0">
        {messages.map(m => (
          <div
            key={m.id}
            className="relative group"
            onMouseEnter={() => setHoveredId(m.id)}
            onMouseLeave={() => setHoveredId(null)}
          >
            <MessageRow m={m} userVotes={userVotes} onVote={(optId) => vote(m.id, optId)} />

            {/* Admin pin button (on hover, non-poll messages) */}
            {isAdmin && hoveredId === m.id && m.type !== 'poll' && (
              <motion.button
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={() => togglePin(m.id)}
                className={cn(
                  'absolute -top-1 right-0 font-mono text-[9px] px-2 py-1 border z-10',
                  pinnedId === m.id
                    ? 'bg-yellow border-ink text-ink'
                    : 'bg-paper border-line text-ink-3 hover:border-ink hover:text-ink'
                )}
              >
                {pinnedId === m.id ? '📌 FIXADA' : 'FIXAR'}
              </motion.button>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* ── GIF Picker (slide up) ── */}
      <AnimatePresence>
        {gifOpen && <GifPicker onSelect={sendGif} onClose={() => setGifOpen(false)} />}
      </AnimatePresence>

      {/* ── Input ── */}
      <ChatInput
        onSend={sendText}
        onGifToggle={() => setGifOpen(v => !v)}
        gifActive={gifOpen}
      />

      {/* ── Poll Modal (admin only) ── */}
      <AnimatePresence>
        {pollOpen && <PollModal onCreate={sendPoll} onClose={() => setPollOpen(false)} />}
      </AnimatePresence>
    </div>
  )
}
