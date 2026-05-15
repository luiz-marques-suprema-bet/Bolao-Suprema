import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Flag } from '@/components/shared/Flag'
import { Avatar } from '@/components/shared/Avatar'
import { useIsDesktop } from '@/hooks/useBreakpoint'
import { useAuthStore } from '@/stores/auth.store'
import { usePredictionStore } from '@/stores/prediction.store'
import { useChatStore } from '@/stores/chat.store'
import { useMatchStore } from '@/stores/match.store'
import { WC2026_MATCHES } from '@/data/wc2026'
import { TEAMS } from '@/data/teams'
import { fmtPts, cn } from '@/lib/utils'
import { fetchRanking } from '@/lib/ranking'
import { fetchFeaturedVideos } from '@/lib/scorebat'
import type { ScorebatVideo } from '@/lib/scorebat'
import { fetchFootballImages, FOOTBALL_FALLBACKS } from '@/lib/footballimages'
import type { FootballImage } from '@/lib/footballimages'
import { SafeImage } from '@/components/shared/SafeImage'
import { formatMatchDate, formatMatchTime, getBettingDeadline } from '@/lib/matchTime'
import { getEffectiveMarketStatus } from '@/lib/markets'
import { fetchWC26News, isConfigured as newsConfigured } from '@/lib/footballnews'
import type { FootballNewsItem } from '@/lib/footballnews'
import type { RankingEntry, Match } from '@/types'

// ─── Rotating hero background ─────────────────────────────────────────────────

const HERO_THEMES = [
  { code: 'BRA', label: 'BRASIL',    c1: '#009C3B', c2: '#002776' },
  { code: 'ARG', label: 'ARGENTINA', c1: '#74ACDF', c2: '#004F9F' },
  { code: 'FRA', label: 'FRANCE',    c1: '#003087', c2: '#EF4135' },
  { code: 'GER', label: 'ALEMANHA',  c1: '#1a1a1a', c2: '#FFCC00' },
  { code: 'ESP', label: 'ESPANHA',   c1: '#AA151B', c2: '#F1BF00' },
  { code: 'POR', label: 'PORTUGAL',  c1: '#006600', c2: '#FF0000' },
  { code: 'USA', label: 'USA',       c1: '#002868', c2: '#BF0A30' },
  { code: 'ENG', label: 'ENGLAND',   c1: '#003087', c2: '#CF081F' },
  { code: 'NED', label: 'HOLANDA',   c1: '#FF4F00', c2: '#1D2671' },
  { code: 'MEX', label: 'MÉXICO',    c1: '#006847', c2: '#CE1126' },
]

// ─── Video highlights ─────────────────────────────────────────────────────────

function extractIframeSrc(embed: string): string {
  return embed.match(/src='([^']+)'/)?.[1] ?? embed.match(/src="([^"]+)"/)?.[1] ?? ''
}

function compLabel(competition: string): string {
  const parts = competition.split(':')
  return (parts[1] ?? parts[0]).trim().toUpperCase()
}

function VideoCard({
  video, isActive, onClick,
}: {
  video: ScorebatVideo
  isActive: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'relative w-full overflow-hidden group text-left border-2 transition-all duration-200',
        isActive ? 'border-yellow' : 'border-transparent hover:border-ink/30'
      )}
    >
      {/* Thumbnail */}
      <div className="relative overflow-hidden" style={{ paddingBottom: '56.25%' }}>
        <img
          src={video.thumbnail}
          alt={video.title}
          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/20 to-transparent" />

        {/* Competition badge */}
        <div className="absolute top-2 left-2">
          <span className="font-mono text-[7px] font-bold tracking-eyebrow bg-yellow text-ink px-1.5 py-0.5 leading-none">
            {compLabel(video.competition)}
          </span>
        </div>

        {/* Play button */}
        <div className={cn(
          'absolute inset-0 flex items-center justify-center transition-opacity',
          isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        )}>
          <div className={cn(
            'w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all',
            isActive ? 'bg-yellow border-yellow text-ink scale-110' : 'bg-paper/20 border-paper/60 text-paper backdrop-blur-sm'
          )}>
            <span className="text-[14px] ml-0.5">{isActive ? '■' : '▶'}</span>
          </div>
        </div>

        {/* Title at bottom */}
        <div className="absolute bottom-0 left-0 right-0 p-2.5">
          <p className="font-mono text-[10px] font-bold text-paper leading-tight line-clamp-2">
            {video.title}
          </p>
        </div>
      </div>
    </button>
  )
}

