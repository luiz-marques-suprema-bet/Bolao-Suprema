// ============================================================================
// Bolao Suprema · Edge Function: news-proxy
// ----------------------------------------------------------------------------
// Proxy server-side para noticias da Copa 2026 (World News API).
//
// H5 remediation: a chave da World News API e PAGA/metered. Antes ela vivia em
// VITE_WORLD_NEWS_API_KEY e era embarcada no bundle publico do navegador, o que
// permite roubo de cota/custo. Aqui a chave fica como SECRET do Edge Function
// (WORLD_NEWS_API_KEY) e nunca chega ao cliente. O frontend chama via
// supabase.functions.invoke('news-proxy').
//
// Sem a chave configurada -> usa Google News RSS como fallback server-side.
//
// Secrets:
//   supabase secrets set WORLD_NEWS_API_KEY=...      (opcional; World News API)
//   supabase secrets set WORLD_NEWS_URL=...          (opcional; default abaixo)
// ============================================================================

interface FootballNewsItem {
  title: string
  url: string
  image: string
  source: string
  tags: string[]
  publishedAt: string
}

interface WorldNewsArticle {
  title?: string
  url?: string
  image?: string | null
  source?: string
  source_country?: string
  source_name?: string
  publish_date?: string
  published_at?: string
}

const WC26_KEYWORDS = [
  'world cup 2026',
  'copa do mundo 2026',
  'copa 2026',
  'mundial 2026',
  'fifa 2026',
  'seleção',
  'selecao',
  'convocação',
  'convocacao',
  'estádio',
  'estadio',
  'ingresso',
  'grupo',
]

const GOOGLE_NEWS_QUERIES: Record<'pt' | 'en', string[]> = {
  pt: [
    '"Copa do Mundo 2026" OR "Copa 2026" OR "FIFA 2026"',
    '("Copa 2026" OR "Mundial 2026") (convocação OR convocados OR seleção OR jogadores)',
    '("Copa 2026" OR "Mundial 2026") (Brasil OR seleção brasileira OR Neymar OR Vinicius)',
    '("Copa 2026" OR "Mundial 2026") (estádios OR ingressos OR calendário OR grupos)',
  ],
  en: [
    '"World Cup 2026" OR "FIFA 2026"',
    '("World Cup 2026" OR "FIFA 2026") (squad OR roster OR teams OR players)',
    '("World Cup 2026" OR "FIFA 2026") (stadiums OR tickets OR schedule OR groups)',
  ],
}

function decodeXml(input: string): string {
  return input
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .trim()
}

function isWC26Related(item: FootballNewsItem): boolean {
  const haystack = `${item.title} ${item.source} ${item.tags.join(' ')}`.toLowerCase()
  return WC26_KEYWORDS.some((kw) => haystack.includes(kw))
}

function sourceFromUrl(url?: string): string {
  if (!url) return 'World News'
  try {
    return new URL(url).hostname.replace(/^www\./, '').split('.')[0].toUpperCase()
  } catch {
    return 'World News'
  }
}

function mapWorldNewsArticle(article: WorldNewsArticle): FootballNewsItem | null {
  if (!article.title || !article.url) return null
  return {
    title: article.title,
    url: article.url,
    image: article.image ?? '',
    source: article.source_name ?? article.source ?? sourceFromUrl(article.url),
    tags: ['World Cup 2026', 'Copa do Mundo 2026', article.source_country ?? ''].filter(Boolean),
    publishedAt: article.publish_date ?? article.published_at ?? new Date().toISOString(),
  }
}

async function fetchFromWorldNews(
  key: string,
  baseUrl: string,
  language: 'pt' | 'en',
  limit: number,
): Promise<FootballNewsItem[]> {
  const params = new URLSearchParams({
    'api-key': key,
    text:
      language === 'pt'
        ? '"Copa do Mundo 2026" OR "Copa 2026" OR "Mundial 2026" OR "FIFA 2026"'
        : '"World Cup 2026" OR "FIFA 2026"',
    language,
    sort: 'publish-time',
    'sort-direction': 'desc',
    number: String(limit),
  })
  if (language === 'pt') params.set('source-countries', 'br,pt')

  const res = await fetch(`${baseUrl}?${params.toString()}`)
  if (!res.ok) return []
  const json = (await res.json()) as { news?: WorldNewsArticle[] }
  return (json.news ?? [])
    .map(mapWorldNewsArticle)
    .filter((item): item is FootballNewsItem => Boolean(item))
}

function tagValue(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i'))
  return match ? decodeXml(match[1]) : ''
}

function attrValue(xml: string, tag: string, attr: string): string {
  const match = xml.match(new RegExp(`<${tag}[^>]*\\s${attr}=["']([^"']+)["'][^>]*>`, 'i'))
  return match ? decodeXml(match[1]) : ''
}

