import { useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { isSafeHttpUrl } from '@/lib/security'
import type { ChatMessage } from '@/types'
import { ReplyQuote } from './ReplyQuote'
import { MessageMenu } from './MessageMenu'
import { AudioPlayer } from './AudioPlayerBubble'
import { ImageLightbox } from './ImageLightbox'

// ─── Shared bubble shell ──────────────────────────────────────────────────────

interface BubbleShellProps {
  isYou: boolean
  className?: string
  children: React.ReactNode
}

export function BubbleShell({ isYou, className, children }: BubbleShellProps) {
  return (
    <div className={cn(
      'relative shadow-sm',
      isYou
        ? 'bg-yellow text-ink rounded-2xl rounded-br-sm'
        : 'bg-paper-deep text-ink border border-line rounded-2xl rounded-bl-sm',
      className,
    )}>
      {children}
    </div>
  )
}

// ─── Author name ──────────────────────────────────────────────────────────────

export function AuthorName({ m, onOpenProfile }: { m: ChatMessage; onOpenProfile: () => void }) {
  return (
    <button
      onClick={onOpenProfile}
      className="block font-mono text-[9px] font-bold text-ink hover:underline mb-1 text-left w-full leading-none"
    >
      {m.who}
      {m.dept && <span className="font-normal text-ink-4"> · {m.dept}</span>}
    </button>
  )
}

// ─── Internal props ───────────────────────────────────────────────────────────

interface ContentProps {
  m: ChatMessage
  grouped: boolean
  onOpenProfile: () => void
  menuProps: React.ComponentProps<typeof MessageMenu>
}

// ─── Text ─────────────────────────────────────────────────────────────────────

function TextContent({ m, grouped, onOpenProfile, menuProps }: ContentProps) {
  return (
    <BubbleShell isYou={m.isYou ?? false} className="px-3.5 py-2.5">
      {!m.isYou && !grouped && <AuthorName m={m} onOpenProfile={onOpenProfile} />}
      {m.replyTo && <ReplyQuote r={m.replyTo} isYou={m.isYou ?? false} />}
      <span className="font-sans text-[14px] leading-relaxed pr-6">{m.text}</span>
      <div className={cn('font-mono text-[9px] mt-1 text-right', m.isYou ? 'text-ink/40' : 'text-ink-4')}>
        {m.time}
      </div>
      <MessageMenu {...menuProps} />
    </BubbleShell>
  )
}

// ─── GIF ──────────────────────────────────────────────────────────────────────

function GifContent({ m, grouped, onOpenProfile, menuProps }: ContentProps) {
  return (
    <BubbleShell isYou={m.isYou ?? false} className="overflow-hidden max-w-[65%] md:max-w-[50%]">
      {!m.isYou && !grouped && (
        <div className="px-2.5 pt-2">
          <AuthorName m={m} onOpenProfile={onOpenProfile} />
        </div>
      )}
      {m.replyTo && (
        <div className="px-2.5 pt-2">
          <ReplyQuote r={m.replyTo} isYou={m.isYou ?? false} />
        </div>
      )}
      {isSafeHttpUrl(m.gifUrl) && (
        <img src={m.gifUrl} alt="GIF" className="w-full max-h-52 object-contain block" loading="lazy" />
      )}
      <div className={cn('font-mono text-[9px] px-2.5 py-1 text-right', m.isYou ? 'text-ink/40' : 'text-ink-4')}>
        {m.time}
      </div>
      <MessageMenu {...menuProps} />
    </BubbleShell>
  )
}

// ─── Image ────────────────────────────────────────────────────────────────────

function ImageContent({ m, grouped, onOpenProfile, menuProps }: ContentProps) {
  const [lightbox, setLightbox] = useState(false)
  return (
    <>
      <BubbleShell isYou={m.isYou ?? false} className="overflow-hidden max-w-[65%] md:max-w-[50%]">
        {!m.isYou && !grouped && (
          <div className="px-2.5 pt-2">
            <AuthorName m={m} onOpenProfile={onOpenProfile} />
          </div>
        )}
        {m.replyTo && (
          <div className="px-2.5 pt-2">
            <ReplyQuote r={m.replyTo} isYou={m.isYou ?? false} />
          </div>
        )}
        <button onClick={() => setLightbox(true)} className="block w-full hover:opacity-90 transition-opacity">
          {isSafeHttpUrl(m.imageUrl) && (
            <img src={m.imageUrl} alt="Foto" className="w-full max-h-64 object-cover block" loading="lazy" />
          )}
        </button>
        <div className={cn('font-mono text-[9px] px-2.5 py-1 text-right', m.isYou ? 'text-ink/40' : 'text-ink-4')}>
          {m.time}
        </div>
        <MessageMenu {...menuProps} />
      </BubbleShell>
      <AnimatePresence>
        {lightbox && <ImageLightbox url={m.imageUrl ?? ''} onClose={() => setLightbox(false)} />}
      </AnimatePresence>
    </>
  )
}

// ─── Audio ────────────────────────────────────────────────────────────────────

function AudioContent({ m, grouped, onOpenProfile, menuProps }: ContentProps) {
  return (
    <BubbleShell isYou={m.isYou ?? false} className="min-w-[200px] max-w-[75%] md:max-w-[55%]">
      {!m.isYou && !grouped && (
        <div className="px-3.5 pt-2.5">
          <AuthorName m={m} onOpenProfile={onOpenProfile} />
        </div>
      )}
      {m.replyTo && (
        <div className="px-3.5 pt-2.5 pb-0">
          <ReplyQuote r={m.replyTo} isYou={m.isYou ?? false} />
        </div>
      )}
      <div className="px-3.5 py-2.5">
        <AudioPlayer src={m.audioUrl} initialDuration={m.audioDuration} isYou={m.isYou ?? false} />
      </div>
      <div className={cn('font-mono text-[9px] px-3.5 pb-2 text-right', m.isYou ? 'text-ink/40' : 'text-ink-4')}>
        {m.time}
      </div>
      <MessageMenu {...menuProps} />
    </BubbleShell>
  )
}

// ─── Exported MessageContent ──────────────────────────────────────────────────

export interface MessageContentProps {
  m: ChatMessage
  grouped: boolean
  onOpenProfile: () => void
  menuProps: React.ComponentProps<typeof MessageMenu>
}

export function MessageContent({ m, grouped, onOpenProfile, menuProps }: MessageContentProps) {
  if (m.type === 'gif'   && m.gifUrl)   return <GifContent   m={m} grouped={grouped} onOpenProfile={onOpenProfile} menuProps={menuProps} />
  if (m.type === 'image' && m.imageUrl) return <ImageContent m={m} grouped={grouped} onOpenProfile={onOpenProfile} menuProps={menuProps} />
  if (m.type === 'audio' && m.audioUrl) return <AudioContent m={m} grouped={grouped} onOpenProfile={onOpenProfile} menuProps={menuProps} />
  return <TextContent m={m} grouped={grouped} onOpenProfile={onOpenProfile} menuProps={menuProps} />
}
