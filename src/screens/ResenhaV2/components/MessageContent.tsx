import { useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { isSafeHttpUrl } from '@/lib/security'
import type { ChatMessage } from '@/types'
import { ReplyQuote } from './ReplyQuote'
import { AudioBubble } from './AudioBubble'
import { ImageViewer } from './ImageViewer'
import { PollCard } from './PollCard'
import { VideoBubble } from './VideoBubble'
import { MentionText } from './MentionText'
import type { ChatProfile } from '@/stores/chat.store'

interface ContentProps {
  message: ChatMessage
  isMine: boolean
  userId?: string
  profiles: ChatProfile[]
  onVote: (optId: string) => void
}

export function MessageContent({ message: m, isMine, userId, profiles, onVote }: ContentProps) {
  const [lightbox, setLightbox] = useState(false)

  return (
    <>
      {m.replyTo && <ReplyQuote r={m.replyTo} isMine={isMine} />}

      {m.type === 'poll' && m.poll ? (
        <PollCard poll={m.poll} userId={userId} onVote={onVote} />
      ) : m.type === 'gif' && isSafeHttpUrl(m.gifUrl) ? (
        <img
          src={m.gifUrl}
          alt="GIF"
          className="w-full max-h-52 object-contain block rounded"
          loading="lazy"
        />
      ) : m.type === 'image' && isSafeHttpUrl(m.imageUrl) ? (
        <>
          <button onClick={() => setLightbox(true)} className="block w-full hover:opacity-90 transition-opacity">
            <img
              src={m.imageUrl}
              alt="Foto"
              className="w-full max-h-64 object-cover block rounded"
              loading="lazy"
            />
          </button>
          <AnimatePresence>
            {lightbox && <ImageViewer url={m.imageUrl!} onClose={() => setLightbox(false)} />}
          </AnimatePresence>
        </>
      ) : m.type === 'audio' && m.audioUrl ? (
        <AudioBubble src={m.audioUrl} initialDuration={m.audioDuration} isMine={isMine} />
      ) : (m.type === 'video' || m.type === 'video_note') && (m.videoUrl || m.mediaUrl) ? (
        <VideoBubble src={m.videoUrl ?? m.mediaUrl} isNote={m.type === 'video_note'} />
      ) : (
        <MentionText text={m.text} profiles={profiles} />
      )}
    </>
  )
}
