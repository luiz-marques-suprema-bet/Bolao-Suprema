import { useNavigate } from 'react-router-dom'
import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Flag } from '@/components/shared/Flag'
import { Avatar } from '@/components/shared/Avatar'
import { useIsDesktop } from '@/hooks/useBreakpoint'
import { useAuthStore } from '@/stores/auth.store'
import { usePredictionStore } from '@/stores/prediction.store'
import { useBracketStore } from '@/stores/bracket.store'
import { useChatStore } from '@/stores/chat.store'
import { useBoletimStore } from '@/stores/boletim.store'
import { BoletimCard, CreateModal, BoletimViewModal } from '@/screens/Boletim'
import { WC2026_MATCHES, WC2026_GROUPS } from '@/data/wc2026'
import { TEAMS } from '@/data/teams'
import { fmtPts, cn, clamp } from '@/lib/utils'
import { fetchRanking, subscribeRankingUpdates } from '@/lib/ranking'
import { fetchFeaturedVideos } from '@/lib/scorebat'
import type { ScorebatVideo } from '@/lib/scorebat'
import { formatMatchDate, formatMatchTime } from '@/lib/matchTime'
import { isBetOpen } from '@/lib/markets'
import { isPlaceholderMatch } from '@/lib/matchGuards'
import { selectUpcomingMatches } from '@/lib/upcomingMatches'
import { getKnockoutScoreWinner, matchCodeToSlotId } from '@/lib/bracket2026'
import { useMatchesWithStatus } from '@/hooks/useMatchWithStatus'
import { useTabResync } from '@/hooks/useTabResync'
import { fetchWC26News, getCachedWC26News, isConfigured as newsConfigured } from '@/lib/footballnews'
import type { FootballNewsItem } from '@/lib/footballnews'
import type { RankingEntry, Match, Boletim, MatchStage } from '@/types'

// ─── All 48 teams as hero themes ─────────────────────────────────────────────

const ALL_TEAM_CODES = Object.keys(TEAMS)

const HERO_THEMES = ALL_TEAM_CODES.map(code => {
  const t = TEAMS[code]
  const c = t.color ?? '#1a1a1a'
  return {
    code,
    label: t.name.toUpperCase(),
    accent: c,
    stripeA: c,
    stripeB: '#FFCB05',
    stripeC: '#0D0D0D',
  }
}).filter(t => t.label)

function heroFontSize(label: string, desktop = false): string {
  const n = label.length
  if (desktop) {
    if (n <= 3) return 'clamp(90px, 11vw, 136px)'
    if (n <= 5) return 'clamp(76px, 9.5vw, 116px)'
    if (n <= 8) return 'clamp(60px, 7.5vw, 96px)'
    if (n <= 12) return 'clamp(44px, 5.5vw, 72px)'
    return 'clamp(32px, 4vw, 56px)'
  }
  if (n <= 3) return 'clamp(64px, 17vw, 96px)'
  if (n <= 5) return 'clamp(54px, 14vw, 80px)'
  if (n <= 8) return 'clamp(44px, 11vw, 64px)'
  if (n <= 12) return 'clamp(34px, 8.5vw, 50px)'
  return 'clamp(26px, 6.5vw, 40px)'
}

// ─── Video highlights ─────────────────────────────────────────────────────────

function extractIframeSrc(embed: string): string {
  return embed.match(/src='([^']+)'/)?.[1] ?? embed.match(/src="([^"]+)"/)?.[1] ?? ''
}

function compLabel(competition: string): string {
  const parts = competition.split(':')
  return (parts[1] ?? parts[0]).trim().toUpperCase()
}

function VideoCard({ video, isActive, onClick }: { video: ScorebatVideo; isActive: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'relative w-full overflow-hidden group text-left border-2 transition-all duration-200',
        isActive ? 'border-yellow' : 'border-transparent hover:border-ink/30'
      )}
    >
      <div className="relative overflow-hidden" style={{ paddingBottom: '56.25%' }}>
        <img src={video.thumbnail} alt={video.title}
          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/20 to-transparent" />
        <div className="absolute top-2 left-2">
          <span className="font-mono text-[7px] font-bold tracking-eyebrow bg-yellow text-ink px-1.5 py-0.5 leading-none">
            {compLabel(video.competition)}
          </span>
        </div>
        <div className={cn('absolute inset-0 flex items-center justify-center transition-opacity', isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100')}>
          <div className={cn('w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all', isActive ? 'bg-yellow border-yellow text-ink scale-110' : 'bg-paper/20 border-paper/60 text-paper backdrop-blur-sm')}>
            <span className="text-[14px] ml-0.5">{isActive ? '■' : '▶'}</span>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-2.5">
          <p className="font-mono text-[10px] font-bold text-paper leading-tight line-clamp-2">{video.title}</p>
        </div>
      </div>
    </button>
  )
}

