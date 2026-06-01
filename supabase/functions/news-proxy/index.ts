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
]

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
  const haystack = `${item.title} ${item.tags.join(' ')}`.toLowerCase()
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

function stripSourceSuffix(title: string, source: string): string {
  if (!source) return title
  return title
    .replace(new RegExp(`\\s+-\\s+${source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'), '')
    .trim()
}

async function fetchFromGoogleNews(language: 'pt' | 'en', limit: number): Promise<FootballNewsItem[]> {
  const params = new URLSearchParams({
    q: language === 'pt'
      ? '"Copa do Mundo 2026" OR "Copa 2026" OR "FIFA 2026"'
      : '"World Cup 2026" OR "FIFA 2026"',
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
      if (!rawTitle || !url) return null
      return {
        title: stripSourceSuffix(rawTitle, source),
        url,
        image: '',
        source,
        tags: ['World Cup 2026', 'Copa do Mundo 2026'],
        publishedAt: new Date(tagValue(item, 'pubDate') || Date.now()).toISOString(),
      }
    })
    .filter((item): item is FootballNewsItem => Boolean(item))
    .filter(isWC26Related)
    .slice(0, limit)
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
