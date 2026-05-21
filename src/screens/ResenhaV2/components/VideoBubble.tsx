import { useState } from 'react'
import { motion } from 'framer-motion'
import { isSafeHttpUrl } from '@/lib/security'

interface VideoBubbleProps {
  src?: string
  isNote?: boolean
}

export function VideoBubble({ src, isNote }: VideoBubbleProps) {
  const [expanded, setExpanded] = useState(false)
  if (!isSafeHttpUrl(src)) return null

  if (isNote) {
    return (
      <motion.button
        type="button"
        layout
        onClick={() => setExpanded(value => !value)}
        className="block rounded-full outline-none"
        title={expanded ? 'Reduzir video' : 'Ampliar video'}
      >
        <motion.video
          src={src}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          className="aspect-square rounded-full border-2 border-ink bg-ink object-cover shadow-[0_8px_24px_rgba(0,0,0,0.18)]"
          animate={{
            width: expanded ? 260 : 168,
            height: expanded ? 260 : 168,
          }}
          transition={{ type: 'spring', stiffness: 260, damping: 24 }}
        />
      </motion.button>
    )
  }

  return (
    <video
      src={src}
      controls
      playsInline
      preload="metadata"
      className="max-h-72 w-full rounded bg-ink object-contain"
    />
  )
}