function absoluteUrl(url: string, base: string): string {
  if (!url) return ''
  try {
    return new URL(url, base).toString()
  } catch {
    return ''
  }
}

function looksLikeImage(url: string): boolean {
  return /^https?:\/\//i.test(url) && !url.includes('gstatic.com/favicon') && !url.includes('/favicon')
}

async function fetchArticleImage(url: string): Promise<string> {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), 2400)
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; BolaoSupremaNews/1.0)',
        accept: 'text/html,application/xhtml+xml',
      },
    })
    if (!res.ok) return ''
    const html = await res.text()
    const meta =
      html.match(/<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
      html.match(/<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::secure_url)?["']/i)?.[1] ??
      ''
    const image = absoluteUrl(decodeXml(meta), res.url || url)
    return looksLikeImage(image) ? image : ''
  } catch {
    return ''
  } finally {
    clearTimeout(id)
  }
}

function stripSourceSuffix(title: string, source: string): string {
  if (!source) return title
  return title
    .replace(new RegExp(`\\s+-\\s+${source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'), '')
    .trim()
}

async function fetchGoogleNewsQuery(language: 'pt' | 'en', query: string, limit: number): Promise<FootballNewsItem[]> {
  const params = new URLSearchParams({
    q: query,
    hl: language === 'pt' ? 'pt-BR' : 'en-US',
    gl: language === 'pt' ? 'BR' : 'US',
    ceid: language === 'pt' ? 'BR:pt-419' : 'US:en',
  })
  const res = await fetch(`https://news.google.com/rss/search?${params.toString()}`)
  if (!res.ok) return []
  const xml = await res.text()
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)]
    .map((match): FootballNewsItem | null => {
      const item = match[1]
      const source = tagValue(item, 'source') || 'Google News'
      const rawTitle = tagValue(item, 'title')
      const url = tagValue(item, 'link')
      const mediaImage =
        attrValue(item, 'media:content', 'url') ||
        attrValue(item, 'media:thumbnail', 'url') ||
        tagValue(item, 'url')
      if (!rawTitle || !url) return null
      return {
        title: stripSourceSuffix(rawTitle, source),
        url,
        image: looksLikeImage(mediaImage) ? mediaImage : '',
        source,
        tags: ['World Cup 2026', 'Copa do Mundo 2026', query],
        publishedAt: new Date(tagValue(item, 'pubDate') || Date.now()).toISOString(),
      }
    })
    .filter((item): item is FootballNewsItem => Boolean(item))
    .filter(isWC26Related)
    .slice(0, limit)
}

async function fetchFromGoogleNews(language: 'pt' | 'en', limit: number): Promise<FootballNewsItem[]> {
  const results: FootballNewsItem[] = []
  const seen = new Set<string>()

  for (const query of GOOGLE_NEWS_QUERIES[language]) {
    const batch = await fetchGoogleNewsQuery(language, query, Math.max(limit, 8))
    for (const item of batch) {
      const key = `${item.title.toLowerCase()}|${item.source.toLowerCase()}`
      if (seen.has(key)) continue
      seen.add(key)
      results.push(item)
      if (results.length >= limit) break
    }
    if (results.length >= limit) break
  }

  const enriched = await Promise.all(
    results.slice(0, limit).map(async (item) => ({
      ...item,
      image: item.image || await fetchArticleImage(item.url),
    })),
  )
  return enriched
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const key = Deno.env.get('WORLD_NEWS_API_KEY')
  const baseUrl = Deno.env.get('WORLD_NEWS_URL') ?? 'https://api.worldnewsapi.com/search-news'

  let limit = 10
  try {
    const body = (await req.json()) as { limit?: number }
    if (body && typeof body.limit === 'number') {
      limit = Math.min(Math.max(Math.floor(body.limit), 1), 20)
    }
  } catch {
    // body opcional; mantem default
  }

  try {
    const portuguese = key ? await fetchFromWorldNews(key, baseUrl, 'pt', limit) : []
    const english =
      portuguese.length >= Math.min(3, limit)
        ? []
        : key ? await fetchFromWorldNews(key, baseUrl, 'en', limit) : []
    let news = [...portuguese, ...english].filter(isWC26Related).slice(0, limit)
    if (news.length === 0) {
      const rssPortuguese = await fetchFromGoogleNews('pt', limit)
      const rssEnglish =
        rssPortuguese.length >= Math.min(3, limit)
          ? []
          : await fetchFromGoogleNews('en', limit)
      news = [...rssPortuguese, ...rssEnglish].slice(0, limit)
    }
    return Response.json({ news }, { headers: corsHeaders })
  } catch {
    return Response.json({ news: [] }, { headers: corsHeaders })
  }
})
