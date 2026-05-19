import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Avatar } from '@/components/shared/Avatar'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth.store'
import { useChatStore } from '@/stores/chat.store'
import { useIsDesktop } from '@/hooks/useBreakpoint'
import { supabase, isMockMode, uploadChatMedia } from '@/lib/supabase'
import { isSafeHttpUrl } from '@/lib/security'
import type { ChatMessage, ChatPoll } from '@/types'

// ─── GIF API ─────────────────────────────────────────────────────────────────

const TENOR_V1_KEY = 'LIVDSRZULELA'
const TENOR_V2_KEY = import.meta.env.VITE_TENOR_KEY as string | undefined
const DRAFT_KEY    = 'resenha-draft-geral'

interface GifResult { id: string; url: string; preview: string }

async function fetchGifs(query: string): Promise<GifResult[]> {
  const q = query.trim()
  try {
    const base   = 'https://g.tenor.com/v1'
    const params = new URLSearchParams({
      key: TENOR_V1_KEY, limit: '24', contentfilter: 'medium', media_filter: 'minimal',
    })
    if (q) params.set('q', q)
    const url  = q ? `${base}/search?${params}` : `${base}/trending?${params}`
    const res  = await fetch(url)
    if (res.ok) {
      const data = await res.json() as {
        results: { id: string; media: { gif?: { url: string }; tinygif?: { url: string } }[] }[]
      }
      const gifs = (data.results ?? []).map(r => ({
        id:      r.id,
        url:     r.media[0]?.gif?.url ?? '',
        preview: r.media[0]?.tinygif?.url ?? r.media[0]?.gif?.url ?? '',
      })).filter(g => g.url)
      if (gifs.length > 0) return gifs
    }
  } catch { /* fall through */ }

  if (TENOR_V2_KEY) {
    try {
      const params = new URLSearchParams({
        key: TENOR_V2_KEY, client_key: 'bolao_suprema',
        limit: '24', contentfilter: 'medium', media_filter: 'gif,tinygif',
      })
      if (q) params.set('q', q)
      const base = 'https://tenor.googleapis.com/v2'
      const url  = q ? `${base}/search?${params}` : `${base}/featured?${params}`
      const res  = await fetch(url)
      if (res.ok) {
        const data = await res.json() as {
          results: { id: string; media_formats: { gif?: { url: string }; tinygif?: { url: string } } }[]
        }
        const gifs = (data.results ?? []).map(r => ({
          id:      r.id,
          url:     r.media_formats.gif?.url ?? '',
          preview: r.media_formats.tinygif?.url ?? r.media_formats.gif?.url ?? '',
        })).filter(g => g.url)
        if (gifs.length > 0) return gifs
      }
    } catch { /* fall through */ }
  }

  return []
}

// ─── GIF Picker ───────────────────────────────────────────────────────────────