function VideoHighlights() {
  const [videos, setVideos] = useState<ScorebatVideo[]>([])
  const [active, setActive] = useState<ScorebatVideo | null>(null)

  useEffect(() => { fetchFeaturedVideos().then(v => setVideos(v.slice(0, 11))) }, [])
  if (videos.length === 0) return null

  const [featured, ...rest] = videos
  const iframeSrc = active ? extractIframeSrc(active.embed) : ''
  const toggle = (v: ScorebatVideo) => setActive(prev => prev?.matchviewUrl === v.matchviewUrl ? null : v)

  return (
    <div className="ui-panel overflow-hidden">
      <div className="ui-panel-header flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <span className="font-display text-lg text-paper">DESTAQUES</span>
          <span className="font-mono text-[10px] text-paper/40">futebol ao redor do mundo</span>
        </div>
        <a href="https://www.scorebat.com" target="_blank" rel="noopener noreferrer"
          className="font-mono text-[7px] text-paper/30 tracking-eyebrow hover:text-paper/60 transition-colors">
          SCOREBAT ↗
        </a>
      </div>
      <AnimatePresence>
        {active && iframeSrc && (
          <motion.div key={active.matchviewUrl}
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }} className="overflow-hidden border-b-2 border-yellow">
            <div className="relative bg-ink" style={{ paddingBottom: '56.25%' }}>
              <iframe src={iframeSrc} className="absolute inset-0 w-full h-full"
                frameBorder="0" allowFullScreen allow="autoplay; fullscreen" />
            </div>
            <div className="px-4 py-2.5 bg-ink flex items-center justify-between">
              <div>
                <div className="font-display text-base text-paper leading-tight">{active.title}</div>
                <div className="font-mono text-[9px] text-paper/40 tracking-eyebrow mt-0.5">{compLabel(active.competition)}</div>
              </div>
              <button onClick={() => setActive(null)}
                className="w-8 h-8 rounded-full border border-paper/20 flex items-center justify-center text-paper/50 hover:text-paper hover:border-paper/60 transition-colors font-mono text-[11px]">
                ✕
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {featured && <div className="border-b border-hairline"><VideoCard video={featured} isActive={active?.matchviewUrl === featured.matchviewUrl} onClick={() => toggle(featured)} /></div>}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {rest.map((v, i) => (
          <div key={v.matchviewUrl} className={cn('border-hairline', i % 2 === 0 ? 'border-r' : '', Math.floor(i / 2) < Math.floor((rest.length - 1) / 2) ? 'border-b' : '')}>
            <VideoCard video={v} isActive={active?.matchviewUrl === v.matchviewUrl} onClick={() => toggle(v)} />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Copa 2026 news ───────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const h = Math.floor(diff / 3_600_000)
  if (h < 1) return 'agora'
  if (h < 24) return `${h}h atrás`
  return `${Math.floor(h / 24)}d atrás`
}

const NEWS_SLIDE_MS = 9000
const NEWS_REFRESH_MS = 5 * 60 * 1000

function CarouselIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 7h11a4 4 0 0 1 0 8H8" />
      <path d="m11 4 4 3-4 3" />
      <path d="m8 12-4 3 4 3" />
    </svg>
  )
}

function NewsProgressBar({
  isActive,
  className,
}: {
  isActive: boolean
  className?: string
}) {
  return (
    <span className={cn('relative block overflow-hidden bg-hairline', className)}>
      <span className="absolute inset-0 bg-ink/20" />
      {isActive && (
        <span
          className="absolute inset-y-0 left-0 w-0 bg-yellow animate-news-progress"
          style={{ animationDuration: `${NEWS_SLIDE_MS}ms` }}
        />
      )}
    </span>
  )
}

function WC26News({
  compact = false,
  className,
}: {
  compact?: boolean
  className?: string
}) {
  const limit = compact ? 5 : 6
  const initialNews = getCachedWC26News(limit)
  const [news, setNews] = useState<FootballNewsItem[]>(initialNews)
  const [loading, setLoading] = useState(initialNews.length === 0)
  const [activeIndex, setActiveIndex] = useState(0)
  const [brokenImageUrls, setBrokenImageUrls] = useState<Record<string, boolean>>({})

  useEffect(() => {
    let cancelled = false
    if (!newsConfigured()) {
      setLoading(false)
      return
    }

    const refresh = () => {
      fetchWC26News(limit).then(items => {
        if (cancelled) return
        if (items.length > 0) {
          setNews(items)
          setActiveIndex(index => Math.min(index, items.length - 1))
        }
        setLoading(false)
      }).catch(() => {
        if (!cancelled) setLoading(false)
      })
    }

    refresh()
    const id = window.setInterval(refresh, NEWS_REFRESH_MS)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [limit])

  useEffect(() => {
    if (loading || news.length <= 1) return undefined
    const id = window.setInterval(() => {
      setActiveIndex(index => (index + 1) % news.length)
    }, NEWS_SLIDE_MS)
    return () => window.clearInterval(id)
  }, [loading, news.length])

  if (!newsConfigured()) return null

  const featured = news[activeIndex] ?? news[0]
  const displayItems = news.slice(0, limit)
  const featuredPosition = featured ? Math.max(0, displayItems.findIndex(item => item.url === featured.url)) : 0
  const featuredHasImage = Boolean(featured?.image) && !brokenImageUrls[featured.url]
  const showLoading = loading && news.length === 0
  const showEmpty = !showLoading && !featured

  return (
    <div data-testid="wc26-news" className={cn('ui-panel overflow-hidden flex flex-col', className)}>
      <div className="ui-panel-header flex items-baseline justify-between">
        <div className="flex items-baseline gap-1.5">
          <span className="font-display text-base">COPA 2026</span>
          <span className="font-mono text-[10px] text-inverse-text/50">radar da copa</span>
        </div>
        <div className="flex items-center gap-2 font-mono text-[8px] text-inverse-text/45 tracking-eyebrow">
          <motion.span
            key={`header-${activeIndex}`}
            initial={{ rotate: -90, opacity: 0.35 }}
            animate={{ rotate: 0, opacity: 1 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="inline-flex"
          >
            <CarouselIcon className="h-3.5 w-3.5" />
          </motion.span>
          <span>{showLoading ? 'buscando' : `${displayItems.length} noticias`}</span>
        </div>
      </div>
      {showLoading ? (
        <div className="flex min-h-[360px] items-center justify-center py-12">
          <span className="font-mono text-[10px] text-ink-4 animate-pulse tracking-eyebrow">CARREGANDO…</span>
        </div>
      ) : showEmpty ? (
        <div className="flex min-h-[360px] items-center justify-center px-4 py-12 text-center">
          <div>
            <CarouselIcon className="mx-auto mb-3 h-5 w-5 text-ink-4" />
            <p className="font-mono text-[10px] tracking-eyebrow text-ink-4">RADAR AGUARDANDO NOVAS NOTICIAS</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col">
          <AnimatePresence mode="wait">
          {featured && (
            <motion.article
              key={featured.url}
              initial={{ opacity: 0, x: 22, filter: 'blur(6px)' }}
              animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, x: -22, filter: 'blur(6px)' }}
              transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
              className="relative flex-1 block min-h-[380px] overflow-hidden border-b border-hairline bg-ink text-paper group"
            >
              {featuredHasImage && (
                <div className="absolute inset-0 overflow-hidden bg-ink">
                  <motion.img
                    src={featured.image!}
                    alt={featured.title}
                    initial={{ scale: 1.09 }}
                    animate={{ scale: 1.01 }}
                    transition={{ duration: NEWS_SLIDE_MS / 1000, ease: 'linear' }}
                    className="h-full w-full object-cover"
                    onError={() => setBrokenImageUrls(urls => ({ ...urls, [featured.url]: true }))}
                  />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/78 to-black/20" />
              <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/65 to-transparent" />
              <div className="absolute right-4 top-4 z-10 border border-inverse-text/30 bg-black/35 px-2.5 py-1 font-mono text-[8px] font-bold tracking-eyebrow text-inverse-text/70 backdrop-blur-sm">
                {String(featuredPosition + 1).padStart(2, '0')} / {String(displayItems.length).padStart(2, '0')}
              </div>
              <div className="relative z-10 flex h-full min-h-[380px] flex-col justify-end p-5">
                <motion.div
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.08, duration: 0.22 }}
                  className="mb-2 flex items-center gap-2 font-mono text-[8px] tracking-eyebrow text-yellow"
                >
                  <span className="font-display text-inverse-text/45">FOCO</span>
                  <span>{featured.source}</span>
                  <span className="text-inverse-text/45">·</span>
                  <span className="text-inverse-text/65">{timeAgo(featured.publishedAt)}</span>
                </motion.div>
                <motion.h3
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.12, duration: 0.26 }}
                  className={cn(
                  'font-display leading-[1.02] text-paper break-words transition-colors group-hover:text-yellow',
                  featuredHasImage ? (compact ? 'text-3xl' : 'text-5xl') : (compact ? 'text-3xl' : 'text-5xl'),
                )}
                >
                  {featured.title}
                </motion.h3>
                <motion.a
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.18, duration: 0.24 }}
                  href={featured.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-2 border border-inverse-text/40 px-3 py-2 font-mono text-[9px] font-bold tracking-eyebrow text-inverse-text transition-colors hover:border-yellow hover:text-yellow"
                >
                  LER MATERIA <span>→</span>
                </motion.a>
              </div>
            </motion.article>
          )}
          </AnimatePresence>
          <div className="divide-y divide-hairline">
            {displayItems.map((item, index) => {
              const itemIndex = news.findIndex(n => n.url === item.url)
              const isActive = itemIndex === activeIndex
              return (
              <motion.button
                key={item.url}
                data-testid="wc26-news-row"
                type="button"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.04 * index, duration: 0.2 }}
                onClick={() => setActiveIndex(itemIndex)}
                className={cn(
                  'relative flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors group',
                  isActive ? 'bg-yellow/10' : 'hover:bg-surface-hover',
                )}
              >
                <span className={cn('font-display text-base tabular-nums', isActive ? 'text-ink' : 'text-ink-4')}>{index + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-[10px] font-bold text-ink leading-tight line-clamp-2 group-hover:underline">{item.title}</p>
                  <div className="flex items-center gap-1 mt-1">
                    <span className="font-mono text-[7px] text-ink-4">{item.source}</span>
                    <span className="font-mono text-[7px] text-ink-4">·</span>
                    <span className="font-mono text-[7px] text-ink-4">{timeAgo(item.publishedAt)}</span>
                  </div>
                </div>
              </motion.button>
              )
            })}
          </div>
          {news.length > 1 && (
            <div className="flex items-center gap-2 px-3 py-3">
              <motion.span
                key={`footer-${activeIndex}`}
                initial={{ rotate: -90, opacity: 0.35 }}
                animate={{ rotate: 0, opacity: 1 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
                className="inline-flex flex-shrink-0 text-ink-4"
              >
                <CarouselIcon className="h-4 w-4" />
              </motion.span>
              <div className="flex flex-1 gap-1.5">
                {displayItems.map((item, index) => {
                  const itemIndex = news.findIndex(n => n.url === item.url)
                  const isActive = itemIndex === activeIndex
                  return (
                  <button
                    key={item.url}
                    type="button"
                    data-testid="wc26-news-progress"
                    aria-label={`Noticia ${index + 1}`}
                    onClick={() => setActiveIndex(itemIndex)}
                    className="group relative h-2 flex-1 overflow-hidden bg-hairline transition-colors hover:bg-ink-4/40"
                  >
                    <NewsProgressBar isActive={isActive} className="absolute inset-0" />
                    <span className="sr-only">{item.title}</span>
                  </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Rotating Hero ────────────────────────────────────────────────────────────

function calendarDaysUntil(target: Date): number {
  const start = new Date(); start.setHours(0, 0, 0, 0)
  const end = new Date(target); end.setHours(0, 0, 0, 0)
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 86_400_000))
}

function isSameLocalDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

interface HeroSchedule {
  mode: 'pre' | 'live' | 'next' | 'over'
  days: number
  isToday: boolean
  match: Match | null
}

// Estado do herói dirigido pelo status real das partidas: antes do torneio
// conta os dias (HOJE / 1 DIA / N DIAS) até o 1º jogo; durante, mostra o jogo
// ao vivo ou o próximo; no fim, encerrado.
function heroSchedule(matches: Match[]): HeroSchedule {
  const now = Date.now()
  const known = matches.filter(m => !isPlaceholderMatch(m) && Boolean(m.kickoffUtc))
  const sorted = [...known].sort((a, b) => new Date(a.kickoffUtc).getTime() - new Date(b.kickoffUtc).getTime())
  if (sorted.length === 0) return { mode: 'pre', days: 0, isToday: false, match: null }

  const firstKick = new Date(sorted[0].kickoffUtc).getTime()
  if (now < firstKick) {
    const target = new Date(sorted[0].kickoffUtc)
    return { mode: 'pre', days: calendarDaysUntil(target), isToday: isSameLocalDay(new Date(), target), match: sorted[0] }
  }

  const live = sorted.find(m => m.status === 'live')
  if (live) return { mode: 'live', days: 0, isToday: true, match: live }

  const nextUp = sorted.find(m => m.status !== 'finished' && new Date(m.kickoffUtc).getTime() > now)
  if (nextUp) {
    const target = new Date(nextUp.kickoffUtc)
    return { mode: 'next', days: calendarDaysUntil(target), isToday: isSameLocalDay(new Date(), target), match: nextUp }
  }

  if (sorted.every(m => m.status === 'finished')) {
    return { mode: 'over', days: 0, isToday: false, match: sorted[sorted.length - 1] }
  }
  return { mode: 'next', days: 0, isToday: false, match: sorted[sorted.length - 1] }
}

function useRotatingHero() {
  const [idx, setIdx] = useState(() => Math.floor(Math.random() * HERO_THEMES.length))
  useEffect(() => {
    const id = setInterval(() => setIdx(i => (i + 1) % HERO_THEMES.length), 4000)
    return () => clearInterval(id)
  }, [])
  return { idx, setIdx, theme: HERO_THEMES[idx] }
}

// Scrolling team strip — all 48 flags
function TeamStrip() {
  const allCodes = Object.keys(TEAMS)
  const doubled = [...allCodes, ...allCodes]
  return (
    <div className="relative z-10 mt-auto overflow-hidden border-t border-hairline bg-surface/85 backdrop-blur-sm">
      <div
        className="flex gap-5 py-2.5 px-3 animate-marquee"
        style={{ width: 'max-content', animationDuration: '80s' }}
      >
        {doubled.map((code, i) => {
          const team = TEAMS[code]
          return team ? (
            <div key={`${code}-${i}`} className="flex items-center gap-1.5 flex-shrink-0">
              <Flag team={team} size={20} className="opacity-90" />
              <span className="font-mono text-[8px] font-bold text-ink-3 tracking-wide">{code}</span>
            </div>
          ) : null
        })}
      </div>
    </div>
  )
}

function HeroAccentBands({ theme }: { theme: typeof HERO_THEMES[number] }) {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <motion.div
        key={`stripe-a-${theme.code}`}
        initial={{ opacity: 0, x: 28 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 28 }}
        transition={{ duration: 0.45 }}
        className="absolute -right-10 top-0 h-full w-[28%] skew-x-[-13deg]"
        style={{ background: theme.stripeA }}
      />
      <motion.div
        key={`stripe-b-${theme.code}`}
        initial={{ opacity: 0, x: 34 }}
        animate={{ opacity: 0.92, x: 0 }}
        exit={{ opacity: 0, x: 34 }}
        transition={{ duration: 0.52 }}
        className="absolute -right-2 top-0 h-full w-[8%] skew-x-[-13deg]"
        style={{ background: theme.stripeB }}
      />
      <motion.div
        key={`stripe-c-${theme.code}`}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 12 }}
        transition={{ duration: 0.5 }}
        className="absolute bottom-0 left-0 h-2 w-full"
        style={{ background: `linear-gradient(90deg, ${theme.stripeA} 0%, ${theme.stripeA} 42%, ${theme.stripeB} 42%, ${theme.stripeB} 68%, ${theme.stripeC} 68%, ${theme.stripeC} 100%)` }}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-card via-card/95 to-card/70" />
      <div className="absolute inset-0 opacity-[0.07]"
        style={{ backgroundImage: 'repeating-linear-gradient(45deg,rgb(var(--color-ink)) 0,rgb(var(--color-ink)) 1px,transparent 0,transparent 48%)', backgroundSize: '8px 8px' }} />
    </div>
  )
}

function HeroMatchLine({ match, large = false, showScore = false }: { match: Match; large?: boolean; showScore?: boolean }) {
  const codeCls = large ? 'text-2xl' : 'text-xl'
  const flagSize = large ? 22 : 18
  return (
    <div className="flex items-center gap-1.5">
      <Flag team={match.home} size={flagSize} />
      <span className={`font-display leading-none text-ink ${codeCls}`}>{match.home.code}</span>
      <span className="px-0.5 font-mono text-[10px] font-bold text-ink-3">
        {showScore ? `${match.homeScore ?? 0}–${match.awayScore ?? 0}` : '×'}
      </span>
      <span className={`font-display leading-none text-ink ${codeCls}`}>{match.away.code}</span>
      <Flag team={match.away} size={flagSize} />
    </div>
  )
}

function HeroInfo({ schedule, large = false }: { schedule: HeroSchedule; large?: boolean }) {
  const m = schedule.match
  const numCls = large ? 'text-[72px]' : 'text-[52px]'
  const wordCls = large ? 'text-[40px]' : 'text-[30px]'

  if (schedule.mode === 'live' && m) {
    return (
      <div>
        <div className="mb-1 inline-flex items-center gap-1.5 font-mono text-[8px] font-bold tracking-eyebrow text-red">
          <span className="h-1.5 w-1.5 rounded-full bg-red animate-pulse-live" /> AO VIVO
        </div>
        <HeroMatchLine match={m} large={large} showScore />
        <div className="mt-0.5 font-mono text-[7px] text-ink-4">{m.stageLabel}</div>
      </div>
    )
  }

  if (schedule.mode === 'next' && m) {
    return (
      <div>
        <div className="mb-1 font-mono text-[8px] font-bold tracking-eyebrow text-green-deep dark:text-yellow">
          PRÓXIMO JOGO{schedule.isToday ? ' · HOJE' : ''}
        </div>
        <HeroMatchLine match={m} large={large} />
        <div className="mt-1 font-mono text-[7px] text-ink-4">{formatMatchDate(m)} · {formatMatchTime(m)} · Brasília</div>
      </div>
    )
  }

  if (schedule.mode === 'over') {
    return (
      <div className="flex items-baseline gap-2">
        <span className={`font-display ${wordCls} leading-none text-ink`}>FIM</span>
        <span className="font-mono text-[8px] tracking-eyebrow text-ink-3">Copa encerrada · 🏆</span>
      </div>
    )
  }

  // Pré-torneio
  if (schedule.isToday) {
    return (
      <div>
        <div className="flex items-baseline gap-2">
          <span className={`font-display ${wordCls} leading-none text-ink`}>HOJE!</span>
          <span className="font-mono text-[8px] font-bold tracking-eyebrow text-green-deep dark:text-yellow">A BOLA ROLA HOJE</span>
        </div>
        {m && (
          <div className="mt-1.5">
            <HeroMatchLine match={m} large={large} />
            <div className="mt-1 font-mono text-[7px] text-ink-4">{formatMatchTime(m)} · Horário de Brasília</div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex items-baseline gap-2">
      <span className={`font-display ${numCls} leading-none text-ink`}>{schedule.days}</span>
      <div>
        <div className="font-mono text-[8px] tracking-eyebrow text-ink-3">{schedule.days === 1 ? 'DIA' : 'DIAS'}</div>
        <div className="font-mono text-[8px] font-bold text-ink-2">para a bola rolar</div>
        {m && <div className="font-mono text-[7px] text-ink-4">{formatMatchDate(m)} · {formatMatchTime(m)}</div>}
      </div>
    </div>
  )
}

function RotatingHeroMobile({ schedule, onCta }: { schedule: HeroSchedule; onCta: () => void }) {
  const { idx, setIdx, theme } = useRotatingHero()
  const team = TEAMS[theme.code]

  return (
    <section className="ui-card relative overflow-hidden flex flex-col bg-card text-ink" style={{ height: 300 }}>
      <AnimatePresence mode="wait">
        <HeroAccentBands key={`bands-${idx}`} theme={theme} />
      </AnimatePresence>

      {/* Top row */}
      <div className="relative z-10 flex items-center justify-between gap-3 px-5 pt-4">
        <span className="min-w-0 font-mono text-[8px] tracking-eyebrow text-ink-3">COPA DO MUNDO 2026 · USA / CAN / MEX</span>
        <AnimatePresence mode="wait">
          {team && (
            <motion.div key={`badge-${idx}`} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }} className="flex flex-shrink-0 items-center gap-1.5 border border-line-strong bg-surface-2 px-2.5 py-1 shadow-sm">
              <Flag team={team} size={13} />
              <span className="max-w-[96px] truncate font-mono text-[8px] font-bold tracking-eyebrow text-ink">{theme.label}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Team name */}
      <div className="relative z-10 flex flex-1 items-center px-5 pr-[26%]">
        <AnimatePresence mode="wait">
          <motion.span key={`name-${idx}`} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }}
            transition={{ duration: 0.35 }}
            className="font-display leading-none tracking-display select-none text-ink"
            style={{ fontSize: heroFontSize(theme.label) }}>
            {theme.label}
          </motion.span>
        </AnimatePresence>
      </div>

      {/* Countdown + CTA + dots */}
      <div className="relative z-10 px-5 pb-3">
        <div className="flex items-end justify-between">
          <HeroInfo schedule={schedule} />
          <div className="flex flex-col items-end gap-2 pb-0.5">
            <button onClick={onCta} className="btn-yellow text-[10px] px-3 py-1.5 active:scale-95 transition-transform">
              PALPITAR →
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: 8 }, (_, i) => {
                const themeIdx = idx % 8
                return (
                  <button key={i} onClick={() => setIdx(Math.floor(idx / 8) * 8 + i)}
                    className={cn('h-[3px] rounded-full transition-all duration-300', i === themeIdx ? 'w-4 bg-ink' : 'w-[3px] bg-ink/30')} />
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Team strip */}
      <TeamStrip />
    </section>
  )
}

function RotatingHeroDesktop({ schedule, onCta }: { schedule: HeroSchedule; onCta: () => void }) {
  const { idx, setIdx, theme } = useRotatingHero()
  const team = TEAMS[theme.code]

  return (
    <div className="ui-card relative overflow-hidden flex flex-col bg-card text-ink" style={{ minHeight: 360 }}>
      <AnimatePresence mode="wait">
        <HeroAccentBands key={`d-bands-${idx}`} theme={theme} />
      </AnimatePresence>

      <div className="relative z-10 flex items-center justify-between gap-4 px-6 pt-5">
        <span className="font-mono text-[9px] tracking-eyebrow text-ink-3">COPA DO MUNDO 2026 · USA / CAN / MEX</span>
        <AnimatePresence mode="wait">
          {team && (
            <motion.div key={`d-badge-${idx}`} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }} className="flex items-center gap-2 border border-line-strong bg-surface-2 px-3 py-1.5 shadow-sm">
              <Flag team={team} size={16} />
              <span className="max-w-[160px] truncate font-mono text-[9px] font-bold tracking-eyebrow text-ink">{theme.label}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="relative z-10 flex flex-1 items-center px-6 pr-[28%]">
        <AnimatePresence mode="wait">
          <motion.span key={`d-name-${idx}`} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.4 }}
            className="font-display leading-none tracking-display select-none text-ink"
            style={{ fontSize: heroFontSize(theme.label, true) }}>
            {theme.label}
          </motion.span>
        </AnimatePresence>
      </div>

      <div className="relative z-10 px-6 pb-4">
        <div className="flex items-end justify-between mb-3">
          <HeroInfo schedule={schedule} large />
          <div className="flex flex-col items-end gap-2.5">
            <button onClick={onCta} className="btn-yellow active:scale-95 transition-transform">FAZER PALPITES AGORA →</button>
            <div className="flex items-center gap-1.5">
              {Array.from({ length: 8 }, (_, i) => {
                const themeIdx = idx % 8
                return (
                  <button key={i} onClick={() => setIdx(Math.floor(idx / 8) * 8 + i)}
                    className={cn('h-[3px] rounded-full transition-all duration-300', i === themeIdx ? 'w-5 bg-ink' : 'w-[3px] bg-ink/30')} />
                )
              })}
            </div>
          </div>
        </div>
      </div>
      <TeamStrip />
    </div>
  )
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function PredProgress({ done, total, label, color = 'bg-green' }: { done: number; total: number; label: string; color?: string }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="font-mono text-[10px] text-ink-3 tracking-eyebrow">{label}</span>
        <span className="font-mono text-[10px] font-bold text-ink">{done}/{total}</span>
      </div>
      <div className="h-1 bg-hairline overflow-hidden">
        <div className={`h-full ${color} transition-all duration-700`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

// ─── Fase ativa do torneio (progresso automático) ────────────────────────────
// O card de progresso segue sozinho a fase atual: começa em FASE DE GRUPOS e,
// conforme cada fase abre (mercado aberto / times definidos), avança até a FINAL.

const PHASE_SEQUENCE: { stage: MatchStage; label: string }[] = [
  { stage: 'group',         label: 'FASE DE GRUPOS' },
  { stage: 'round_of_32',   label: 'FASE DE 32' },
  { stage: 'round_of_16',   label: 'OITAVAS' },
  { stage: 'quarter_final', label: 'QUARTAS' },
  { stage: 'semi_final',    label: 'SEMIFINAIS' },
  { stage: 'third_place',   label: 'DISPUTA DE 3º' },
  { stage: 'final',         label: 'FINAL' },
]

function activePhaseProgress(matches: Match[], predictions: Record<string, unknown>) {
  const phases = PHASE_SEQUENCE.map(p => {
    const stageMatches = matches.filter(m => m.stage === p.stage)
    const predictable = stageMatches.filter(m => !isPlaceholderMatch(m))
    return {
      label: p.label,
      total: predictable.length,
      done: predictable.filter(m => predictions[m.id] != null).length,
      hasOpen: stageMatches.some(m => isBetOpen(m)),
      hasPredictable: predictable.length > 0,
    }
  })
  // Fase ativa = a mais avançada com aposta aberta; se nenhuma estiver aberta
  // (entre fases ou torneio encerrado), a mais avançada já alcançada.
  const reversed = [...phases].reverse()
  const active = reversed.find(p => p.hasOpen) ?? reversed.find(p => p.hasPredictable) ?? phases[0]
  return { label: active.label, done: active.done, total: active.total }
}

// ─── Groups grid ─────────────────────────────────────────────────────────────

function GroupsGrid({ predictions }: { predictions: Record<string, unknown> }) {
  const navigate = useNavigate()
  return (
    <div className="ui-panel">
      <div className="ui-panel-header flex items-baseline justify-between">
        <span className="font-display text-lg">GRUPOS</span>
        <span className="font-mono text-[9px] text-paper/40">48 SELEÇÕES · 12 GRUPOS</span>
      </div>
      <div className="grid grid-cols-3 md:grid-cols-4 divide-x divide-y divide-hairline">
        {WC2026_GROUPS.slice(0, 12).map(g => {
          const groupMatches = WC2026_MATCHES.filter(m => m.group === g.id)
          const done = groupMatches.filter(m => predictions[m.id]).length
          return (
            <button
              key={g.id}
              onClick={() => navigate('/prediction')}
              className="p-3 text-left hover:bg-surface-hover transition-colors group"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-display text-lg">GRUPO {g.id}</span>
                {done > 0 && (
                  <span className="font-mono text-[8px] text-green">{done}/{groupMatches.length}</span>
                )}
              </div>
              <div className="flex gap-1 flex-wrap">
                {g.teams.slice(0, 4).map(code => {
                  const team = TEAMS[code]
                  return team ? <Flag key={code} team={team} size={16} className="opacity-90" /> : null
                })}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Shared data hook ─────────────────────────────────────────────────────────

function useHomeData() {
  const me = useAuthStore(s => s.user)
  const matches = useMatchesWithStatus(WC2026_MATCHES)
  const [ranking, setRanking] = useState<RankingEntry[]>([])

  const loadRanking = useCallback(() => {
    fetchRanking(me?.id)
      .then(result => setRanking(result))
      .catch(() => setRanking([]))
  }, [me?.id])

  useEffect(() => {
    loadRanking()
    let timer: number | undefined
    const unsubscribe = subscribeRankingUpdates(() => {
      window.clearTimeout(timer)
      timer = window.setTimeout(loadRanking, 250)
    })

    return () => {
      window.clearTimeout(timer)
      unsubscribe()
    }
  }, [loadRanking])

  // Aba voltou ao foco → recarrega o ranking (pega apuracoes perdidas em 2o plano).
  useTabResync(loadRanking)

  const upcoming = selectUpcomingMatches(matches)

  return { ranking, upcoming, matches }
}

// ─── Resenha card ─────────────────────────────────────────────────────────────

function msgPreview(msg: { type?: string; text?: string; gifUrl?: string; imageUrl?: string; audioUrl?: string; poll?: { question?: string } }): string {
  if (msg.type === 'gif')   return '[GIF]'
  if (msg.type === 'image') return 'enviou uma foto'
  if (msg.type === 'audio') return 'enviou um áudio'
  if (msg.type === 'poll')  return msg.poll?.question ?? 'enquete'
  return msg.text ?? ''
}

function ResenhaCard() {
  const navigate = useNavigate()
  const messages = useChatStore(s => s.messages)
  const isLoaded = useChatStore(s => s.isLoaded)
  const recent   = messages.slice(-4)

  // Pega na hora as mensagens mais novas ao abrir a Home (não espera o realtime),
  // pra não mostrar um remetente desatualizado no #RESENHA.
  useEffect(() => { void useChatStore.getState().pollNewMessages() }, [])

  return (
    <div className="ui-panel flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b border-hairline flex items-baseline justify-between">
        <div className="flex items-baseline gap-1.5">
          <span className="font-display text-lg">#RESENHA</span>
          <div className="flex items-center gap-1 ml-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green animate-pulse-live" />
            <span className="font-mono text-[9px] text-ink-4">ao vivo</span>
          </div>
        </div>
        <button onClick={() => navigate('/resenha')} className="font-mono text-[10px] text-ink-4 hover:text-ink">ENTRAR →</button>
      </div>
      {!isLoaded ? (
        <div className="flex flex-col divide-y divide-hairline">
          {[60, 80, 50].map(w => (
            <div key={w} className="px-4 py-3 flex gap-2.5 items-center">
              <div className="w-6 h-6 rounded-full bg-hairline flex-shrink-0" />
              <div className="h-3 rounded bg-hairline" style={{ width: `${w}%` }} />
            </div>
          ))}
        </div>
      ) : recent.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-3">
          <span className="font-display text-3xl text-ink-4">○</span>
          <p className="font-mono text-[11px] text-ink-3 leading-relaxed">Nenhuma mensagem ainda.</p>
          <button onClick={() => navigate('/resenha')} className="font-mono text-[10px] text-ink-3 hover:text-ink underline">Seja o primeiro →</button>
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-hairline">
          {recent.map(msg => (
            <div key={msg.id} className="px-4 py-2.5 flex gap-2.5 items-start">
              <Avatar initials={msg.initials} color={msg.color} src={msg.avatarUrl} size={24} />
              <div className="flex-1 min-w-0">
                <span className="font-mono text-[10px] font-bold text-ink leading-none">{msg.who}</span>
                <p className="font-sans text-[12px] text-ink-2 leading-snug truncate mt-0.5">{msgPreview(msg)}</p>
              </div>
            </div>
          ))}
          <button onClick={() => navigate('/resenha')}
            className="px-4 py-2.5 font-mono text-[10px] text-ink-4 hover:text-ink hover:bg-surface-hover text-left transition-colors">
            VER TUDO →
          </button>
        </div>
      )}
    </div>
  )
}

function HomeBoletimSection({ compact = false, className }: { compact?: boolean; className?: string }) {
  const { bulletins, isLoaded, init, resync, destroy, addBoletim, updateBoletim, togglePin, deleteBoletim } = useBoletimStore()
  const { user } = useAuthStore()
  const canEdit = (user?.isAdmin || user?.isMarketing) ?? false
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Boletim | null>(null)
  const [viewing, setViewing] = useState<Boletim | null>(null)

  useEffect(() => {
    init()
    return () => { destroy() }
  }, [init, destroy])

  useTabResync(resync)

  const sorted = [...bulletins].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1
    if (!a.isPinned && b.isPinned) return 1
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })
  const featured = sorted[0]
  const rest = sorted.slice(1, compact ? 3 : 5)

  return (
    <section className={cn('border-2 border-line bg-paper-white', className)}>
      <div className="px-4 py-3 md:px-5 md:py-4 border-b border-hairline flex items-center justify-between gap-3 bg-inverse text-inverse-text">
        <div>
          <div className="font-display text-xl md:text-2xl leading-none">BOLETIM DA FIRMA</div>
          <div className="font-mono text-[9px] md:text-[10px] text-inverse-text/55 tracking-eyebrow mt-1">
            comunicados oficiais do marketing
          </div>
        </div>
        {canEdit && (
          <button
            onClick={() => setCreating(true)}
            className="bg-yellow text-[#0D0D0D] border-2 border-yellow px-3 py-2 md:px-4 font-mono text-[9px] md:text-[10px] font-bold tracking-eyebrow shadow-btn"
          >
            + PUBLICAR
          </button>
        )}
      </div>

      {!isLoaded ? (
        <div className="p-5 space-y-3">
          <div className="h-7 w-2/5 bg-hairline animate-pulse" />
          <div className="h-36 w-full bg-hairline animate-pulse" />
        </div>
      ) : bulletins.length === 0 ? (
        <div className="px-5 py-12 text-center">
          <div className="font-display text-3xl text-ink-3">SEM BOLETINS</div>
          <p className="font-mono text-[11px] text-ink-3 mt-2">
            Quando o marketing publicar, o destaque aparece direto aqui na Home.
          </p>
        </div>
      ) : (
        <div className="p-3 md:p-5 space-y-3">
          {featured && (
            <BoletimCard
              b={featured}
              canEdit={canEdit}
              onDelete={deleteBoletim}
              onEdit={setEditing}
              onTogglePin={togglePin}
              onOpen={setViewing}
              featured
              compactHome
            />
          )}
          {rest.length > 0 && (
            <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-2">
              {rest.map(b => (
                <BoletimCard
                  key={b.id}
                  b={b}
                  canEdit={canEdit}
                  onDelete={deleteBoletim}
                  onEdit={setEditing}
                  onTogglePin={togglePin}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <AnimatePresence>
        {viewing && (
          <BoletimViewModal b={viewing} onClose={() => setViewing(null)} />
        )}
        {creating && (
          <CreateModal
            onClose={() => setCreating(false)}
            onCreate={async b => {
              await addBoletim(b)
              setCreating(false)
            }}
          />
        )}
        {editing && (
          <CreateModal
            initialBoletim={editing}
            onClose={() => setEditing(null)}
            onCreate={async b => {
              await addBoletim(b)
              setEditing(null)
            }}
            onUpdate={async (id, b) => {
              await updateBoletim(id, b)
              setEditing(null)
            }}
          />
        )}
      </AnimatePresence>
    </section>
  )
}

function HomeBoletimNewsSection({ compact = false }: { compact?: boolean }) {
  return (
    <div className={cn(
      'grid items-stretch gap-4',
      compact
        ? 'grid-cols-1'
        : 'grid-cols-1 xl:grid-cols-[minmax(0,1.6fr)_minmax(340px,0.75fr)]',
    )}>
      <HomeBoletimSection compact={compact} />
      <WC26News compact className="h-full" />
    </div>
  )
}

export function HomeScreen() {
  const isDesktop = useIsDesktop()
  return isDesktop ? <HomeDesktop /> : <HomeMobile />
}

// ─── Quick-pick modal ─────────────────────────────────────────────────────────

function QuickPickModal({ match, onClose }: { match: Match; onClose: () => void }) {
  const { predictions, drafts, setDraft, clearDraft, confirmPrediction } = usePredictionStore()
  const userId = useAuthStore(s => s.user?.id ?? 'me')
  const isDesktop = useIsDesktop()
  const existing = predictions[match.id]
  const draft = drafts[match.id]
  const isKnockout = match.stage !== 'group'
  const slotId = isKnockout ? matchCodeToSlotId(match.id) : null
  const advancerPick = useBracketStore(s => (slotId ? s.picks[slotId] : undefined))
  const setBracketPick = useBracketStore(s => s.setPick)

  const [home, setHome] = useState(draft?.home ?? existing?.homeScore ?? 0)
  const [away, setAway] = useState(draft?.away ?? existing?.awayScore ?? 0)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const hasPick = !!existing

  const updateHome = (v: number) => { setSaveError(null); setHome(v); setDraft(match.id, v, away) }
  const updateAway = (v: number) => { setSaveError(null); setAway(v); setDraft(match.id, home, v) }
  const scoreWinner = getKnockoutScoreWinner(match, home, away)

  const handleConfirm = async () => {
    setSaveError(null)
    if (isKnockout && slotId) {
      const advancerCode = scoreWinner ? scoreWinner.code : advancerPick
      if (!advancerCode) {
        setSaveError('Empate no palpite: escolha quem passa nos pênaltis.')
        return
      }
      if (advancerPick !== advancerCode) setBracketPick(slotId, advancerCode)
    }
    setSaving(true)
    const result = await confirmPrediction({
      id: `pred-${match.id}`,
      userId,
      matchId: match.id,
      homeScore: home,
      awayScore: away,
      submittedAt: new Date().toISOString(),
    })
    setSaving(false)
    if (!result.ok) { setSaveError(result.error ?? 'Erro ao salvar.'); return }
    clearDraft(match.id)
    setDone(true)
    setTimeout(onClose, 700)
  }

  return (
    <div
      className={cn('fixed inset-0 z-[60] flex justify-center', isDesktop ? 'items-center p-4' : 'items-end px-3 pt-3')}
      style={isDesktop ? undefined : { paddingBottom: 'calc(3.5rem + env(safe-area-inset-bottom, 0px) + 0.75rem)' }}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-[1px]" onClick={onClose} />
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 380 }}
        className="relative max-h-[calc(100dvh-5rem)] w-full max-w-sm overflow-y-auto ui-card shadow-none"
      >
        <button onClick={onClose}
          className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center font-mono text-[11px] text-ink-3 hover:text-ink border border-hairline hover:border-ink transition-colors z-10">
          ✕
        </button>

        <div className="px-5 pt-5 pb-4 border-b border-hairline">
          {done ? (
            <div className="inline-flex items-center gap-1.5 font-mono text-[8px] font-bold tracking-eyebrow text-green mb-3">✓ PALPITE SALVO!</div>
          ) : hasPick ? (
            <div className="inline-flex items-center gap-1.5 font-mono text-[8px] font-bold tracking-eyebrow text-green mb-3">✓ PALPITE FEITO · TOQUE PARA ATUALIZAR</div>
          ) : (
            <div className="inline-flex items-center gap-1.5 font-mono text-[8px] font-bold tracking-eyebrow bg-yellow text-ink px-2 py-1 mb-3">PALPITE PENDENTE</div>
          )}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Flag team={match.home} size={28} />
              <span className="font-mono text-[12px] font-bold">{match.home.code}</span>
            </div>
            <div className="text-center flex-shrink-0">
              <div className="font-mono text-[8px] text-ink-4">{formatMatchDate(match)}</div>
              <div className="font-display text-lg leading-none">{formatMatchTime(match)}</div>
              <div className="font-mono text-[7px] text-ink-4 mt-0.5">{match.stage === 'group' ? `GRUPO ${match.group}` : (match.stageLabel ?? 'MATA-MATA')}</div>
            </div>
            <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
              <span className="font-mono text-[12px] font-bold">{match.away.code}</span>
              <Flag team={match.away} size={28} />
            </div>
          </div>
        </div>

        <div className="px-5 py-4">
          <p className="font-mono text-[9px] tracking-eyebrow text-ink-3 text-center mb-4">QUAL VAI SER O PLACAR?</p>
          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-col items-center gap-2 flex-1">
              <Flag team={match.home} size={32} />
              <span className="font-mono text-[8px] font-bold text-center leading-tight">{match.home.name.toUpperCase()}</span>
              <div className="flex items-center">
                <button onClick={() => updateHome(clamp(home - 1, 0, 9))} disabled={home === 0}
                  className="w-10 h-10 flex items-center justify-center border-2 border-r-0 border-ink font-mono text-xl hover:bg-yellow disabled:opacity-25 select-none">−</button>
                <div className="w-11 h-10 flex items-center justify-center border-2 border-ink font-display text-2xl select-none">{home}</div>
                <button onClick={() => updateHome(clamp(home + 1, 0, 9))}
                  className="w-10 h-10 flex items-center justify-center border-2 border-l-0 border-ink font-mono text-xl hover:bg-yellow select-none">+</button>
              </div>
            </div>
            <span className="font-serif-it text-2xl text-ink-3 flex-shrink-0">×</span>
            <div className="flex flex-col items-center gap-2 flex-1">
              <Flag team={match.away} size={32} />
              <span className="font-mono text-[8px] font-bold text-center leading-tight">{match.away.name.toUpperCase()}</span>
              <div className="flex items-center">
                <button onClick={() => updateAway(clamp(away - 1, 0, 9))} disabled={away === 0}
                  className="w-10 h-10 flex items-center justify-center border-2 border-r-0 border-ink font-mono text-xl hover:bg-yellow disabled:opacity-25 select-none">−</button>
                <div className="w-11 h-10 flex items-center justify-center border-2 border-ink font-display text-2xl select-none">{away}</div>
                <button onClick={() => updateAway(clamp(away + 1, 0, 9))}
                  className="w-10 h-10 flex items-center justify-center border-2 border-l-0 border-ink font-mono text-xl hover:bg-yellow select-none">+</button>
              </div>
            </div>
          </div>
          {isKnockout && slotId && (
            <div className="mt-4 border-t border-hairline pt-4">
              {scoreWinner ? (
                <div className="text-center">
                  <p className="font-mono text-[9px] font-bold tracking-eyebrow text-ink">QUEM AVANÇA</p>
                  <div className="mt-2 inline-flex items-center gap-2 border-2 border-green bg-green/10 px-3 py-2">
                    <Flag team={scoreWinner} size={20} />
                    <span className="font-mono text-[10px] font-bold text-green">{scoreWinner.code} AVANÇA</span>
                  </div>
                  <p className="mt-2 font-mono text-[8px] text-ink-3">definido pelo placar</p>
                </div>
              ) : (
                <>
                  <p className="text-center font-mono text-[9px] font-bold tracking-eyebrow text-ink">EMPATE — QUEM PASSA NOS PÊNALTIS?</p>
                  <p className="mb-3 text-center font-mono text-[8px] text-ink-3">obrigatório · é o que vale no mata-mata</p>
                  <div className="flex gap-2">
                    {[match.home, match.away].map(team => {
                      const selected = advancerPick === team.code
                      return (
                        <button
                          key={team.code}
                          type="button"
                          onClick={() => { setSaveError(null); setBracketPick(slotId, team.code) }}
                          className={cn(
                            'flex flex-1 items-center justify-center gap-2 border-2 py-2.5 transition-colors',
                            selected ? 'border-green bg-green/10 text-green' : 'border-hairline text-ink-2 hover:border-ink',
                          )}
                        >
                          <Flag team={team} size={20} />
                          <span className="font-mono text-[10px] font-bold">{team.code}</span>
                          {selected && <span className="font-mono text-[10px]">✓</span>}
                        </button>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          )}
          {saveError && (
            <p className="font-mono text-[10px] text-red text-center mt-3 border border-red/30 bg-red/5 px-2 py-1.5">{saveError}</p>
          )}
          <button
            onClick={handleConfirm}
            disabled={saving || done}
            className="btn-yellow w-full text-[11px] py-3 mt-4 tracking-eyebrow font-bold disabled:opacity-50 disabled:cursor-wait"
          >
            {saving ? 'SALVANDO...' : done ? 'SALVO ✓' : hasPick ? 'ATUALIZAR PALPITE ✓' : 'CONFIRMAR PALPITE ✓'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// Frame de entrada pro mata-mata — o card INTEIRO é clicável (no mobile não
// havia um ponto claro pra abrir a chave a não ser palpitando). Card claro no
// estilo do app (tokens que adaptam claro/escuro sozinhos) + sombra amarela no
// hover e seta amarela; sem fundo escuro/ilegível e sem desenho de linhas.
function MinhaChaveCard({ className }: { className?: string }) {
  const navigate = useNavigate()
  return (
    <button
      type="button"
      onClick={() => navigate('/bracket')}
      aria-label="Abrir o chaveamento do mata-mata"
      className={cn(
        'group flex w-full items-center justify-between gap-4 border-2 border-ink bg-card p-5 text-left shadow-card transition-transform active:scale-[0.99] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-card-yellow sm:p-6',
        className,
      )}
    >
      <div className="min-w-0">
        <p className="font-mono text-[10px] tracking-eyebrow text-ink-3">MATA-MATA · COPA 2026</p>
        <div className="mt-0.5 font-display text-3xl leading-none sm:text-4xl">CHAVEAMENTO</div>
        <div className="mt-2.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 font-mono text-[9px] tracking-eyebrow text-ink-3">
          <span>FASE DE 32</span><span className="text-ink-4">›</span>
          <span>OITAVAS</span><span className="text-ink-4">›</span>
          <span>QUARTAS</span><span className="text-ink-4">›</span>
          <span>SEMIS</span><span className="text-ink-4">›</span>
          <span className="bg-ink px-1.5 py-0.5 text-paper">FINAL</span>
        </div>
        <p className="mt-3 font-mono text-[10px] text-ink-4">Veja a chave e palpite nos mata-matas</p>
      </div>
      <span className="grid h-12 w-12 flex-shrink-0 place-items-center border-2 border-ink bg-yellow font-display text-2xl text-ink transition-transform group-hover:translate-x-0.5">→</span>
    </button>
  )
}

// ─── Mobile ───────────────────────────────────────────────────────────────────

function HomeMobile() {
  const navigate = useNavigate()
  const user = useAuthStore(s => s.user)
  const { predictions, championPick, vicePick, scorerPick } = usePredictionStore()
  const { ranking, upcoming, matches: liveMatches } = useHomeData()
  const [quickPickMatch, setQuickPickMatch] = useState<Match | null>(null)

  const totalMatches   = WC2026_MATCHES.length
  const phase          = activePhaseProgress(liveMatches, predictions)
  const schedule       = heroSchedule(liveMatches)
  const apostasFeitas  = [championPick, vicePick, scorerPick].filter(Boolean).length
  const top3   = ranking.slice(0, 3)
  const myRank = ranking.find(r => r.isYou)

  return (
    <div className="min-h-dvh bg-paper pb-24">

      {/* Hero */}
      <RotatingHeroMobile schedule={schedule} onCta={() => navigate('/prediction')} />

      <div className="px-4 space-y-4 pt-4">

        {/* Upcoming matches — logo após o hero pra achar rápido sem rolar */}
        <div className="ui-panel">
          <div className="px-4 py-3 border-b border-hairline flex items-baseline justify-between">
            <div className="flex items-baseline gap-2">
              <span className="font-display text-lg">PRÓXIMOS</span>
              <span className="font-mono text-[10px] text-ink-3">até a final</span>
            </div>
          </div>
          <div className="divide-y divide-hairline">
            {upcoming.slice(0, 6).map(match => {
              const hasPick = !!predictions[match.id]
              const canPick = isBetOpen(match)
              const placeholder = isPlaceholderMatch(match)
              return (
                <button key={match.id} onClick={() => canPick ? setQuickPickMatch(match) : navigate(match.stage === 'group' ? '/prediction' : '/bracket')}
                  className={cn('w-full flex items-center gap-3 px-4 py-3 text-left transition-colors active:scale-[0.99]',
                    hasPick ? 'bg-green/10 hover:bg-green/15' : 'hover:bg-surface-hover')}>
                  <div className="font-mono text-[8px] text-ink-3 w-12 flex-shrink-0">{match.stage === 'group' ? <>GRUPO<br/>{match.group}</> : (match.stageLabel ?? 'MATA-MATA')}</div>
                  <Flag team={match.home} size={22} />
                  <span className="font-mono text-[11px] font-bold flex-1 truncate">{placeholder ? '—' : match.home.code}</span>
                  <div className="text-center flex-shrink-0">
                    <div className="font-mono text-[8px] text-ink-4">{formatMatchDate(match)}</div>
                    <div className="font-display text-base leading-tight">{formatMatchTime(match)}</div>
                  </div>
                  <span className="font-mono text-[11px] font-bold flex-1 text-right truncate">{placeholder ? '—' : match.away.code}</span>
                  <Flag team={match.away} size={22} />
                  {hasPick ? (
                    <span className="font-mono text-[10px] text-green flex-shrink-0">✓</span>
                  ) : canPick ? (
                    <span className="font-mono text-[8px] font-bold tracking-eyebrow bg-yellow text-ink px-1.5 py-0.5 flex-shrink-0 leading-none">PENDENTE</span>
                  ) : (
                    <span className="font-mono text-[8px] font-bold tracking-eyebrow text-ink-3 flex-shrink-0 leading-none">{placeholder ? 'A DEFINIR' : 'BLOQUEADO'}</span>
                  )}
                </button>
              )
            })}
          </div>
          <button onClick={() => navigate('/prediction')}
            className="w-full px-4 py-3 font-mono text-[10px] text-ink-3 hover:text-ink border-t border-hairline text-center tracking-eyebrow">
            VER TODOS OS {totalMatches} JOGOS →
          </button>
        </div>

        {/* Progresso + CTA */}
        <div className="ui-card overflow-hidden">
          <div className="px-4 pt-4 pb-3 border-b border-hairline">
            <div className="font-mono text-[9px] tracking-eyebrow text-ink-4">
              OLÁ{user?.firstName ? `, ${user.firstName.toUpperCase()}` : ''}
            </div>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="font-display text-4xl leading-none">{phase.done}</span>
              <span className="font-mono text-[10px] text-ink-3">de {phase.total} palpites feitos</span>
            </div>
          </div>
          <div className="px-4 py-3 space-y-3">
            <PredProgress done={phase.done} total={phase.total} label={phase.label} color="bg-yellow" />
            <PredProgress done={apostasFeitas} total={3} label="APOSTAS ESPECIAIS" color="bg-green" />
            <button onClick={() => navigate('/prediction')} className="btn-yellow w-full justify-center text-[11px] mt-1">
              {phase.done === 0 ? 'COMEÇAR A PALPITAR →' : 'CONTINUAR PALPITANDO →'}
            </button>
          </div>
        </div>

        {/* Apostas gerais CTA */}
        {apostasFeitas < 3 && (
          <button
            onClick={() => navigate('/prediction', { state: { tab: 'champion' } })}
            className="w-full border-2 border-yellow bg-yellow/10 p-4 flex items-center justify-between gap-3 text-left hover:bg-yellow/20 transition-colors active:scale-[0.98]"
          >
            <div>
              <div className="font-mono text-[9px] tracking-eyebrow text-ink-3">APOSTAS ESPECIAIS · OBRIGATÓRIO</div>
              <div className="font-display text-xl">CAMPEÃO · VICE · ARTILHEIRO</div>
              <div className="font-mono text-[10px] text-ink-3 mt-0.5">Até +50 pontos · prazo: 11 Jun</div>
            </div>
            <span className="font-display text-2xl text-yellow flex-shrink-0">→</span>
          </button>
        )}

        <HomeBoletimNewsSection compact />

        {/* Ranking preview */}
        {top3.length > 0 && (
          <div className="ui-panel">
            <div className="px-4 py-3 border-b border-hairline flex items-baseline justify-between">
              <div className="flex items-baseline gap-2">
                <span className="font-display text-lg">RANKING</span>
                {myRank && <span className="font-mono text-[10px] text-ink-3">{myRank.rank}° você</span>}
              </div>
              <button onClick={() => navigate('/ranking')} className="font-mono text-[10px] text-ink-4 hover:text-ink">VER TUDO →</button>
            </div>
            <div className="divide-y divide-hairline">
              {top3.map(r => (
                <div key={r.userId} className={cn('flex items-center gap-3 px-4 py-2.5', r.isYou && 'bg-yellow')}>
                  <span className="font-display text-xl w-6 flex-shrink-0">{r.rank}°</span>
                  <Avatar initials={r.initials} color={r.color} src={r.avatarUrl} size={28} />
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
                  <Avatar initials={myRank.initials} color={myRank.color} src={myRank.avatarUrl} size={28} />
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

        {/* Grupos */}
        <GroupsGrid predictions={predictions} />

        {/* Mata-mata */}
        <MinhaChaveCard />

        {/* Resenha teaser */}
        <ResenhaCard />

        {/* Highlights */}
        <VideoHighlights />

      </div>

      <AnimatePresence>
        {quickPickMatch && (
          <QuickPickModal match={quickPickMatch} onClose={() => setQuickPickMatch(null)} />
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Desktop ──────────────────────────────────────────────────────────────────

function HomeDesktop() {
  const navigate = useNavigate()
  const user = useAuthStore(s => s.user)
  const { predictions, championPick, vicePick, scorerPick } = usePredictionStore()
  const { ranking, upcoming, matches: liveMatches } = useHomeData()
  const [quickPickMatch, setQuickPickMatch] = useState<Match | null>(null)

  const totalMatches  = WC2026_MATCHES.length
  const phase         = activePhaseProgress(liveMatches, predictions)
  const schedule      = heroSchedule(liveMatches)
  const apostasFeitas = [championPick, vicePick, scorerPick].filter(Boolean).length
  const top5   = ranking.slice(0, 5)
  const myRank = ranking.find(r => r.isYou)

  return (
    <div className="min-h-dvh bg-paper">
      <div className="app-shell py-8 space-y-5">

        {/* Row 1: hero + progress + ranking */}
        <div className="grid grid-cols-[1.5fr_1fr_0.9fr] gap-5">

          {/* Hero countdown */}
          <RotatingHeroDesktop schedule={schedule} onCta={() => navigate('/prediction')} />

          {/* Progress card */}
          <div className="ui-card text-ink flex flex-col overflow-hidden">
            <div className="px-6 pt-6 pb-4 border-b border-hairline">
              <div className="font-mono text-[9px] tracking-eyebrow text-ink-4 mb-1">
                OLÁ{user?.firstName ? `, ${user.firstName.toUpperCase()}` : ''}
              </div>
              <div className="font-display text-5xl leading-none">{phase.done}</div>
              <div className="font-mono text-[10px] text-ink-3 mt-1">de {phase.total} palpites feitos</div>
            </div>
            <div className="px-6 py-4 space-y-4 flex-1">
              <div>
                <div className="flex justify-between mb-1.5">
                  <span className="font-mono text-[9px] text-ink-4 tracking-eyebrow">{phase.label}</span>
                  <span className="font-mono text-[9px] text-ink-3">{phase.done}/{phase.total}</span>
                </div>
                <div className="h-1.5 bg-hairline overflow-hidden">
                  <div className="h-full bg-yellow transition-all duration-700" style={{ width: `${phase.total > 0 ? (phase.done / phase.total) * 100 : 0}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-1.5">
                  <span className="font-mono text-[9px] text-ink-4 tracking-eyebrow">APOSTAS ESPECIAIS</span>
                  <span className="font-mono text-[9px] text-ink-3">{apostasFeitas}/3</span>
                </div>
                <div className="h-1.5 bg-hairline overflow-hidden">
                  <div className="h-full bg-green transition-all duration-700" style={{ width: `${(apostasFeitas / 3) * 100}%` }} />
                </div>
              </div>
            </div>
            <div className="px-6 pb-6 space-y-2">
              <button onClick={() => navigate('/prediction')} className="btn-yellow w-full justify-center active:scale-95 transition-transform">
                {phase.done === 0 ? 'COMEÇAR →' : 'CONTINUAR →'}
              </button>
              {apostasFeitas < 3 && (
                <button onClick={() => navigate('/prediction', { state: { tab: 'champion' } })}
                  className="w-full border border-ink py-2 text-center hover:bg-yellow/10 transition-colors">
                  <span className="font-mono text-[9px] text-ink tracking-eyebrow">APOSTAS ESPECIAIS PENDENTES</span>
                </button>
              )}
            </div>
          </div>

          {/* Ranking */}
          <div className="ui-panel flex flex-col">
            <div className="px-4 py-3 border-b border-hairline flex items-baseline justify-between">
              <div className="flex items-baseline gap-2">
                <span className="font-display text-lg">RANKING</span>
                {myRank && <span className="font-mono text-[10px] text-ink-3">{myRank.rank}° você</span>}
              </div>
              <button onClick={() => navigate('/ranking')} className="font-mono text-[10px] text-ink-4 hover:text-ink">VER TUDO →</button>
            </div>
            {top5.length > 0 ? (
              <div className="flex-1 divide-y divide-hairline">
                {top5.map(r => (
                  <div key={r.userId} className={cn('flex items-center gap-2 px-4 py-2.5', r.isYou && 'bg-yellow')}>
                    <span className="font-display text-xl w-6 flex-shrink-0">{r.rank}</span>
                    <Avatar initials={r.initials} color={r.color} src={r.avatarUrl} size={26} />
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-[11px] font-bold truncate">{r.name.split(' ')[0]}</div>
                      <div className="font-mono text-[8px] text-ink-3">{r.dept}</div>
                    </div>
                    <span className="font-display text-lg">{fmtPts(r.pts)}</span>
                  </div>
                ))}
                {myRank && myRank.rank > 5 && (
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-yellow">
                    <span className="font-display text-xl w-6 flex-shrink-0">{myRank.rank}</span>
                    <Avatar initials={myRank.initials} color={myRank.color} src={myRank.avatarUrl} size={26} />
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-[11px] font-bold">Você</div>
                    </div>
                    <span className="font-display text-lg">{fmtPts(myRank.pts)}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-3">
                <span className="font-display text-5xl text-ink-4">—</span>
                <p className="font-mono text-[11px] text-ink-3 leading-relaxed max-w-[160px]">Os pontos aparecem aqui quando os jogos começarem.</p>
              </div>
            )}
          </div>
        </div>

        {/* Row 2: upcoming + bracket + resenha */}
        <div className="grid grid-cols-[1.6fr_1fr_1fr] gap-5">

          {/* Upcoming */}
          <div className="ui-panel">
            <div className="px-4 py-3 border-b border-hairline flex items-baseline gap-2">
              <span className="font-display text-lg">PRÓXIMOS</span>
              <span className="font-mono text-[10px] text-ink-3">jogos · até a final</span>
            </div>
            <div className="divide-y divide-hairline">
              {upcoming.slice(0, 6).map(match => {
                const hasPick = !!predictions[match.id]
                const canPick = isBetOpen(match)
                const placeholder = isPlaceholderMatch(match)
                return (
                  <button key={match.id} onClick={() => canPick ? setQuickPickMatch(match) : navigate(match.stage === 'group' ? '/prediction' : '/bracket')}
                    className={cn('w-full flex items-center gap-4 px-4 py-3 transition-colors text-left group active:scale-[0.99]',
                      hasPick ? 'bg-green/10 hover:bg-green/15' : 'hover:bg-surface-hover')}>
                    <div className="flex-shrink-0 w-12 text-center">
                      <div className="font-mono text-[8px] text-ink-4 tracking-eyebrow">{match.stage === 'group' ? `GRUPO ${match.group}` : (match.stageLabel ?? 'MATA-MATA')}</div>
                    </div>
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Flag team={match.home} size={26} />
                      <div className="font-mono text-[12px] font-bold truncate">{match.home.name}</div>
                    </div>
                    <div className="text-center flex-shrink-0 px-2">
                      <div className="font-mono text-[8px] text-ink-4 tracking-eyebrow">{formatMatchDate(match)}</div>
                      <div className="font-display text-lg leading-none">{formatMatchTime(match)}</div>
                    </div>
                    <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                      <div className="font-mono text-[12px] font-bold truncate text-right">{match.away.name}</div>
                      <Flag team={match.away} size={26} />
                    </div>
                    {hasPick ? (
                      <span className="font-mono text-[10px] text-green flex-shrink-0">✓</span>
                    ) : canPick ? (
                      <span className="font-mono text-[8px] font-bold tracking-eyebrow bg-yellow text-ink px-1.5 py-0.5 flex-shrink-0 leading-none">PENDENTE</span>
                    ) : (
                      <span className="font-mono text-[8px] font-bold tracking-eyebrow text-ink-3 flex-shrink-0 leading-none">{placeholder ? 'A DEFINIR' : 'BLOQUEADO'}</span>
                    )}
                  </button>
                )
              })}
            </div>
            <button onClick={() => navigate('/prediction')}
              className="w-full px-4 py-2.5 font-mono text-[10px] text-ink-3 hover:text-ink tracking-eyebrow border-t border-hairline text-center">
              VER TODOS OS {totalMatches} JOGOS →
            </button>
          </div>

          {/* Mata-mata */}
          <MinhaChaveCard />

          {/* Resenha */}
          <ResenhaCard />
        </div>

        {/* Row 3: Boletim + noticias */}
        <HomeBoletimNewsSection />

        {/* Row 4: grupos grid */}
        <GroupsGrid predictions={predictions} />

        {/* Row 5: Highlights */}
        <VideoHighlights />

      </div>

      <AnimatePresence>
        {quickPickMatch && (
          <QuickPickModal match={quickPickMatch} onClose={() => setQuickPickMatch(null)} />
        )}
      </AnimatePresence>
    </div>
  )
}
