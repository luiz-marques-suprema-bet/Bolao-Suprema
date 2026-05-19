import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Avatar } from '@/components/shared/Avatar'
import { supabase, isMockMode } from '@/lib/supabase'
import type { ChatMessage } from '@/types'

interface ProfileSnap {
  bio?: string
  favoriteTeam?: string
  pts?: number
  rank?: number
  correctPredictions?: number
  exactPredictions?: number
}

interface ChatProfilePanelProps {
  m: ChatMessage
  onClose: () => void
}

export function ChatProfilePanel({ m, onClose }: ChatProfilePanelProps) {
  const navigate = useNavigate()
  const [snap, setSnap]       = useState<ProfileSnap | null>(null)
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
          bio:                uData?.bio                 ?? undefined,
          favoriteTeam:       uData?.favorite_team       ?? undefined,
          pts:                rData?.pts                 ?? undefined,
          rank:               rData?.rank                ?? undefined,
          correctPredictions: rData?.correct_predictions ?? undefined,
          exactPredictions:   rData?.exact_predictions   ?? undefined,
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
        <div className="w-20 h-20 rounded-full overflow-hidden flex-shrink-0 border-2 border-hairline" style={{ background: m.color }}>
          {m.avatarUrl
            ? <img src={m.avatarUrl} alt="" className="w-full h-full object-cover" />
            : <Avatar initials={m.initials} color={m.color} size={80} />
          }
        </div>

        <div className="text-center">
          <div className="font-display text-xl text-ink leading-none">{m.who}</div>
          {m.dept && <div className="font-sans text-[13px] text-ink-3 mt-1">{m.dept}</div>}
        </div>

        {loading ? (
          <span className="font-mono text-[10px] text-ink-4 animate-pulse">carregando...</span>
        ) : (
          <>
            {hasStats && (
              <div className="w-full grid grid-cols-4 border border-hairline mt-1">
                {snap!.rank !== undefined && (
                  <div className="flex flex-col items-center py-2.5">
                    <span className="font-display text-base text-ink leading-none">#{snap!.rank}</span>
                    <span className="font-mono text-[7px] text-ink-4 tracking-eyebrow mt-0.5">RANK</span>
                  </div>
                )}
                {snap!.pts !== undefined && (
                  <div className="flex flex-col items-center py-2.5 border-l border-hairline">
                    <span className="font-display text-base text-ink leading-none">{snap!.pts}</span>
                    <span className="font-mono text-[7px] text-ink-4 tracking-eyebrow mt-0.5">PTS</span>
                  </div>
                )}
                {snap!.correctPredictions !== undefined && (
                  <div className="flex flex-col items-center py-2.5 border-l border-hairline">
                    <span className="font-display text-base text-ink leading-none">{snap!.correctPredictions}</span>
                    <span className="font-mono text-[7px] text-ink-4 tracking-eyebrow mt-0.5">ACERTOS</span>
                  </div>
                )}
                {snap!.exactPredictions !== undefined && (
                  <div className="flex flex-col items-center py-2.5 border-l border-hairline">
                    <span className="font-display text-base text-ink leading-none">{snap!.exactPredictions}</span>
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