function GifPicker({ onSelect, onClose }: { onSelect: (url: string) => void; onClose: () => void }) {
  const [query, setQuery]     = useState('')
  const [gifs, setGifs]       = useState<GifResult[]>([])
  const [loading, setLoading] = useState(true)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    setLoading(true)
    fetchGifs('').then(g => { setGifs(g); setLoading(false) })
  }, [])

  useEffect(() => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      setLoading(true)
      fetchGifs(query).then(g => { setGifs(g); setLoading(false) })
    }, query.trim() ? 420 : 0)
    return () => clearTimeout(timer.current)
  }, [query])

  return (
    <motion.div
      initial={{ height: 0 }} animate={{ height: 300 }} exit={{ height: 0 }}
      transition={{ type: 'spring', damping: 28, stiffness: 320 }}
      className="overflow-hidden border-t border-hairline bg-paper-deep flex-shrink-0"
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b border-hairline bg-paper">
        <span className="font-mono text-[10px] text-ink-4 flex-shrink-0">GIF</span>
        <input
          value={query} onChange={e => setQuery(e.target.value)}
          placeholder="pesquisar gif..."
          autoFocus
          className="flex-1 bg-transparent font-sans text-[13px] outline-none placeholder:text-ink-4"
        />
        <button onClick={onClose} className="font-mono text-[10px] text-ink-3 hover:text-red px-1 flex-shrink-0">✕</button>
      </div>
      <div className="h-[calc(300px-41px)] overflow-y-auto overscroll-contain">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <span className="font-mono text-[10px] text-ink-4 animate-pulse">BUSCANDO...</span>
          </div>
        ) : gifs.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <span className="font-mono text-[10px] text-ink-4">NENHUM GIF ENCONTRADO</span>
          </div>
        ) : (
          <div className="grid grid-cols-3 md:grid-cols-4 gap-0.5 p-1">
            {gifs.map(g => (
              <button
                key={g.id}
                onClick={() => { onSelect(g.url); onClose() }}
                className="aspect-square overflow-hidden bg-hairline hover:opacity-80 transition-opacity"
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

// ─── Poll Modal ───────────────────────────────────────────────────────────────

function PollModal({ onCreate, onClose }: { onCreate: (poll: ChatPoll) => void; onClose: () => void }) {
  const [question, setQuestion] = useState('')
  const [options, setOptions]   = useState(['', ''])
  const valid = question.trim().length > 0 && options.filter(o => o.trim()).length >= 2

  const handleCreate = () => {
    if (!valid) return
    onCreate({
      question: question.trim(),
      options: options.filter(o => o.trim()).map((text, i) => ({ id: `o${i + 1}`, text: text.trim() })),
      votes: {},
    })
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-ink/60 px-0 md:px-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <motion.div
        initial={{ y: 48, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 48, opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
        className="w-full md:max-w-md bg-paper border-2 border-ink p-6"
      >
        <div className="flex items-center justify-between mb-5">
          <p className="font-display text-2xl">CRIAR ENQUETE</p>
          <button onClick={onClose} className="font-mono text-[10px] text-ink-3 hover:text-ink">FECHAR</button>
        </div>
        <div className="space-y-3">
          <input
            value={question} onChange={e => setQuestion(e.target.value)}
            placeholder="Qual é a pergunta?"
            className="w-full bg-paper-deep border border-line px-3 py-2.5 font-sans text-[14px] outline-none focus:border-ink placeholder:text-ink-4"
          />
          <p className="font-mono text-[9px] text-ink-4 tracking-eyebrow">OPÇÕES (mín. 2, máx. 4)</p>
          {options.map((opt, i) => (
            <div key={i} className="flex gap-2 items-center">
              <span className="font-mono text-[10px] text-ink-4 w-4 text-right flex-shrink-0">{i + 1}</span>
              <input
                value={opt} onChange={e => setOptions(prev => prev.map((o, idx) => idx === i ? e.target.value : o))}
                placeholder={`Opção ${i + 1}`}
                className="flex-1 bg-paper-deep border border-line px-3 py-2 font-sans text-[13px] outline-none focus:border-ink placeholder:text-ink-4"
              />
              {options.length > 2 && (
                <button onClick={() => setOptions(prev => prev.filter((_, idx) => idx !== i))}
                  className="font-mono text-[12px] text-ink-4 hover:text-red w-5 flex-shrink-0">×</button>
              )}
            </div>
          ))}
          {options.length < 4 && (
            <button onClick={() => setOptions(prev => [...prev, ''])}
              className="font-mono text-[10px] text-ink-3 hover:text-ink">+ ADICIONAR OPÇÃO</button>
          )}
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose}
            className="flex-1 border border-line font-mono text-[11px] py-2.5 hover:border-ink transition-colors">
            CANCELAR
          </button>
          <button onClick={handleCreate} disabled={!valid}
            className="flex-1 btn-yellow py-2.5 text-[11px] disabled:opacity-40">
            CRIAR ENQUETE
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── Audio recorder hook ─────────────────────────────────────────────────────

function useAudioRecorder() {
  const [recording, setRecording]   = useState(false)
  const [seconds, setSeconds]       = useState(0)
  const [uploading, setUploading]   = useState(false)
  const mediaRef  = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef  = useRef<ReturnType<typeof setInterval>>(undefined)

  const start = useCallback(async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4']
        .find(m => MediaRecorder.isTypeSupported(m)) ?? ''
      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      chunksRef.current = []
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.start(200)
      mediaRef.current = mr
      setRecording(true)
      setSeconds(0)
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000)
      return true
    } catch {
      return false
    }
  }, [])

  const stop = useCallback((): Promise<{ blob: Blob; duration: number } | null> => {
    return new Promise(resolve => {
      clearInterval(timerRef.current)
      const mr = mediaRef.current
      if (!mr) { resolve(null); return }
      const dur = seconds
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || 'audio/webm' })
        mr.stream.getTracks().forEach(t => t.stop())
        mediaRef.current = null
        setRecording(false)
        setSeconds(0)
        resolve(blob.size > 0 ? { blob, duration: dur } : null)
      }
      mr.stop()
    })
  }, [seconds])

  const cancel = useCallback(() => {
    clearInterval(timerRef.current)
    if (mediaRef.current) {
      mediaRef.current.stream.getTracks().forEach(t => t.stop())
      mediaRef.current = null
    }
    setRecording(false)
    setSeconds(0)
  }, [])

  useEffect(() => () => { clearInterval(timerRef.current) }, [])

  return { recording, seconds, uploading, setUploading, start, stop, cancel }
}

// ─── Message bubble parts ─────────────────────────────────────────────────────

function UserAvatar({ m, onOpen }: { m: ChatMessage; onOpen?: () => void }) {
  return (
    <button
      onClick={onOpen}
      disabled={!onOpen}
      className={cn('flex-shrink-0', onOpen && 'hover:opacity-80 transition-opacity cursor-pointer')}
    >
      <Avatar initials={m.initials} color={m.color} src={m.avatarUrl} size={32} />
    </button>
  )
}

function MsgHeader({ m, onOpen }: { m: ChatMessage; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="font-mono text-[10px] text-ink-3 hover:text-ink transition-colors text-left leading-none mb-1.5"
    >
      <span className="font-bold text-ink">{m.who}</span>
      {m.dept && <span className="text-ink-4"> · {m.dept}</span>}
      <span className="text-ink-4"> · {m.time}</span>
    </button>
  )
}

// ─── Chat Profile Panel (WhatsApp-style side panel) ──────────────────────────

interface UserProfileSnap {
  bio?: string
  favoriteTeam?: string
  pts?: number
  rank?: number
  correctPredictions?: number
  exactPredictions?: number
}

function ChatProfilePanel({ m, onClose }: { m: ChatMessage; onClose: () => void }) {
  const navigate = useNavigate()
  const [snap, setSnap]       = useState<UserProfileSnap | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [{ data: uData }, { data: rData }] = await Promise.all([
          supabase.from('public_profiles').select('bio,favorite_team').eq('id', m.userId).single(),
          supabase
            .from('ranking_snapshots')
            .select('pts,rank,correct_predictions,exact_predictions')
            .eq('user_id', m.userId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
        ])
        if (!cancelled) setSnap({
          bio:                uData?.bio                   ?? undefined,
          favoriteTeam:       uData?.favorite_team         ?? undefined,
          pts:                rData?.pts                   ?? undefined,
          rank:               rData?.rank                  ?? undefined,
          correctPredictions: rData?.correct_predictions   ?? undefined,
          exactPredictions:   rData?.exact_predictions     ?? undefined,
        })
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    if (!isMockMode) load()
    else setLoading(false)
    return () => { cancelled = true }
  }, [m.userId])

  const hasStats = snap && (
    snap.rank !== undefined || snap.pts !== undefined ||
    snap.correctPredictions !== undefined || snap.exactPredictions !== undefined
  )

  return (
    <motion.div
      initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
      transition={{ type: 'spring', stiffness: 320, damping: 30 }}
      className="absolute inset-y-0 right-0 w-72 bg-paper border-l border-hairline z-40 flex flex-col shadow-2xl"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-hairline flex-shrink-0">
        <button onClick={onClose} className="font-mono text-[10px] tracking-eyebrow text-ink-3 hover:text-ink transition-colors">
          ← FECHAR
        </button>
        <span className="font-mono text-[9px] tracking-eyebrow text-ink-4">PARTICIPANTE</span>
      </div>

      <div className="flex flex-col items-center pt-8 pb-6 px-6 gap-3 overflow-y-auto flex-1">
        {/* Avatar */}
        <div className="w-20 h-20 rounded-full overflow-hidden flex-shrink-0 border-2 border-hairline" style={{ background: m.color }}>
          {m.avatarUrl
            ? <img src={m.avatarUrl} alt="" className="w-full h-full object-cover" />
            : <Avatar initials={m.initials} color={m.color} size={80} />
          }
        </div>

        {/* Name + dept */}
        <div className="text-center">
          <div className="font-display text-xl text-ink leading-none">{m.who}</div>
          {m.dept && <div className="font-sans text-[13px] text-ink-3 mt-1">{m.dept}</div>}
        </div>

        {/* Stats */}
        {loading ? (
          <span className="font-mono text-[10px] text-ink-4 animate-pulse">carregando...</span>
        ) : (
          <>
            {hasStats && (
              <div className="w-full grid grid-cols-4 border border-hairline mt-1">
                {snap.rank !== undefined && (
                  <div className="flex flex-col items-center py-2.5">
                    <span className="font-display text-base text-ink leading-none">#{snap.rank}</span>
                    <span className="font-mono text-[7px] text-ink-4 tracking-eyebrow mt-0.5">RANK</span>
                  </div>
                )}
                {snap.pts !== undefined && (
                  <div className="flex flex-col items-center py-2.5 border-l border-hairline">
                    <span className="font-display text-base text-ink leading-none">{snap.pts}</span>
                    <span className="font-mono text-[7px] text-ink-4 tracking-eyebrow mt-0.5">PTS</span>
                  </div>
                )}
                {snap.correctPredictions !== undefined && (
                  <div className="flex flex-col items-center py-2.5 border-l border-hairline">
                    <span className="font-display text-base text-ink leading-none">{snap.correctPredictions}</span>
                    <span className="font-mono text-[7px] text-ink-4 tracking-eyebrow mt-0.5">ACERTOS</span>
                  </div>
                )}
                {snap.exactPredictions !== undefined && (
                  <div className="flex flex-col items-center py-2.5 border-l border-hairline">
                    <span className="font-display text-base text-ink leading-none">{snap.exactPredictions}</span>
                    <span className="font-mono text-[7px] text-ink-4 tracking-eyebrow mt-0.5">EXATOS</span>
                  </div>
                )}
              </div>
            )}

            {snap?.favoriteTeam && (
              <div className="flex items-center gap-2 w-full">
                <span className="font-mono text-[9px] text-ink-4 flex-shrink-0">TIME:</span>
                <span className="font-mono text-[10px] text-ink">{snap.favoriteTeam}</span>
              </div>
            )}

            {snap?.bio && (
              <p className="font-sans text-[12px] text-ink-3 leading-relaxed text-center border-t border-hairline pt-3 w-full">
                {snap.bio}
              </p>
            )}
          </>
        )}

        <button
          onClick={() => { onClose(); navigate(`/u/${m.userId}`) }}
          className="btn-yellow w-full justify-center mt-auto"
        >
          VER PERFIL COMPLETO →
        </button>
      </div>
    </motion.div>
  )
}

