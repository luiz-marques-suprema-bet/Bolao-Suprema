import { useState, useRef } from 'react'
import { cn } from '@/lib/utils'
import { formatDuration } from '../utils/chatFormat'
import { useAudioRecorder } from '../hooks/useAudioRecorder'
import { ReplyPreview } from './ReplyPreview'
import type { ChatMessage } from '@/types'

const MAX_CHARS = 1000
const DRAFT_KEY = 'resenha-draft-geral'

interface ChatComposerProps {
  replyingTo: ChatMessage | null
  onCancelReply: () => void
  onSendText: (text: string) => void
  onToggleGif: () => void
  gifActive: boolean
  onSendImage: (file: File) => Promise<void>
  onSendAudio: (blob: Blob, duration: number) => Promise<void>
}

export function ChatComposer({
  replyingTo, onCancelReply, onSendText, onToggleGif, gifActive, onSendImage, onSendAudio,
}: ChatComposerProps) {
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
    onSendText(text.trim())
    setText('')
    try { localStorage.removeItem(DRAFT_KEY) } catch { /* ok */ }
  }

  const handleImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setImgUploading(true)
    try { await onSendImage(file) } finally { setImgUploading(false) }
  }

  const handleMic = async () => {
    if (audioRec.recording) {
      const result = await audioRec.stop()
      if (!result) return
      audioRec.setUploading(true)
      try { await onSendAudio(result.blob, result.duration) } finally { audioRec.setUploading(false) }
    } else {
      const ok = await audioRec.start()
      if (!ok) alert('Permissão de microfone negada.')
    }
  }

  // Recording state UI
  if (audioRec.recording || audioRec.uploading) {
    return (
      <div className="border-t border-hairline bg-paper flex-shrink-0">
        <div className="flex items-center gap-3 px-3 py-3">
          <div className="flex items-center gap-2 flex-1">
            <span className="w-2 h-2 rounded-full bg-red animate-pulse flex-shrink-0" />
            <span className="font-mono text-[12px] text-red font-bold">{formatDuration(audioRec.seconds)}</span>
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
      {/* Reply preview */}
      {replyingTo && <ReplyPreview replyingTo={replyingTo} onCancel={onCancelReply} />}

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImage} />

      <div className="flex items-end gap-1.5 px-2 py-2">
        {/* GIF */}
        <button
          onClick={onToggleGif}
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
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
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
