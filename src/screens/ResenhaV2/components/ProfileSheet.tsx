import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Avatar } from '@/components/shared/Avatar'
import { supabase, isMockMode } from '@/lib/supabase'
import { useIsDesktop } from '@/hooks/useBreakpoint'
import { isSafeHttpUrl } from '@/lib/security'
import type { ChatMessage } from '@/types'

interface Snap {
  bannerUrl?: string
  bio?: string
  favoriteTeam?: string
  favoritePlayer?: string
  favoritePlayerImg?: string
  since?: string
  pts?: number
  rank?: number
  correctPredictions?: number
  exactPredictions?: number
}

export function ProfileSheet({ m, onClose }: { m: ChatMessage; onClose: () => void }) {
  const navigate  = useNavigate()
  const isDesktop = useIsDesktop()
  const [snap,    setSnap]    = useState<Snap | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [{ data: uData }, { data: rData }] = await Promise.all([
          supabase
            .from('public_profiles')
            .select('banner_url,bio,favorite_team,favorite_player,favorite_player_img,since')
            .eq('id', m.userId)
            .single(),
          supabase
            .from('ranking_snapshots')
            .select('pts,rank,correct_predictions,exact_predictions')
            .eq('user_id', m.userId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
        ])
        if (!cancelled) setSnap({
          bannerUrl:          isSafeHttpUrl(uData?.banner_url)        ? uData!.banner_url  : undefined,
          bio:                uData?.bio                              ?? undefined,
          favoriteTeam:       uData?.favorite_team                   ?? undefined,
          favoritePlayer:     uData?.favorite_player                 ?? undefined,
          favoritePlayerImg:  isSafeHttpUrl(uData?.favorite_player_img) ? uData!.favorite_player_img : undefined,
          since:              uData?.since                           ?? undefined,
          pts:                rData?.pts                             ?? undefined,
          rank:               rData?.rank                            ?? undefined,
          correctPredictions: rData?.correct_predictions             ?? undefined,
          exactPredictions:   rData?.exact_predictions               ?? undefined,
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

  const panelContent = (
    <div className="flex flex-col h-full">
      {/* Top bar — absolute so it floats over banner */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-hairline flex-shrink-0 bg-paper z-10">
        <button onClick={onClose} className="font-mono text-[10px] tracking-widest text-ink-3 hover:text-ink transition-colors">
          ← FECHAR
        </button>
        <span className="font-mono text-[9px] text-ink-4">PARTICIPANTE</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Banner */}
        <div
          className="relative h-28 flex-shrink-0 overflow-hidden"
          style={{ background: snap?.bannerUrl ? undefined : m.color }}
        >
          {snap?.bannerUrl && (
            <img src={snap.bannerUrl} alt="" className="w-full h-full object-cover" />
          )}
          {/* Dark gradient for contrast */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
        </div>

        {/* Avatar overlapping banner */}
        <div className="relative px-5 pb-4">
          <div className="-mt-10 mb-3 w-20 h-20 rounded-full overflow-hidden border-4 border-paper flex-shrink-0" style={{ background: m.color }}>
            {isSafeHttpUrl(m.avatarUrl)
              ? <img src={m.avatarUrl} alt="" className="w-full h-full object-cover" />
              : <Avatar initials={m.initials} color={m.color} size={80} />}
          </div>

          {/* Name + dept */}
          <div className="mb-3">
            <div className="font-display text-xl text-ink leading-tight">{m.who}</div>
            {m.dept && <div className="font-sans text-[13px] text-ink-3 mt-0.5">{m.dept}</div>}
          </div>

          {loading ? (
            <span className="font-mono text-[10px] text-ink-4 animate-pulse">carregando...</span>
          ) : snap && (
            <div className="space-y-4">
              {/* Stats grid */}
              {hasStats && (
                <div className="grid grid-cols-4 border border-hairline">
                  {snap.rank !== undefined && (
                    <div className="flex flex-col items-center py-2.5">
                      <span className="font-display text-base text-ink leading-none">#{snap.rank}</span>
                      <span className="font-mono text-[7px] text-ink-4 mt-0.5">RANK</span>
                    </div>
                  )}
                  {snap.pts !== undefined && (
                    <div className="flex flex-col items-center py-2.5 border-l border-hairline">
                      <span className="font-display text-base text-ink leading-none">{snap.pts}</span>
                      <span className="font-mono text-[7px] text-ink-4 mt-0.5">PTS</span>
                    </div>
                  )}
                  {snap.correctPredictions !== undefined && (
                    <div className="flex flex-col items-center py-2.5 border-l border-hairline">
                      <span className="font-display text-base text-ink leading-none">{snap.correctPredictions}</span>
                      <span className="font-mono text-[7px] text-ink-4 mt-0.5">ACERTOS</span>
                    </div>
                  )}
                  {snap.exactPredictions !== undefined && (
                    <div className="flex flex-col items-center py-2.5 border-l border-hairline">
                      <span className="font-display text-base text-ink leading-none">{snap.exactPredictions}</span>
                      <span className="font-mono text-[7px] text-ink-4 mt-0.5">EXATOS</span>
                    </div>
                  )}
                </div>
              )}

              {/* Detail rows */}
              <div className="space-y-2 border-t border-hairline pt-3">
                {snap.favoriteTeam && (
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[9px] text-ink-4 w-20 flex-shrink-0">TIME</span>
                    <span className="font-mono text-[11px] text-ink font-bold">{snap.favoriteTeam}</span>
                  </div>
                )}
                {snap.favoritePlayer && (
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[9px] text-ink-4 w-20 flex-shrink-0">JOGADOR</span>
                    <div className="flex items-center gap-2 min-w-0">
                      {snap.favoritePlayerImg && (
                        <img src={snap.favoritePlayerImg} alt="" className="w-7 h-7 rounded-full object-cover flex-shrink-0 border border-hairline" />
                      )}
                      <span className="font-mono text-[11px] text-ink font-bold truncate">{snap.favoritePlayer}</span>
                    </div>
                  </div>
                )}
                {snap.since && (
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[9px] text-ink-4 w-20 flex-shrink-0">MEMBRO DESDE</span>
                    <span className="font-mono text-[11px] text-ink">{snap.since}</span>
                  </div>
                )}
              </div>

              {/* Bio */}
              {snap.bio && (
                <p className="font-sans text-[12px] text-ink-3 leading-relaxed border-t border-hairline pt-3">
                  {snap.bio}
                </p>
              )}
            </div>
          )}

          <button
            onClick={() => { onClose(); navigate(`/u/${m.userId}`) }}
            className="btn-yellow w-full justify-center mt-6"
          >
            VER PERFIL COMPLETO →
          </button>
        </div>
      </div>
    </div>
  )

  if (isDesktop) {
    return (
      <motion.div
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        className="absolute inset-y-0 right-0 w-80 bg-paper border-l border-hairline z-40 flex flex-col shadow-2xl overflow-hidden"
      >
        {panelContent}
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex flex-col justify-end bg-ink/50"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        className="bg-paper rounded-t-2xl max-h-[88dvh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {panelContent}
      </motion.div>
    </motion.div>
  )
}