function TextBubble({ m, grouped, onOpenProfile }: { m: ChatMessage; grouped: boolean; onOpenProfile: (m: ChatMessage) => void }) {
  return (
    <div className={cn('flex gap-2.5 items-start', m.isYou ? 'flex-row-reverse' : '')}>
      {!m.isYou && (
        grouped
          ? <div className="w-[32px] flex-shrink-0" />
          : <UserAvatar m={m} onOpen={() => onOpenProfile(m)} />
      )}
      <div className={cn('max-w-[78%] md:max-w-[65%] flex flex-col gap-0.5', m.isYou ? 'items-end' : 'items-start')}>
        {!m.isYou && !grouped && <MsgHeader m={m} onOpen={() => onOpenProfile(m)} />}
        <div className={cn(
          'px-3.5 py-2.5 text-[13px] leading-[1.45] break-words whitespace-pre-wrap shadow-sm',
          m.isYou
            ? 'bg-yellow text-ink rounded-[16px_4px_16px_16px]'
            : 'bg-paper-deep text-ink rounded-[4px_16px_16px_16px]',
        )}>
          {m.replyTo && <ReplyQuote r={m.replyTo} isYou={m.isYou ?? false} />}
          {m.text}
        </div>
        {m.isYou && <span className="font-mono text-[9px] text-ink-4 mt-0.5">{m.time}</span>}
      </div>
      {m.isYou && <div className="w-[32px] flex-shrink-0" />}
    </div>
  )
}

