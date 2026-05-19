import { useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { isSafeHttpUrl } from '@/lib/security'
import { Avatar } from '@/components/shared/Avatar'
import type { ChatMessage } from '@/types'
import { ReplyQuote } from './ReplyQuote'
import { MessageMenu } from './MessageMenu'
import { AudioPlayer } from './AudioPlayerBubble'
import { ImageLightbox } from './ImageLightbox'

// ─── shared bubble shell ──────────────────────────────────────────────────────

interface BubbleShellProps {
  isYou: boolean
  className?: string
  children: React.ReactNode
}

function BubbleShell({ isYou, className, children }: BubbleShellProps) {
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

// ─── author name button ───────────────────────────────────────────────────────

function AuthorName({ m, onOpenProfile }: { m: ChatMessage; onOpenProfile: () => void }) {
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

// ─── time stamp ───────────────────────────────────────────────────────────────

function TimeStamp({ time, isYou }: { time: string; isYou: boolean }) {
  return (
    <div className={cn('font-mono text-[9px] mt-1 text-right', isYou ? 'text-ink/40' : 'text-ink-4')}>
      {time}
    </div>
  )
}

// ─── TextBubble ───────────────────────────────────────────────────────────────

function TextBubble({ m, grouped, onOpenProfile, menuProps }: BubbleContentProps) {
  return (
    <BubbleShell isYou={m.isYou ?? false} className="px-3.5 py-2.5">
      {!m.isYou && !grouped && <AuthorName m={m} onOpenProfile={onOpenProfile} />}
      {m.replyTo && <ReplyQuote r={m.replyTo} isYou={m.isYou ?? false} />}
      <span className="font-sans text-[14px] leading-relaxed pr-6">{m.text}</span>
      <TimeStamp time={m.time} isYou={m.isYou ?? false} />
      <MessageMenu {...menuProps} />
    </BubbleShell>
  )
}

// ─── GifBubble ────────────────────────────────────────────────────────────────

function GifBubble({ m, grouped, onOpenProfile, menuProps }: BubbleContentProps) {
  return (
    <BubbleShell isYou={m.isYou ?? false} className="overflow-hidden max-w-[65%] md:max-w-[50%]">
      {!m.isYou && !grouped && (
        <div className="px-2.5 pt-2">
          <AuthorName m={m} onOpenProfile={onOpenProfile} />
        </div>
      )}
      {m.replyTo && <div className="px-2.5 pt-2"><ReplyQuote r={m.replyTo} isYou={m.isYou ?? false} /></div>}
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

// ─── ImageBubble ──────────────────────────────────────────────────────────────

function ImageBubble({ m, grouped, onOpenProfile, menuProps }: BubbleContentProps) {
  const [lightbox, setLightbox] = useState(false)
  return (
    <>
      <BubbleShell isYou={m.isYou ?? false} className="overflow-hidden max-w-[65%] md:max-w-[50%]">
        {!m.isYou && !grouped && (
          <div className="px-2.5 pt-2">
            <AuthorName m={m} onOpenProfile={onOpenProfile} />
          </div>
        )}
        {m.replyTo && <div className="px-2.5 pt-2"><ReplyQuote r={m.replyTo} isYou={m.isYou ?? false} /></div>}
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

// ─── AudioBubble ──────────────────────────────────────────────────────────────

function AudioBubble({ m, grouped, onOpenProfile, menuProps }: BubbleContentProps) {
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

// ─── Exported MessageBubble ───────────────────────────────────────────────────

interface BubbleContentProps {
  m: ChatMessage
  grouped: boolean
  onOpenProfile: () => void
  menuProps: React.ComponentProps<typeof MessageMenu>
}

export interface MessageBubbleProps {
  message: ChatMessage
  grouped: boolean
  menuOpen: boolean
  isAdmin: boolean
  isPinned: boolean
  canDelete: boolean
  onToggleMenu: (e: React.MouseEvent) => void
  onReply: () => void
  onPin: () => void
  onDeleteRequest: () => void
  onOpenProfile: () => void
}

export function MessageBubble({
  message: m,
  grouped,
  menuOpen,
  isAdmin,
  isPinned,
  canDelete,
  onToggleMenu,
  onReply,
  onPin,
  onDeleteRequest,
  onOpenProfile,
}: MessageBubbleProps) {
  const menuProps: React.ComponentProps<typeof MessageMenu> = {
    open: menuOpen,
    isAdmin,
    isPinned,
    canDelete,
    onToggle: onToggleMenu,
    onReply,
    onPin,
    onDelete: onDeleteRequest,
  }

  const isMine = m.isYou ?? false

  return (
    <div className={cn('group/bubble flex gap-2 items-end w-full', isMine ? 'justify-end' : 'justify-start')}>
      {/* Avatar — only for others, shown at group start */}
      {!isMine && (
        grouped
          ? <div className="w-8 flex-shrink-0" />
          : (
            <button onClick={onOpenProfile} className="flex-shrink-0 hover:opacity-80 transition-opacity self-end mb-0.5">
              <Avatar initials={m.initials} color={m.color} src={m.avatarUrl} size={32} />
            </button>
          )
      )}

      {/* Bubble — constrained width */}
      <div className={cn('max-w-[84%] md:max-w-[560px]', isMine ? '' : '')}>
        {m.type === 'gif' && m.gifUrl
          ? <GifBubble m={m} grouped={grouped} onOpenProfile={onOpenProfile} menuProps={menuProps} />
          : m.type === 'image' && m.imageUrl
            ? <ImageBubble m={m} grouped={grouped} onOpenProfile={onOpenProfile} menuProps={menuProps} />
            : m.type === 'audio' && m.audioUrl
              ? <AudioBubble m={m} grouped={grouped} onOpenProfile={onOpenProfile} menuProps={menuProps} />
              : <TextBubble m={m} grouped={grouped} onOpenProfile={onOpenProfile} menuProps={menuProps} />
        }
      </div>
    </div>
  )
}