function VideoHighlights() {
  const [videos, setVideos] = useState<ScorebatVideo[]>([])
  const [active, setActive] = useState<ScorebatVideo | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchFeaturedVideos().then(v => {
      setVideos(v.slice(0, 11))
      setLoading(false)
    })
  }, [])

  if (!loading && videos.length === 0) return null

  const [featured, ...rest] = videos
  const iframeSrc = active ? extractIframeSrc(active.embed) : ''

  function toggle(v: ScorebatVideo) {
    setActive(prev => prev?.matchviewUrl === v.matchviewUrl ? null : v)
  }

  return (
    <div className="border-2 border-ink overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-hairline bg-ink flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <span className="font-display text-lg text-paper">DESTAQUES</span>
          <span className="font-serif-it text-base text-paper/50">futebol ao redor do mundo</span>
        </div>
        <a
          href="https://www.scorebat.com"
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-[7px] text-paper/30 tracking-eyebrow hover:text-paper/60 transition-colors"
        >
          SCOREBAT ↗
        </a>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-0 sm:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-paper-deep animate-pulse border-r border-b border-hairline" style={{ paddingBottom: '56.25%' }} />
          ))}
        </div>
      ) : (
        <>
          {/* Active player — expands inline with animation */}
          <AnimatePresence>
            {active && iframeSrc && (
              <motion.div
                key={active.matchviewUrl}
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className="overflow-hidden border-b-2 border-yellow"
              >
                <div className="relative bg-ink" style={{ paddingBottom: '56.25%' }}>
                  <iframe
                    src={iframeSrc}
                    className="absolute inset-0 w-full h-full"
                    frameBorder="0"
                    allowFullScreen
                    allow="autoplay; fullscreen"
                  />
                </div>
                {/* Info bar below player */}
                <div className="px-4 py-2.5 bg-ink flex items-center justify-between">
                  <div>
                    <div className="font-display text-base text-paper leading-tight">{active.title}</div>
                    <div className="font-mono text-[9px] text-paper/40 tracking-eyebrow mt-0.5">
                      {compLabel(active.competition)}
                    </div>
                  </div>
                  <button
                    onClick={() => setActive(null)}
                    className="w-8 h-8 rounded-full border border-paper/20 flex items-center justify-center text-paper/50 hover:text-paper hover:border-paper/60 transition-colors font-mono text-[11px]"
                  >
                    ✕
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Featured video — full width */}
          {featured && (
            <div className="border-b border-hairline">
              <VideoCard
                video={featured}
                isActive={active?.matchviewUrl === featured.matchviewUrl}
                onClick={() => toggle(featured)}
              />
            </div>
          )}

          {/* Grid of remaining videos */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {rest.map((v, i) => (
              <div
                key={v.matchviewUrl}
                className={cn(
                  'border-hairline',
                  i % 2 === 0 ? 'border-r' : '',
                  Math.floor(i / 2) < Math.floor((rest.length - 1) / 2) ? 'border-b' : ''
                )}
              >
                <VideoCard
                  video={v}
                  isActive={active?.matchviewUrl === v.matchviewUrl}
                  onClick={() => toggle(v)}
                />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Copa 2026 news ────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const h = Math.floor(diff / 3_600_000)
  if (h < 1) return 'agora'
  if (h < 24) return `${h}h atrás`
  return `${Math.floor(h / 24)}d atrás`
}

function WC26News({ compact = false }: { compact?: boolean }) {
  const [news, setNews] = useState<FootballNewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [featured, setFeatured] = useState<FootballNewsItem | null>(null)

  useEffect(() => {
    if (!newsConfigured()) { setLoading(false); return }
    fetchWC26News(compact ? 6 : 10).then(items => {
      setNews(items)
      setFeatured(items[0] ?? null)
      setLoading(false)
    })
  }, [compact])

  if (!newsConfigured() || (!loading && news.length === 0)) return null

  return (
    <div className="border-2 border-ink">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-hairline flex items-baseline justify-between bg-ink text-paper">
        <div className="flex items-baseline gap-1.5">
          <span className="font-display text-base">COPA 2026</span>
          <span className="font-serif-it text-sm text-paper/50">últimas notícias</span>
        </div>
        <span className="font-mono text-[8px] text-paper/30 tracking-eyebrow">ao vivo</span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <span className="font-mono text-[10px] text-ink-4 animate-pulse tracking-eyebrow">CARREGANDO…</span>
        </div>
      ) : compact ? (
        /* Compact list (mobile) */
        <div className="divide-y divide-hairline">
          {news.map(item => (
            <a
              key={item.url}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-3 px-4 py-3 hover:bg-paper-deep transition-colors group"
            >
              {item.image && (
                <img
                  src={item.image}
                  alt=""
                  className="w-16 h-12 object-cover flex-shrink-0 border border-hairline"
                  onError={e => (e.currentTarget.style.display = 'none')}
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-mono text-[11px] font-bold text-ink leading-tight line-clamp-2 group-hover:underline">
                  {item.title}
                </p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="font-mono text-[8px] text-ink-4 tracking-eyebrow">{item.source}</span>
                  <span className="font-mono text-[8px] text-ink-4">·</span>
                  <span className="font-mono text-[8px] text-ink-4">{timeAgo(item.publishedAt)}</span>
                </div>
              </div>
              <span className="font-mono text-[11px] text-ink-4 group-hover:text-ink transition-colors flex-shrink-0 self-center">→</span>
            </a>
          ))}
        </div>
      ) : (
        /* Full layout (desktop): featured + list */
        <div className="grid grid-cols-[1fr_300px]">
          {/* Featured */}
          {featured && (
            <a
              href={featured.url}
              target="_blank"
              rel="noopener noreferrer"
              className="relative group overflow-hidden border-r border-hairline block"
              style={{ minHeight: 240 }}
            >
              {featured.image && (
                <img
                  src={featured.image}
                  alt=""
                  className="w-full h-full object-cover absolute inset-0 group-hover:scale-105 transition-transform duration-500"
                  onError={e => (e.currentTarget.style.display = 'none')}
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/40 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-5">
                <div className="font-mono text-[8px] text-yellow tracking-eyebrow mb-1.5">
                  {featured.source} · {timeAgo(featured.publishedAt)}
                </div>
                <h3 className="font-display text-xl text-paper leading-tight group-hover:text-yellow transition-colors">
                  {featured.title}
                </h3>
                {featured.tags.length > 0 && (
                  <div className="flex gap-1.5 mt-2 flex-wrap">
                    {featured.tags.slice(0, 3).map(t => (
                      <span key={t} className="font-mono text-[7px] text-paper/50 tracking-eyebrow bg-paper/10 px-1.5 py-0.5">
                        {t.toUpperCase()}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </a>
          )}

          {/* Side list */}
          <div className="divide-y divide-hairline overflow-hidden">
            {news.slice(1, 7).map(item => (
              <a
                key={item.url}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-2.5 px-3 py-3 hover:bg-paper-deep transition-colors group"
              >
                {item.image && (
                  <img
                    src={item.image}
                    alt=""
                    className="w-14 h-10 object-cover flex-shrink-0 border border-hairline"
                    onError={e => (e.currentTarget.style.display = 'none')}
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-[10px] font-bold text-ink leading-tight line-clamp-2 group-hover:underline">
                    {item.title}
                  </p>
                  <div className="flex items-center gap-1 mt-1">
                    <span className="font-mono text-[7px] text-ink-4">{item.source}</span>
                    <span className="font-mono text-[7px] text-ink-4">·</span>
                    <span className="font-mono text-[7px] text-ink-4">{timeAgo(item.publishedAt)}</span>
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function useHeroImages() {
  const [images, setImages] = useState<FootballImage[]>(FOOTBALL_FALLBACKS)

  useEffect(() => {
    // Try Scorebat thumbnails first (fastest, match photos)
    fetchFeaturedVideos().then(vids => {
      const scorebatImgs = vids
        .filter(v => v.thumbnail)
        .slice(0, 10)
        .map(v => ({ url: v.thumbnail, alt: v.title }))
      if (scorebatImgs.length >= 4) {
        setImages(scorebatImgs)
        return
      }
      // Fallback: Pexels or curated
      fetchFootballImages().then(imgs => {
        if (imgs.length > 0) setImages(imgs)
      })
    }).catch(() => {
      fetchFootballImages().then(imgs => { if (imgs.length > 0) setImages(imgs) })
    })
  }, [])

  return images
}

function RotatingHero({ days, children }: { days: number; children?: React.ReactNode }) {
  const [idx, setIdx] = useState(0)
  const heroImages = useHeroImages()

  useEffect(() => {
    const total = Math.max(HERO_THEMES.length, heroImages.length)
    const id = setInterval(() => setIdx(i => (i + 1) % total), 5000)
    return () => clearInterval(id)
  }, [heroImages.length])

  const theme = HERO_THEMES[idx % HERO_THEMES.length]
  const team = TEAMS[theme.code]
  const bgImage = heroImages[idx % heroImages.length]

  return (
    <section className="relative overflow-hidden" style={{ height: 300 }}>
      {/* Background photo */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`bg-${idx}`}
          initial={{ opacity: 0, scale: 1.06 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.6, ease: 'easeOut' }}
          className="absolute inset-0"
        >
          {bgImage
            ? <SafeImage src={bgImage.url} alt={bgImage.alt} className="w-full h-full" />
            : <div className="w-full h-full bg-ink" />
          }
        </motion.div>
      </AnimatePresence>

      {/* Color overlay — national team colours */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`color-${idx}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.75 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.2 }}
          className="absolute inset-0"
          style={{ background: `linear-gradient(135deg, ${theme.c1}EE 0%, ${theme.c2}AA 100%)` }}
        />
      </AnimatePresence>

      {/* Depth gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-ink/10 to-ink/90" />

      {/* Team badge */}
      <AnimatePresence mode="wait">
        {team && (
          <motion.div
            key={`badge-${idx}`}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.45 }}
            className="absolute top-4 right-4 flex items-center gap-2 bg-ink/60 backdrop-blur-sm px-3 py-1.5 border border-paper/10"
          >
            <Flag team={team} size={18} className="rounded-none" />
            <span className="font-mono text-[10px] text-paper tracking-eyebrow font-bold">{theme.label}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Slide dots */}
      <div className="absolute bottom-[72px] left-0 right-0 flex justify-center gap-1">
        {heroImages.slice(0, 8).map((_, i) => (
          <button
            key={i}
            onClick={() => setIdx(i)}
            className={cn('w-1 h-1 rounded-full transition-all', i === idx % 8 ? 'bg-yellow w-4' : 'bg-paper/30')}
          />
        ))}
      </div>

      {/* Countdown */}
      <div className="absolute inset-0 flex flex-col items-center justify-end pb-8 px-4 text-center">
        <div className="font-mono text-[10px] tracking-eyebrow text-paper/60 mb-1">
          COPA DO MUNDO 2026 · FASE DE GRUPOS
        </div>
        <div className="font-display text-[80px] leading-none text-paper drop-shadow-lg">{days}</div>
        <div className="font-display text-2xl text-paper/70 -mt-1">DIAS</div>
        <div className="font-serif-it text-sm text-yellow mt-1">para a bola rolar · 11 Jun · 16:00 BRT</div>
      </div>

      {children}
    </section>
  )
}

const TOURNAMENT_START = getBettingDeadline(WC2026_MATCHES[0])

function daysUntil(target: Date): number {
  const now = new Date()
  return Math.max(0, Math.ceil((target.getTime() - now.getTime()) / 86_400_000))
}

// ─── Shared data hook ────────────────────────────────────────────────────────

function useHomeData() {
  const me = useAuthStore(s => s.user)
  const { overrides, isLoaded } = useMatchStore()
  const [ranking, setRanking] = useState<RankingEntry[]>([])

  useEffect(() => {
    fetchRanking(me?.id).then(setRanking)
  }, [me?.id])

  // Upcoming = first 6 open or scheduled matches (not finished/live/locked)
  const upcoming = isLoaded
    ? WC2026_MATCHES
        .map((m): Match => {
          const ov = overrides[m.id]
          return ov ? { ...m, ...ov } : m
        })
        .filter(m => getEffectiveMarketStatus(m) === 'open')
        .slice(0, 8)
    : WC2026_MATCHES.filter(m => m.status === 'scheduled').slice(0, 8)

  return { ranking, upcoming }
}

export function HomeScreen() {
  const isDesktop = useIsDesktop()
  return isDesktop ? <HomeDesktop /> : <HomeMobile />
}

// ─── Desktop rotating hero card ──────────────────────────────────────────────

function RotatingHeroDesktop({ days, onCta }: { days: number; onCta: () => void }) {
  const [idx, setIdx] = useState(0)
  const heroImages = useHeroImages()

  useEffect(() => {
    const total = Math.max(HERO_THEMES.length, heroImages.length)
    const id = setInterval(() => setIdx(i => (i + 1) % total), 5000)
    return () => clearInterval(id)
  }, [heroImages.length])

  const theme = HERO_THEMES[idx % HERO_THEMES.length]
  const team = TEAMS[theme.code]
  const bgImage = heroImages[idx % heroImages.length]

  return (
    <div className="relative overflow-hidden min-h-[340px] border-2 border-ink">
      <AnimatePresence mode="wait">
        <motion.div
          key={`dbg-${idx}`}
          initial={{ opacity: 0, scale: 1.06 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.6, ease: 'easeOut' }}
          className="absolute inset-0"
        >
          {bgImage
            ? <SafeImage src={bgImage.url} alt={bgImage.alt} className="w-full h-full" />
            : <div className="w-full h-full bg-ink" />
          }
        </motion.div>
      </AnimatePresence>
      <AnimatePresence mode="wait">
        <motion.div
          key={`dcolor-${idx}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.75 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.2 }}
          className="absolute inset-0"
          style={{ background: `linear-gradient(135deg, ${theme.c1}EE 0%, ${theme.c2}AA 100%)` }}
        />
      </AnimatePresence>
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-ink/10 to-ink/90" />

      {/* Team pill top-right */}
      <AnimatePresence mode="wait">
        {team && (
          <motion.div
            key={`d-badge-${idx}`}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.4 }}
            className="absolute top-4 right-4 flex items-center gap-2 bg-ink/60 backdrop-blur-sm px-3 py-1.5 border border-paper/10"
          >
            <Flag team={team} size={20} className="rounded-none" />
            <span className="font-mono text-[10px] text-paper tracking-eyebrow font-bold">{theme.label}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Slide dots */}
      <div className="absolute bottom-[100px] left-0 right-0 flex justify-center gap-1">
        {heroImages.slice(0, 8).map((_, i) => (
          <button
            key={i}
            onClick={() => setIdx(i)}
            className={cn('w-1 h-1 rounded-full transition-all', i === idx % 8 ? 'bg-yellow w-4' : 'bg-paper/30')}
          />
        ))}
      </div>

      <div className="relative h-full flex flex-col justify-end p-6">
        <div className="font-mono text-[10px] font-bold tracking-eyebrow text-paper/60 mb-2">
          COPA DO MUNDO 2026 · USA / CAN / MEX
        </div>
        <div className="flex items-end gap-4 mb-3">
          <div>
            <div className="font-display text-[110px] leading-none text-paper drop-shadow-lg">{days}</div>
            <div className="font-display text-3xl text-paper/60 -mt-2">DIAS</div>
          </div>
          <div className="pb-2">
            <div className="font-serif-it text-xl text-yellow">para a bola rolar</div>
            <div className="font-mono text-[11px] text-paper/50 mt-1">11 Jun · 16:00 · Horário de Brasília</div>
          </div>
        </div>
        <button onClick={onCta} className="btn-yellow w-fit">FAZER PALPITES AGORA →</button>
      </div>
    </div>
  )
}

// ─── Prediction progress bar ──────────────────────────────────────────────────

function PredProgress({ done, total, label }: { done: number; total: number; label: string }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="font-mono text-[10px] text-ink-3 tracking-eyebrow">{label}</span>
        <span className="font-mono text-[10px] font-bold text-ink">{done}/{total}</span>
      </div>
      <div className="h-1 bg-hairline overflow-hidden">
        <div className="h-full bg-green transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

// ─── Mobile ───────────────────────────────────────────────────────────────────

function HomeMobile() {
  const navigate = useNavigate()
  const user = useAuthStore(s => s.user)
  const { predictions, championPick, vicePick, scorerPick } = usePredictionStore()
  const { ranking, upcoming } = useHomeData()
  const days = daysUntil(TOURNAMENT_START)

  const totalMatches = WC2026_MATCHES.length
  const totalPredictions = Object.keys(predictions).length
  const apostasFeitas = [championPick, vicePick, scorerPick].filter(Boolean).length
  const top3 = ranking.slice(0, 3)
  const myRank = ranking.find(r => r.isYou)

  return (
    <div className="min-h-dvh bg-paper pb-24">

      {/* ── Hero — countdown ── */}
      <RotatingHero days={days} />

      <div className="px-4 space-y-3 pt-4">

        {/* ── Progresso do usuário ── */}
        <div className="border-2 border-ink p-4 space-y-3">
          <div className="flex items-baseline gap-2 mb-1">
            <span className="font-display text-lg">OLÁ{user?.firstName ? `, ${user.firstName.toUpperCase()}` : ''}!</span>
            <span className="font-serif-it text-sm text-ink-3">veja seu progresso</span>
          </div>
          <PredProgress done={totalPredictions} total={totalMatches} label="PALPITES DA FASE DE GRUPOS" />
          <PredProgress done={apostasFeitas} total={3} label="APOSTAS GERAIS" />
          {(totalPredictions === 0 && apostasFeitas === 0) && (
            <p className="font-mono text-[10px] text-ink-3">Nenhum palpite feito ainda. Comece agora!</p>
          )}
          <button onClick={() => navigate('/prediction')} className="btn-yellow w-full justify-center text-[11px] mt-1">
            {totalPredictions === 0 ? 'COMEÇAR A PALPITAR →' : 'CONTINUAR PALPITANDO →'}
          </button>
        </div>

        {/* ── Upcoming matches ── */}
        <div>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="font-display text-lg text-ink">PRÓXIMOS</span>
            <span className="font-serif-it text-sm text-ink-3">jogos</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {upcoming.slice(0, 4).map(match => {
              const hasPick = !!predictions[match.id]
              return (
                <button
                  key={match.id}
                  onClick={() => navigate('/prediction')}
                  className={cn(
                    'border-2 p-3 flex items-center gap-2 hover:-translate-y-px transition-transform text-left',
                    hasPick ? 'border-green bg-green/5' : 'border-ink'
                  )}
                >
                  <Flag team={match.home} size={22} />
                  <span className="font-mono text-[10px] font-bold">{match.home.code}</span>
                  <span className="font-mono text-[9px] text-ink-4 mx-0.5">×</span>
                  <span className="font-mono text-[10px] font-bold">{match.away.code}</span>
                  <Flag team={match.away} size={22} />
                  {hasPick && <span className="font-mono text-[8px] text-green ml-auto">✓</span>}
                </button>
              )
            })}
          </div>
          <button onClick={() => navigate('/prediction')} className="mt-2 font-mono text-[10px] text-ink-3 hover:text-ink tracking-eyebrow">
            VER TODOS OS {totalMatches} JOGOS →
          </button>
        </div>

        {/* ── Ranking preview ── */}
        {top3.length > 0 && (
          <div className="border-2 border-ink">
            <div className="px-4 py-2.5 border-b border-hairline flex items-baseline justify-between">
              <span className="font-display text-base">RANKING</span>
              <button onClick={() => navigate('/ranking')} className="font-mono text-[10px] text-ink-4 hover:text-ink">
                VER TUDO →
              </button>
            </div>
            <div className="divide-y divide-hairline">
              {top3.map(r => (
                <div key={r.userId} className={cn('flex items-center gap-3 px-4 py-2.5', r.isYou && 'bg-yellow')}>
                  <span className="font-display text-xl w-6 flex-shrink-0">{r.rank}°</span>
                  <Avatar initials={r.initials} color={r.color} size={28} />
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-[11px] font-bold truncate">{r.name}</div>
                    <div className="font-mono text-[9px] text-ink-3">{r.dept}</div>
                  </div>
                  <span className="font-display text-lg">{fmtPts(r.pts)}</span>
                </div>
              ))}
              {myRank && myRank.rank > 3 && (
                <div className="flex items-center gap-3 px-4 py-2.5 bg-yellow">
                  <span className="font-display text-xl w-6 flex-shrink-0">{myRank.rank}°</span>
                  <Avatar initials={myRank.initials} color={myRank.color} size={28} />
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-[11px] font-bold truncate">Você</div>
                    <div className="font-mono text-[9px] text-ink-3">{myRank.dept}</div>
                  </div>
                  <span className="font-display text-lg">{fmtPts(myRank.pts)}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Apostas gerais CTA ── */}
        {apostasFeitas < 3 && (
          <div className="border-2 border-yellow bg-yellow/10 p-4">
            <div className="font-mono text-[10px] tracking-eyebrow text-ink-3 mb-1">APOSTAS GERAIS · OBRIGATÓRIO</div>
            <p className="font-display text-xl text-ink leading-tight mb-2">
              CAMPEÃO · VICE · ARTILHEIRO
            </p>
            <p className="font-mono text-[10px] text-ink-3 mb-3">
              Prazo: antes de 11 Jun · 16:00 · vale até +50 pontos
            </p>
            <button
              onClick={() => navigate('/prediction', { state: { tab: 'champion' } })}
              className="btn-ink text-[11px] w-full justify-center"
            >
              FAZER APOSTAS GERAIS →
            </button>
          </div>
        )}

        {/* ── Mata-mata CTA ── */}
        <div className="border-2 border-ink p-4 flex items-center justify-between gap-3">
          <div>
            <div className="font-mono text-[10px] tracking-eyebrow text-ink-3 mb-0.5">MATA-MATA</div>
            <div className="font-display text-xl">MINHA CHAVE</div>
            <div className="font-serif-it text-sm text-ink-3">oitavas · quartas · semi · final</div>
          </div>
          <button onClick={() => navigate('/bracket')} className="btn-ink text-[11px] px-4 py-2.5 flex-shrink-0">
            PALPITAR →
          </button>
        </div>

        {/* ── Notícias Copa 2026 ── */}
        <WC26News compact />

        {/* ── Destaques do futebol ── */}
        <VideoHighlights />

      </div>

    </div>
  )
}

// ─── Desktop ──────────────────────────────────────────────────────────────────

function HomeDesktop() {
  const navigate = useNavigate()
  const user = useAuthStore(s => s.user)
  const { predictions, championPick, vicePick, scorerPick } = usePredictionStore()
  const { ranking, upcoming } = useHomeData()
  const days = daysUntil(TOURNAMENT_START)

  const totalMatches = WC2026_MATCHES.length
  const totalPredictions = Object.keys(predictions).length
  const apostasFeitas = [championPick, vicePick, scorerPick].filter(Boolean).length
  const top5 = ranking.slice(0, 5)
  const myRank = ranking.find(r => r.isYou)

  return (
    <div className="min-h-dvh bg-paper">
      <div className="max-w-screen-xl mx-auto px-6 py-8 space-y-5">

        {/* ── Hero row — 3 columns ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-[1.5fr_1fr_0.9fr] gap-5">

          {/* Countdown card — rotating hero */}
          <RotatingHeroDesktop days={days} onCta={() => navigate('/prediction')} />

          {/* Progresso */}
          <div className="border-2 border-ink bg-ink text-paper flex flex-col p-6 gap-4">
            <div>
              <div className="font-mono text-[10px] tracking-eyebrow text-paper/40 mb-1">
                OLÁ{user?.firstName ? `, ${user.firstName.toUpperCase()}` : ''}!
              </div>
              <div className="font-display text-4xl leading-none">{totalPredictions}</div>
              <div className="font-serif-it text-paper/60 text-sm">de {totalMatches} palpites feitos</div>
            </div>

            <div className="space-y-3 flex-1">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="font-mono text-[9px] text-paper/40 tracking-eyebrow">GRUPOS</span>
                  <span className="font-mono text-[9px] text-paper/60">{totalPredictions}/{totalMatches}</span>
                </div>
                <div className="h-1 bg-paper/10 overflow-hidden">
                  <div className="h-full bg-yellow transition-all" style={{ width: `${totalMatches > 0 ? (totalPredictions / totalMatches) * 100 : 0}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <span className="font-mono text-[9px] text-paper/40 tracking-eyebrow">APOSTAS GERAIS</span>
                  <span className="font-mono text-[9px] text-paper/60">{apostasFeitas}/3</span>
                </div>
                <div className="h-1 bg-paper/10 overflow-hidden">
                  <div className="h-full bg-green transition-all" style={{ width: `${(apostasFeitas / 3) * 100}%` }} />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <button onClick={() => navigate('/prediction')} className="btn-yellow w-full justify-center">
                {totalPredictions === 0 ? 'COMEÇAR →' : 'CONTINUAR →'}
              </button>
              {apostasFeitas < 3 && (
                <button
                  onClick={() => navigate('/prediction', { state: { tab: 'champion' } })}
                  className="w-full border border-yellow/30 p-2 text-center hover:bg-yellow/10 transition-colors"
                >
                  <span className="font-mono text-[9px] text-yellow tracking-eyebrow">
                    ⚠ APOSTAS GERAIS PENDENTES
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* Ranking preview */}
          <div className="border-2 border-ink flex flex-col">
            <div className="px-4 py-3 border-b border-hairline flex items-baseline justify-between">
              <div className="flex items-baseline gap-2">
                <span className="font-display text-lg">RANKING</span>
                {myRank && <span className="font-serif-it text-sm text-ink-3">{myRank.rank}° você</span>}
              </div>
              <button onClick={() => navigate('/ranking')} className="font-mono text-[10px] text-ink-4 hover:text-ink">
                VER TUDO →
              </button>
            </div>
            {top5.length > 0 ? (
              <div className="flex-1 divide-y divide-hairline">
                {top5.map(r => (
                  <div key={r.userId} className={cn('flex items-center gap-2 px-4 py-2', r.isYou && 'bg-yellow')}>
                    <span className="font-display text-base w-5 flex-shrink-0">{r.rank}</span>
                    <Avatar initials={r.initials} color={r.color} size={24} />
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-[10px] font-bold truncate">{r.name.split(' ')[0]}</div>
                      <div className="font-mono text-[8px] text-ink-3">{r.dept}</div>
                    </div>
                    <span className="font-display text-base">{fmtPts(r.pts)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-3">
                <span className="font-display text-5xl text-ink-4">—</span>
                <p className="font-mono text-[11px] text-ink-3 leading-relaxed max-w-[160px]">
                  Os pontos aparecem aqui quando os jogos começarem.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ── Secondary row ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-[1.6fr_1fr_1fr] gap-5">

          {/* Upcoming matches */}
          <div className="border-2 border-ink">
            <div className="px-4 py-3 border-b border-hairline flex items-baseline gap-2">
              <span className="font-display text-lg">PRÓXIMOS</span>
              <span className="font-serif-it text-sm text-ink-3">jogos · grupo</span>
            </div>
            <div className="divide-y divide-hairline">
              {upcoming.slice(0, 6).map(match => {
                const hasPick = !!predictions[match.id]
                return (
                  <button
                    key={match.id}
                    onClick={() => navigate('/prediction')}
                    className={cn(
                      'w-full flex items-center gap-4 px-4 py-3 transition-colors text-left group',
                      hasPick ? 'bg-green/5 hover:bg-green/10' : 'hover:bg-hairline'
                    )}
                  >
                    <div className="flex-shrink-0 w-14 text-center">
                      <div className="font-mono text-[9px] text-ink-4 tracking-eyebrow">GRUPO {match.group}</div>
                    </div>
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Flag team={match.home} size={26} />
                      <div className="min-w-0">
                        <div className="font-mono text-[12px] font-bold truncate">{match.home.name}</div>
                      </div>
                    </div>
                    <div className="text-center flex-shrink-0 px-2">
                      <div className="font-mono text-[9px] text-ink-4 tracking-eyebrow">{formatMatchDate(match)}</div>
                      <div className="font-display text-lg leading-none">{formatMatchTime(match)}</div>
                    </div>
                    <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                      <div className="min-w-0 text-right">
                        <div className="font-mono text-[12px] font-bold truncate">{match.away.name}</div>
                      </div>
                      <Flag team={match.away} size={26} />
                    </div>
                    {hasPick
                      ? <span className="font-mono text-[10px] text-green flex-shrink-0">✓</span>
                      : <span className="font-mono text-[10px] text-ink-4 group-hover:text-ink transition-colors flex-shrink-0">→</span>
                    }
                  </button>
                )
              })}
            </div>
            <button onClick={() => navigate('/prediction')} className="w-full px-4 py-2.5 font-mono text-[10px] text-ink-3 hover:text-ink tracking-eyebrow border-t border-hairline text-center">
              VER TODOS OS {totalMatches} JOGOS →
            </button>
          </div>

          {/* Mata-mata CTA */}
          <div className="border-2 border-ink flex flex-col">
            <div className="px-4 py-3 border-b border-hairline flex items-baseline gap-2">
              <span className="font-display text-lg">MINHA CHAVE</span>
              <span className="font-serif-it text-sm text-ink-3">mata-mata</span>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-4">
              <p className="font-mono text-[11px] text-ink-3 leading-relaxed">
                Palpite no mata-mata — oitavas a partir de 27 Jun. Seus palpites de grupo determinam as equipes.
              </p>
              <button
                onClick={() => navigate('/bracket')}
                className="btn-yellow w-full justify-center"
              >
                MINHA CHAVE →
              </button>
            </div>
          </div>

          {/* Resenha CTA */}
          <ResenhaCard />
        </div>

        {/* ── Notícias Copa 2026 — full layout ── */}
        <WC26News />

        {/* ── Destaques do futebol — full width ── */}
        <VideoHighlights />

      </div>

    </div>
  )
}

function ResenhaCard() {
  const navigate = useNavigate()
  const messages = useChatStore(s => s.messages)
  const recent = messages.slice(-3)

  return (
    <div className="border-2 border-ink flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b border-hairline flex items-baseline justify-between">
        <div className="flex items-baseline gap-1.5">
          <span className="font-display text-lg">#RESENHA</span>
          <span className="font-serif-it text-sm text-ink-3">ao vivo</span>
        </div>
        <button onClick={() => navigate('/resenha')} className="font-mono text-[10px] text-ink-4 hover:text-ink">
          ENTRAR →
        </button>
      </div>
      {recent.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-3">
          <span className="font-display text-4xl text-ink-4">○</span>
          <p className="font-mono text-[11px] text-ink-3 leading-relaxed">
            Nenhuma mensagem ainda. Seja o primeiro a entrar na resenha.
          </p>
          <button onClick={() => navigate('/resenha')} className="btn-ghost text-[10px]">
            ENTRAR NA RESENHA →
          </button>
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-hairline">
          {recent.map(msg => (
            <div key={msg.id} className="px-4 py-2.5 flex gap-2.5 items-start">
              <Avatar initials={msg.initials} color={msg.color} src={msg.avatarUrl} size={24} />
              <div className="flex-1 min-w-0">
                <span className="font-mono text-[10px] font-bold text-ink">{msg.who}</span>
                <p className="font-sans text-[12px] text-ink-2 leading-snug truncate">{msg.text}</p>
              </div>
            </div>
          ))}
          <button
            onClick={() => navigate('/resenha')}
            className="px-4 py-2.5 font-mono text-[10px] text-ink-4 hover:text-ink hover:bg-hairline text-left transition-colors"
          >
            VER TUDO →
          </button>
        </div>
      )}
    </div>
  )
}