function GifBubble({ m, grouped, onOpenProfile }: { m: ChatMessage; grouped: boolean; onOpenProfile: (m: ChatMessage) => void }) {
  return (
    <div className={cn('flex gap-2.5 items-start', m.isYou ? 'flex-row-reverse' : '')}>
      {!m.isYou && (
        grouped
          ? <div className="w-[32px] flex-shrink-0" />
          : <UserAvatar m={m} onOpen={() => onOpenProfile(m)} />
      )}
      <div className={cn('max-w-[60%] flex flex-col gap-0.5', m.isYou ? 'items-end' : 'items-start')}>
        {!m.isYou && !grouped && <MsgHeader m={m} onOpen={() => onOpenProfile(m)} />}
        {m.replyTo && (
          <div className={cn('w-full px-2 pt-2 pb-0', m.isYou ? 'bg-yellow rounded-[16px_4px_0_0]' : 'bg-paper-deep rounded-[4px_16px_0_0]')}>
            <ReplyQuote r={m.replyTo} isYou={m.isYou ?? false} />
          </div>
        )}
        <div className={cn('overflow-hidden shadow-sm', m.isYou ? 'rounded-[16px_4px_16px_16px]' : 'rounded-[4px_16px_16px_16px]')}>
          {isSafeHttpUrl(m.gifUrl) && <img src={m.gifUrl} alt="GIF" className="max-w-full max-h-52 object-contain block" loading="lazy" />}
        </div>
        {m.isYou && <span className="font-mono text-[9px] text-ink-4 mt-0.5">{m.time}</span>}
      </div>
      {m.isYou && <div className="w-[32px] flex-shrink-0" />}
    </div>
  )
}

