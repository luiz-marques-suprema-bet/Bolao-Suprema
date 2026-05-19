import { useState, useRef } from 'react'
import { cn } from '@/lib/utils'
import { formatDuration } from '../utils/chatFormat'

interface AudioPlayerProps {
  src?: string
  initialDuration?: number
  isYou: boolean
}

export function AudioPlayer({ src, initialDuration = 0, isYou }: AudioPlayerProps) {
  const [playing, setPlaying]   = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(initialDuration)
  const audioRef = useRef<HTMLAudioElement>(null)

  const toggle = () => {
    const el = audioRef.current
    if (!el) return
    if (playing) el.pause(); else void el.play()
  }

  return (
    <div className="flex items-center gap-3 pr-8">
      <audio
        ref={audioRef}
        src={src}
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
        <div className={cn('h-1 rounded-full overflow-hidden', isYou ? 'bg-ink/20' : 'bg-ink/10')}>
          <div
            className={cn('h-full rounded-full transition-none', isYou ? 'bg-ink/60' : 'bg-ink/40')}
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        <span className="font-mono text-[9px] opacity-60 mt-0.5 block">
          {playing ? formatDuration(Math.round(audioRef.current?.currentTime ?? 0)) : formatDuration(duration)}
        </span>
      </div>
    </div>
  )
}
