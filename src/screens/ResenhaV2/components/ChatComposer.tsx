import { useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import type { ChatProfile } from '@/stores/chat.store'
import { formatDuration } from '../utils/chatUi'
import { useAudioRecorder } from '../hooks/useAudioRecorder'
import { ReplyPreview } from './ReplyPreview'
import type { ChatMessage } from '@/types'

const MAX_CHARS = 1000
const DRAFT_KEY = 'resenha-draft-geral'

interface ChatComposerProps {
  replyingTo: ChatMessage | null
  profiles: ChatProfile[]
  onCancelReply: () => void
  onSendText: (text: string) => void
  onToggleGif: () => void
  gifActive: boolean
  onSendImage: (file: File) => Promise<void>
  onSendAudio: (blob: Blob, duration: number) => Promise<void>
  onSendVideo: (file: File, asNote: boolean) => Promise<void>
  onTyping: (typing: boolean) => void
}

export function ChatComposer({
  replyingTo,
  profiles,
  onCancelReply,
  onSendText,
  onToggleGif,
  gifActive,
  onSendImage,
  onSendAudio,
  onSendVideo,
  onTyping,
}: ChatComposerProps) {
  const [text, setText] = useState(() => {
    try { return localStorage.getItem(DRAFT_KEY) ?? '' } catch { return '' }
  })
  const [uploading, setUploading] = useState<string | null>(null)
  const imageRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLInputElement>(null)
  const noteRef = useRef<HTMLInputElement>(null)
  const audioRec = useAudioRecorder()

  const mentionQuery = useMemo(() => {
    const match = text.match(/(?:^|\s)@([\p{L}\p{N}_-]{0,24})$/u)
    return match?.[1]?.toLocaleLowerCase('pt-BR') ?? null
  }, [text])

  const mentionSuggestions = useMemo(() => {
    if (mentionQuery === null) return []
    return profiles
      .filter(profile => {
        const name = `${profile.firstName} ${profile.lastName}`.trim().toLocaleLowerCase('pt-BR')
        return name.includes(mentionQuery) || profile.dept.toLocaleLowerCase('pt-BR').includes(mentionQuery)
      })
      .slice(0, 5)
  }, [mentionQuery, profiles])

  const handleChange = (value: string) => {
    if (value.length > MAX_CHARS) return
    setText(value)
    onTyping(value.trim().length > 0)
    try { localStorage.setItem(DRAFT_KEY, value) } catch { /* ignore */ }
  }

  const insertMention = (profile: ChatProfile) => {
    const label = `@${profile.firstName || profile.initials}`
    const next = text.replace(/(?:^|\s)@([\p{L}\p{N}_-]{0,24})$/u, match => `${match.startsWith(' ') ? ' ' : ''}${label} `)
    handleChange(next)
  }

  const handleSend = () => {
    if (!text.trim()) return
    onSendText(text.trim())
    setText('')
    onTyping(false)
    try { localStorage.removeItem(DRAFT_KEY) } catch { /* ignore */ }
  }

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video' | 'video_note') => {
    const file = event.target.files?.[0]
    if (!file) return
    event.target.value = ''
    setUploading(type)
    try {
      if (type === 'image') await onSendImage(file)
      else await onSendVideo(file, type === 'video_note')
    } finally {
      setUploading(null)
    }
  }

  const handleMic = async () => {
    if (audioRec.recording) {
      const result = await audioRec.stop()
      if (!result) return
      audioRec.setUploading(true)
      try { await onSendAudio(result.blob, result.duration) } finally { audioRec.setUploading(false) }
    } else {
      const ok = await audioRec.start()
      if (!ok) alert('Permissao de microfone negada.')
    }
  }

  if (audioRec.recording || audioRec.uploading) {
    return (
      <div className="border-t border-line bg-paper flex-shrink-0 px-3 py-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 flex-1">
            <span className="w-2 h-2 rounded-full bg-red animate-pulse flex-shrink-0" />
            <span className="font-mono text-[12px] text-red font-bold">{formatDuration(audioRec.seconds)}</span>
            <span className="font-mono text-[10px] text-ink-4">GRAVANDO</span>
          </div>
          <button type="button" onClick={audioRec.cancel} className="font-mono text-[10px] text-ink-3 border border-hairline px-3 py-1.5 hover:border-red hover:text-red transition-colors">
            CANCELAR
          </button>
          <button type="button" onClick={handleMic} disabled={audioRec.uploading} className="btn-yellow px-3 py-1.5 text-[11px] disabled:opacity-50">
            {audioRec.uploading ? '...' : 'ENVIAR'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="border-t border-line bg-paper flex-shrink-0">
      {replyingTo && <ReplyPreview replyingTo={replyingTo} onCancel={onCancelReply} />}

      <input ref={imageRef} type="file" accept="image/*" className="hidden" onChange={event => handleFile(event, 'image')} />
      <input ref={videoRef} type="file" accept="video/*" className="hidden" onChange={event => handleFile(event, 'video')} />
      <input ref={noteRef} type="file" accept="video/*" capture="user" className="hidden" onChange={event => handleFile(event, 'video_note')} />

      {mentionSuggestions.length > 0 && (
        <div className="border-b border-hairline px-2 py-2 flex gap-2 overflow-x-auto">
          {mentionSuggestions.map(profile => (
            <button
              key={profile.id}
              type="button"
              onClick={() => insertMention(profile)}
              className="flex min-w-0 items-center gap-2 border border-hairline bg-paper-deep px-2 py-1.5 text-left hover:border-ink"
            >
              <span className="h-6 w-6 shrink-0 rounded-full text-center font-mono text-[9px] leading-6 text-white" style={{ background: profile.color }}>
                {profile.initials}
              </span>
              <span className="min-w-0">
                <span className="block truncate font-mono text-[10px] font-bold text-ink">{profile.firstName} {profile.lastName}</span>
                {profile.dept && <span className="block truncate font-mono text-[8px] text-ink-4">{profile.dept}</span>}
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="flex items-end gap-1.5 px-2 py-2">
        <button
          type="button"
          onClick={onToggleGif}
          className={cn(
            'flex-shrink-0 font-mono text-[10px] font-bold px-2 py-2 border transition-all mb-0.5 active:scale-90',
            gifActive ? 'bg-ink text-paper border-ink' : 'border-hairline text-ink-3 hover:border-ink hover:text-ink',
          )}
        >
          GIF
        </button>
        <button
          type="button"
          onClick={() => imageRef.current?.click()}
          disabled={uploading === 'image'}
          className="flex-shrink-0 h-9 px-2 mb-0.5 border border-hairline font-mono text-[10px] text-ink-3 hover:border-ink hover:text-ink disabled:opacity-40"
          title="Anexar foto"
        >
          {uploading === 'image' ? '...' : 'FOTO'}
        </button>
        <button
          type="button"
          onClick={() => videoRef.current?.click()}
          disabled={uploading === 'video'}
          className="hidden sm:block flex-shrink-0 h-9 px-2 mb-0.5 border border-hairline font-mono text-[10px] text-ink-3 hover:border-ink hover:text-ink disabled:opacity-40"
          title="Anexar video"
        >
          {uploading === 'video' ? '...' : 'VIDEO'}
        </button>
        <button
          type="button"
          onClick={() => noteRef.current?.click()}
          disabled={uploading === 'video_note'}
          className="flex-shrink-0 h-9 w-9 rounded-full mb-0.5 border border-hairline font-mono text-[9px] text-ink-3 hover:border-ink hover:text-ink disabled:opacity-40"
          title="Video em bolinha"
        >
          {uploading === 'video_note' ? '...' : 'CAM'}
        </button>
        <button
          type="button"
          onClick={handleMic}
          className="flex-shrink-0 h-9 w-9 mb-0.5 flex items-center justify-center border border-hairline text-ink-3 hover:border-red hover:text-red transition-all active:scale-90"
          title="Gravar audio"
        >
          <span className="font-mono text-[13px]">MIC</span>
        </button>

        <div className="flex-1 relative">
          <textarea
            value={text}
            onChange={event => handleChange(event.target.value)}
            onBlur={() => onTyping(false)}
            onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); handleSend() } }}
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

        <button
          type="button"
          onClick={handleSend}
          disabled={!text.trim()}
          className="btn-yellow px-3 py-2 text-[11px] disabled:opacity-30 flex-shrink-0 mb-0.5 font-bold active:scale-95 transition-transform"
        >
          ENVIAR
        </button>
      </div>
    </div>
  )
}