function ImageBubble({ m, grouped, onOpenProfile }: { m: ChatMessage; grouped: boolean; onOpenProfile: (m: ChatMessage) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <div className={cn('flex gap-2.5 items-start', m.isYou ? 'flex-row-reverse' : '')}>
        {!m.isYou && (
          grouped
            ? <div className="w-[32px] flex-shrink-0" />
            : <UserAvatar m={m} onOpen={() => onOpenProfile(m)} />
        )}
        <div className={cn('max-w-[65%] flex flex-col gap-0.5', m.isYou ? 'items-end' : 'items-start')}>
          {!m.isYou && !grouped && <MsgHeader m={m} onOpen={() => onOpenProfile(m)} />}
          {m.replyTo && (
            <div className={cn('w-full px-2 pt-2 pb-0', m.isYou ? 'bg-yellow rounded-[16px_4px_0_0]' : 'bg-paper-deep rounded-[4px_16px_0_0]')}>
              <ReplyQuote r={m.replyTo} isYou={m.isYou ?? false} />
            </div>
          )}
          <button
            onClick={() => setOpen(true)}
            className={cn('overflow-hidden shadow-sm hover:opacity-90 transition-opacity', m.isYou ? 'rounded-[16px_4px_16px_16px]' : 'rounded-[4px_16px_16px_16px]')}
          >
            {isSafeHttpUrl(m.imageUrl) && <img src={m.imageUrl} alt="Foto" className="max-w-full max-h-64 object-cover block" loading="lazy" />}
          </button>
          {m.isYou && <span className="font-mono text-[9px] text-ink-4 mt-0.5">{m.time}</span>}
        </div>
        {m.isYou && <div className="w-[32px] flex-shrink-0" />}
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-ink/90 flex items-center justify-center p-4"
            onClick={() => setOpen(false)}
          >
            {isSafeHttpUrl(m.imageUrl) && <img src={m.imageUrl} alt="Foto" className="max-w-full max-h-full object-contain" />}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

function fmtDur(s: number): string {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function AudioBubble({ m, grouped, onOpenProfile }: { m: ChatMessage; grouped: boolean; onOpenProfile: (m: ChatMessage) => void }) {
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(m.audioDuration ?? 0)
  const audioRef = useRef<HTMLAudioElement>(null)

  const toggle = () => {
    const el = audioRef.current
    if (!el) return
    if (playing) { el.pause() } else { void el.play() }
  }

  return (
    <div className={cn('flex gap-2.5 items-start', m.isYou ? 'flex-row-reverse' : '')}>
      {!m.isYou && (
        grouped
          ? <div className="w-[32px] flex-shrink-0" />
          : <UserAvatar m={m} onOpen={() => onOpenProfile(m)} />
      )}
      <div className={cn('flex flex-col gap-0.5', m.isYou ? 'items-end' : 'items-start')}>
        {!m.isYou && !grouped && <MsgHeader m={m} onOpen={() => onOpenProfile(m)} />}
        <div className={cn(
          'flex flex-col shadow-sm min-w-[180px]',
          m.isYou ? 'bg-yellow text-ink rounded-[16px_4px_16px_16px]' : 'bg-paper-deep text-ink rounded-[4px_16px_16px_16px]',
        )}>
          {m.replyTo && (
            <div className="px-3.5 pt-2.5 pb-0">
              <ReplyQuote r={m.replyTo} isYou={m.isYou ?? false} />
            </div>
          )}
          <div className="flex items-center gap-3 px-3.5 py-2.5">
            <audio
              ref={audioRef}
              src={m.audioUrl}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onEnded={() => { setPlaying(false); setProgress(0) }}
              onTimeUpdate={e => {
                const el = e.currentTarget
                setProgress(el.duration > 0 ? el.currentTime / el.duration : 0)
              }}
              onLoadedMetadata={e => {
                const d = e.currentTarget.duration
                if (isFinite(d)) setDuration(Math.round(d))
              }}
            />
            <button
              onClick={toggle}
              className="w-8 h-8 rounded-full border-2 border-current flex items-center justify-center flex-shrink-0 hover:opacity-70 transition-opacity"
            >
              <span className="text-[11px] ml-0.5">{playing ? '■' : '▶'}</span>
            </button>
            <div className="flex-1 min-w-0">
              <div className={cn('h-1 rounded-full overflow-hidden', m.isYou ? 'bg-ink/20' : 'bg-ink/10')}>
                <div
                  className={cn('h-full rounded-full transition-none', m.isYou ? 'bg-ink/60' : 'bg-ink/40')}
                  style={{ width: `${progress * 100}%` }}
                />
              </div>
              <span className="font-mono text-[9px] opacity-60 mt-0.5 block">
                {playing ? fmtDur(Math.round((audioRef.current?.currentTime ?? 0))) : fmtDur(duration)}
              </span>
            </div>
          </div>
        </div>
        {m.isYou && <span className="font-mono text-[9px] text-ink-4 mt-0.5">{m.time}</span>}
      </div>
      {m.isYou && <div className="w-[32px] flex-shrink-0" />}
    </div>
  )
}

function PollBubble({ m, userId, onVote, onOpenProfile }: { m: ChatMessage; userId?: string; onVote: (optId: string) => void; onOpenProfile: (m: ChatMessage) => void }) {
  const poll      = m.poll!
  const myVote    = userId ? poll.votes[userId] : null
  const hasVoted  = !!myVote
  const total     = Object.keys(poll.votes).length

  return (
    <div className="flex gap-2.5 items-start">
      <UserAvatar m={m} onOpen={() => onOpenProfile(m)} />
      <div className="flex-1 max-w-sm">
        <MsgHeader m={m} onOpen={() => onOpenProfile(m)} />
        <div className="border-2 border-ink bg-paper p-4">
          <p className="font-display text-[14px] leading-tight mb-4">{poll.question}</p>
          <div className="space-y-2">
            {poll.options.map(opt => {
              const count     = Object.values(poll.votes).filter(v => v === opt.id).length
              const pct       = total > 0 ? Math.round((count / total) * 100) : 0
              const isMyPick  = myVote === opt.id
              return (
                <button key={opt.id}
                  onClick={() => !hasVoted && onVote(opt.id)}
                  disabled={hasVoted && !isMyPick}
                  className={cn(
                    'w-full text-left relative overflow-hidden border transition-colors',
                    isMyPick ? 'border-ink' : 'border-hairline',
                    !hasVoted && 'hover:border-line cursor-pointer',
                  )}
                >
                  <div
                    className={cn('absolute inset-0 transition-all duration-700', isMyPick ? 'bg-yellow/50' : 'bg-paper-deep/70')}
                    style={{ width: hasVoted ? `${pct}%` : '0%' }}
                  />
                  <div className="relative flex items-center justify-between px-3 py-2.5">
                    <span className={cn('font-sans text-[12px]', isMyPick ? 'font-bold' : 'text-ink-2')}>
                      {isMyPick && '✓ '}{opt.text}
                    </span>
                    {hasVoted && <span className="font-mono text-[10px] text-ink-3 ml-2 flex-shrink-0">{pct}%</span>}
                  </div>
                </button>
              )
            })}
          </div>
          <p className="font-mono text-[10px] text-ink-4 mt-3">
            {total} {total === 1 ? 'voto' : 'votos'}
            {!hasVoted && ' · toque para votar'}
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Reply Quote ─────────────────────────────────────────────────────────────

function ReplyQuote({ r, isYou }: { r: NonNullable<ChatMessage['replyTo']>; isYou: boolean }) {
  const preview =
    r.type === 'gif'   ? '🖼 GIF'    :
    r.type === 'image' ? '📷 Foto'   :
    r.type === 'audio' ? '🎤 Áudio'  :
    r.text

  return (
    <div className={cn(
      'flex flex-col gap-0.5 mb-1.5 px-2.5 py-1.5 border-l-2 rounded-sm text-[11px] max-w-full overflow-hidden',
      isYou ? 'bg-ink/10 border-ink/50' : 'bg-ink/6 border-ink/30',
    )}>
      <span className="font-mono text-[9px] font-bold text-ink-2 truncate">↩ {r.who}</span>
      <span className="font-sans text-[11px] text-ink-3 truncate">{preview}</span>
    </div>
  )
}

function DateSeparator({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="flex-1 h-px bg-hairline" />
      <span className="font-mono text-[9px] text-ink-4 tracking-eyebrow">{label}</span>
      <div className="flex-1 h-px bg-hairline" />
    </div>
  )
}

function dayLabel(iso: string): string {
  const d      = new Date(iso)
  const today  = new Date()
  const yest   = new Date(today); yest.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'HOJE'
  if (d.toDateString() === yest.toDateString())  return 'ONTEM'
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).toUpperCase()
}

// ─── Chat Input ───────────────────────────────────────────────────────────────

const MAX_CHARS = 1000

function ChatInput({
  onSend, onGifToggle, gifActive, onImageSend, onAudioSend, replyingTo, onCancelReply,
}: {
  onSend: (text: string) => void
  onGifToggle: () => void
  gifActive: boolean
  onImageSend: (file: File) => Promise<void>
  onAudioSend: (blob: Blob, duration: number) => Promise<void>
  replyingTo?: ChatMessage | null
  onCancelReply?: () => void
}) {
  const [text, setText] = useState(() => {
    try { return localStorage.getItem(DRAFT_KEY) ?? '' } catch { return '' }
  })
  const [imgUploading, setImgUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const audioRec = useAudioRecorder()

  const handleChange = (v: string) => {
    if (v.length > MAX_CHARS) return
    setText(v)
    try { localStorage.setItem(DRAFT_KEY, v) } catch { /* ok */ }
  }

  const handleSend = () => {
    if (!text.trim()) return
    onSend(text.trim())
    setText('')
    try { localStorage.removeItem(DRAFT_KEY) } catch { /* ok */ }
  }

  const handleImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setImgUploading(true)
    try { await onImageSend(file) } finally { setImgUploading(false) }
  }

  const handleMic = async () => {
    if (audioRec.recording) {
      const result = await audioRec.stop()
      if (!result) return
      audioRec.setUploading(true)
      try { await onAudioSend(result.blob, result.duration) } finally { audioRec.setUploading(false) }
    } else {
      const ok = await audioRec.start()
      if (!ok) alert('Permissão de microfone negada.')
    }
  }

  if (audioRec.recording || audioRec.uploading) {
    return (
      <div className="border-t border-hairline bg-paper flex-shrink-0">
        <div className="flex items-center gap-3 px-3 py-3">
          <div className="flex items-center gap-2 flex-1">
            <span className="w-2 h-2 rounded-full bg-red animate-pulse flex-shrink-0" />
            <span className="font-mono text-[12px] text-red font-bold">{fmtDur(audioRec.seconds)}</span>
            <span className="font-mono text-[10px] text-ink-4">GRAVANDO…</span>
          </div>
          <button
            onClick={audioRec.cancel}
            className="font-mono text-[10px] text-ink-3 border border-hairline px-3 py-1.5 hover:border-red hover:text-red transition-colors"
          >
            CANCELAR
          </button>
          <button
            onClick={handleMic}
            disabled={audioRec.uploading}
            className="btn-yellow px-3 py-1.5 text-[11px] disabled:opacity-50"
          >
            {audioRec.uploading ? '...' : 'ENVIAR'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="border-t border-hairline bg-paper flex-shrink-0">
      {replyingTo && (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-hairline bg-paper-deep">
          <div className="flex-1 min-w-0">
            <span className="font-mono text-[9px] text-ink-4 tracking-eyebrow">RESPONDENDO A </span>
            <span className="font-mono text-[9px] font-bold text-ink">{replyingTo.who}</span>
            <p className="font-sans text-[11px] text-ink-3 truncate mt-0.5">
              {replyingTo.type === 'gif' ? '🖼 GIF' : replyingTo.type === 'image' ? '📷 Foto' : replyingTo.type === 'audio' ? '🎤 Áudio' : replyingTo.text}
            </p>
          </div>
          <button
            onClick={onCancelReply}
            className="font-mono text-[11px] text-ink-4 hover:text-red transition-colors flex-shrink-0 px-1"
          >✕</button>
        </div>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImage}
      />
      <div className="flex items-end gap-1.5 px-2 py-2">
        {/* GIF */}
        <button
          onClick={onGifToggle}
          className={cn(
            'flex-shrink-0 font-mono text-[10px] font-bold px-2 py-2 border transition-all mb-0.5 active:scale-90',
            gifActive ? 'bg-ink text-paper border-ink' : 'border-hairline text-ink-3 hover:border-ink hover:text-ink',
          )}
          title="Enviar GIF"
        >
          GIF
        </button>
        {/* Photo */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={imgUploading}
          className="flex-shrink-0 w-9 h-9 mb-0.5 flex items-center justify-center border border-hairline text-ink-3 hover:border-ink hover:text-ink transition-all active:scale-90 disabled:opacity-40"
          title="Enviar foto"
        >
          {imgUploading ? (
            <span className="font-mono text-[10px] animate-pulse">…</span>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
          )}
        </button>
        {/* Mic */}
        <button
          onClick={handleMic}
          className="flex-shrink-0 w-9 h-9 mb-0.5 flex items-center justify-center border border-hairline text-ink-3 hover:border-red hover:text-red transition-all active:scale-90"
          title="Gravar áudio"
        >
          <svg width="16" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="2" width="6" height="11" rx="3"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
            <line x1="12" y1="19" x2="12" y2="23"/>
            <line x1="8" y1="23" x2="16" y2="23"/>
          </svg>
        </button>
        {/* Text area */}
        <div className="flex-1 relative">
          <textarea
            value={text}
            onChange={e => handleChange(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
            }}
            rows={1}
            placeholder="manda a sua..."
            className="w-full max-h-28 resize-none bg-transparent font-sans text-[14px] leading-5 outline-none placeholder:text-ink-4 py-1.5"
            style={{ overflowY: text.includes('\n') || text.length > 80 ? 'auto' : 'hidden' }}
          />
          {text.length > MAX_CHARS * 0.8 && (
            <span className={cn(
              'absolute bottom-0.5 right-1 font-mono text-[9px]',
              text.length > MAX_CHARS * 0.95 ? 'text-red' : 'text-ink-4',
            )}>
              {MAX_CHARS - text.length}
            </span>
          )}
        </div>
        {/* Send */}
        <button
          onClick={handleSend}
          disabled={!text.trim()}
          className="btn-yellow px-3 py-2 text-[11px] disabled:opacity-30 flex-shrink-0 mb-0.5 tracking-eyebrow font-bold active:scale-95 transition-transform"
        >
          ENVIAR
        </button>
      </div>
    </div>
  )
}

// ─── Message context menu item ────────────────────────────────────────────────

function MsgMenuItem({
  icon, label, danger, onClick,
}: {
  icon: string
  label: string
  danger?: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
        danger
          ? 'text-red/80 hover:bg-red/10 hover:text-red'
          : 'text-paper/90 hover:bg-white/8',
      )}
    >
      <span className="text-[15px] w-5 flex-shrink-0 text-center leading-none">{icon}</span>
      <span className="font-sans text-[13px]">{label}</span>
    </button>
  )
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export function ResenhaScreen() {
  const { messages, pinnedId, isLoaded, lastError, addMessage, clearError, setPinned, voteOnPoll, deleteMessage } =
    useChatStore()
  const { user }   = useAuthStore()
  const isAdmin    = user?.isAdmin ?? false
  const isDesktop  = useIsDesktop()

  const [gifOpen,        setGifOpen]        = useState(false)
  const [pollOpen,       setPollOpen]       = useState(false)
  const [hoveredId,      setHoveredId]      = useState<string | null>(null)
  const [atBottom,       setAtBottom]       = useState(true)
  const [mediaErr,       setMediaErr]       = useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [profileMsg,     setProfileMsg]     = useState<ChatMessage | null>(null)
  const [replyingTo,     setReplyingTo]     = useState<ChatMessage | null>(null)

  const scrollRef        = useRef<HTMLDivElement>(null)
  const bottomRef        = useRef<HTMLDivElement>(null)
  const didInitScrollRef = useRef(false)

  useEffect(() => {
    if (!isLoaded) return
    const el = scrollRef.current
    if (!el) return
    if (!didInitScrollRef.current) {
      el.scrollTop = el.scrollHeight
      didInitScrollRef.current = true
      setAtBottom(true)
      return
    }
    if (atBottom) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, atBottom, isLoaded])

  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120
    setAtBottom(nearBottom)
  }, [])

  const me = user

  const buildMsg = useCallback(
    (overrides: Partial<ChatMessage>): ChatMessage => ({
      id:        crypto.randomUUID(),
      userId:    me?.id ?? 'me',
      channelId: 'geral',
      who:       me ? `${me.firstName} ${me.lastName}` : 'Você',
      dept:      me?.dept ?? '',
      initials:  me?.initials ?? 'EU',
      color:     me?.color ?? '#00A651',
      avatarUrl: me?.avatarUrl,
      time:      new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      text:      '',
      type:      'text',
      isYou:     true,
      createdAt: new Date().toISOString(),
      ...overrides,
    }),
    [me],
  )

  const sendText = useCallback((text: string) => {
    const reply = replyingTo
      ? { id: replyingTo.id, who: replyingTo.who, text: replyingTo.text, type: replyingTo.type ?? 'text' }
      : undefined
    addMessage(buildMsg({ text, type: 'text', replyTo: reply }))
    setReplyingTo(null)
  }, [addMessage, buildMsg, replyingTo])
  const sendGif   = useCallback((gifUrl: string) => { addMessage(buildMsg({ type: 'gif', gifUrl })); setGifOpen(false) }, [addMessage, buildMsg])
  const sendPoll  = useCallback((poll: ChatPoll) => { setPollOpen(false); addMessage(buildMsg({ text: poll.question, type: 'poll', poll, isYou: false })) }, [addMessage, buildMsg])

  const sendImage = useCallback(async (file: File) => {
    if (!me?.id) return
    try {
      const url = await uploadChatMedia(me.id, file, 'image')
      addMessage(buildMsg({ type: 'image', imageUrl: url }))
    } catch (e) {
      setMediaErr(e instanceof Error ? e.message : 'Erro ao enviar imagem.')
    }
  }, [me, addMessage, buildMsg])

  const sendAudio = useCallback(async (blob: Blob, duration: number) => {
    if (!me?.id) return
    try {
      const url = await uploadChatMedia(me.id, blob, 'audio')
      addMessage(buildMsg({ type: 'audio', audioUrl: url, audioDuration: duration }))
    } catch (e) {
      setMediaErr(e instanceof Error ? e.message : 'Erro ao enviar áudio.')
    }
  }, [me, addMessage, buildMsg])

  const togglePin = useCallback((id: string) => void setPinned(pinnedId === id ? null : id), [setPinned, pinnedId])
  const vote      = useCallback((msgId: string, optId: string) => void voteOnPoll(msgId, me?.id ?? 'me', optId), [me, voteOnPoll])

  const pinnedMsg     = pinnedId ? messages.find(m => m.id === pinnedId) : null
  const pinnedPreview = pinnedMsg
    ? pinnedMsg.type === 'gif' ? '🖼 GIF'
    : pinnedMsg.type === 'poll' ? `📊 ${pinnedMsg.poll?.question ?? ''}`
    : pinnedMsg.type === 'image' ? '📷 Foto'
    : pinnedMsg.type === 'audio' ? '🎤 Áudio'
    : pinnedMsg.text
    : null

  // Enrich messages with grouping + date separators
  const enriched = useMemo(() => {
    type EnrichedItem =
      | { kind: 'date'; label: string; key: string }
      | { kind: 'msg'; msg: ChatMessage; grouped: boolean }

    const items: EnrichedItem[] = []
    let lastDay  = ''
    let lastUser = ''

    for (const m of messages) {
      const day = new Date(m.createdAt).toDateString()
      if (day !== lastDay) {
        items.push({ kind: 'date', label: dayLabel(m.createdAt), key: `sep-${m.createdAt}` })
        lastDay  = day
        lastUser = ''
      }
      const grouped = m.userId === lastUser && m.type !== 'poll'
      items.push({ kind: 'msg', msg: m, grouped })
      lastUser = m.userId
    }
    return items
  }, [messages])

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
      {/* ── Profile Side Panel ─────────────────────────────────────────── */}
      <AnimatePresence>
        {profileMsg && <ChatProfilePanel m={profileMsg} onClose={() => setProfileMsg(null)} />}
      </AnimatePresence>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="border-b border-hairline px-4 py-3 flex items-center justify-between flex-shrink-0 bg-paper">
        <div className="flex items-center gap-3">
          <span className="font-display text-2xl">#RESENHA</span>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green animate-pulse-live" />
            <span className="font-mono text-[10px] text-ink-3">AO VIVO</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <span className="font-mono text-[10px] text-ink-4">{messages.length} msgs</span>
          )}
          {isAdmin && (
            <button
              onClick={() => setPollOpen(true)}
              className="font-mono text-[10px] font-bold px-3 py-1.5 bg-ink text-paper hover:bg-ink-2 transition-colors active:scale-95"
            >
              + ENQUETE
            </button>
          )}
        </div>
      </div>

      {/* ── Pinned ─────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {pinnedMsg && (
          <motion.div
            key="pinned"
            initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden flex-shrink-0"
          >
            <div className="border-b border-yellow/40 bg-yellow/8 px-4 py-2 flex items-center gap-2">
              <span className="font-mono text-[8px] text-ink-4 flex-shrink-0">📌</span>
              <p className="flex-1 font-sans text-[12px] text-ink-2 truncate min-w-0">
                <span className="font-bold text-ink">{pinnedMsg.who}: </span>
                {pinnedPreview}
              </p>
              {isAdmin && (
                <button onClick={() => setPinned(null)} className="font-mono text-[9px] text-ink-4 hover:text-ink flex-shrink-0 ml-2">
                  DESAFIXAR
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Messages ───────────────────────────────────────────────────── */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto overscroll-contain px-3 md:px-5 py-3 min-h-0"
      >
        {!isLoaded && (
          <div className="flex flex-col gap-4 py-4">
            {[70, 50, 85, 60].map(w => (
              <div key={w} className="flex gap-2.5 items-end">
                <div className="w-[30px] h-[30px] rounded-full bg-hairline flex-shrink-0" />
                <div className="h-10 rounded-[4px_16px_16px_16px] bg-hairline" style={{ width: `${w}%` }} />
              </div>
            ))}
          </div>
        )}

        {isLoaded && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center py-16">
            <span className="font-display text-6xl text-ink-4">○</span>
            <div>
              <div className="font-display text-2xl text-ink">NINGUÉM<br/>FALOU NADA.</div>
              <p className="font-mono text-[11px] text-ink-3 mt-2 max-w-[200px] mx-auto leading-relaxed">
                A resenha começa com você.
              </p>
            </div>
          </div>
        )}

        {enriched.map((item, idx) => {
          if (item.kind === 'date') return <DateSeparator key={item.key} label={item.label} />
          const { msg: m, grouped } = item

          // Look ahead: is this the last message of a group (next is different user or date)?
          const nextItem = enriched[idx + 1]
          const isGroupEnd = !nextItem || nextItem.kind === 'date' ||
            (nextItem.kind === 'msg' && (nextItem.msg.userId !== m.userId || nextItem.msg.type === 'poll'))

          return (
            <div
              key={m.id}
              className={cn(
                'relative group',
                grouped ? 'mt-1' : 'mt-5',
                isGroupEnd && 'mb-2',
              )}
              onMouseEnter={() => setHoveredId(m.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              {m.type === 'poll' && m.poll
                ? <PollBubble m={m} userId={me?.id} onVote={optId => vote(m.id, optId)} onOpenProfile={setProfileMsg} />
                : m.type === 'gif' && m.gifUrl
                  ? <GifBubble m={m} grouped={grouped} onOpenProfile={setProfileMsg} />
                  : m.type === 'image' && m.imageUrl
                    ? <ImageBubble m={m} grouped={grouped} onOpenProfile={setProfileMsg} />
                    : m.type === 'audio' && m.audioUrl
                      ? <AudioBubble m={m} grouped={grouped} onOpenProfile={setProfileMsg} />
                      : <TextBubble m={m} grouped={grouped} onOpenProfile={setProfileMsg} />
              }

              {hoveredId === m.id && m.type !== 'poll' && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ type: 'spring', damping: 22, stiffness: 400 }}
                  className={cn(
                    'absolute -top-1 z-20 translate-y-[-100%]',
                    m.isYou ? 'right-0' : 'left-0',
                  )}
                >
                  <div className="bg-[#1a1a1a] border border-white/10 shadow-2xl overflow-hidden min-w-[168px] rounded-sm">
                    {/* Responder — todos os usuários */}
                    <MsgMenuItem
                      icon="↩"
                      label="Responder"
                      onClick={() => setReplyingTo(m)}
                    />
                    {/* Fixar/Desafixar — só admin */}
                    {isAdmin && (
                      <MsgMenuItem
                        icon={pinnedId === m.id ? '📌' : '📍'}
                        label={pinnedId === m.id ? 'Desafixar' : 'Fixar'}
                        onClick={() => togglePin(m.id)}
                      />
                    )}
                    {/* Apagar — admin ou dono */}
                    {(isAdmin || m.isYou) && (
                      <>
                        <div className="h-px bg-white/8 mx-3" />
                        <MsgMenuItem
                          icon="🗑"
                          label="Apagar"
                          danger
                          onClick={() => setDeleteConfirmId(m.id)}
                        />
                      </>
                    )}
                  </div>
                </motion.div>
              )}
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* ── Scroll to bottom button ─────────────────────────────────────── */}
      <AnimatePresence>
        {!atBottom && (
          <motion.div
            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15 }}
            className="flex justify-center py-1.5 flex-shrink-0 border-t border-hairline bg-paper"
          >
            <button
              onClick={() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); setAtBottom(true) }}
              className="bg-ink text-paper font-mono text-[10px] px-3 py-1.5 shadow-card active:scale-95 transition-transform"
            >
              ↓ VER NOVAS MSGS
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Error banner ───────────────────────────────────────────────── */}
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

      {/* ── GIF Picker ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {gifOpen && <GifPicker onSelect={sendGif} onClose={() => setGifOpen(false)} />}
      </AnimatePresence>

      {/* ── Input ──────────────────────────────────────────────────────── */}
      <ChatInput
        onSend={sendText}
        onGifToggle={() => setGifOpen(v => !v)}
        gifActive={gifOpen}
        onImageSend={sendImage}
        onAudioSend={sendAudio}
        replyingTo={replyingTo}
        onCancelReply={() => setReplyingTo(null)}
      />

      {/* ── Poll Modal ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {pollOpen && <PollModal onCreate={sendPoll} onClose={() => setPollOpen(false)} />}
      </AnimatePresence>

      {/* ── Delete Confirm ─────────────────────────────────────────────── */}
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
