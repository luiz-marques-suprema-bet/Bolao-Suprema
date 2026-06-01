// Copa 2026 news.
//
// H5: a chave da World News API e PAGA e NAO pode ir para o bundle do cliente.
// Toda a chamada acontece no Edge Function `news-proxy` (secret server-side
// WORLD_NEWS_API_KEY) quando configurada. Sem chave paga, o proxy usa fallback
// server-side via Google News RSS. O cliente apenas invoca o proxy via
// supabase-js — nenhum segredo de noticias e exposto no navegador.
//
// O cliente mantem a ultima leva em cache local para a secao aparecer de cara
// enquanto o proxy busca uma leva nova em background.

import { supabase, isMockMode } from '@/lib/supabase'

export interface FootballNewsItem {
  title: string
  url: string
  image: string
  source: string
  tags: string[]
  publishedAt: string
}

let _cache: FootballNewsItem[] | null = null
let _fetchedAt = 0
const TTL = 15 * 60 * 1000 // 15 min
const STORAGE_KEY = 'bolao-wc26-news-cache-v1'

function readStoredNews(): FootballNewsItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as { news?: FootballNewsItem[]; fetchedAt?: number }
    const news = Array.isArray(parsed.news) ? parsed.news : []
    if (news.length > 0) {
      _cache = news
      _fetchedAt = parsed.fetchedAt ?? 0
    }
    return news
  } catch {
    return []
  }
}

function writeStoredNews(news: FootballNewsItem[]) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ news, fetchedAt: Date.now() }))
  } catch {
    // cache local e opcional
  }
}

export function getCachedWC26News(limit = 10): FootballNewsItem[] {
  const news = _cache ?? readStoredNews()
  return news.slice(0, limit)
}

export async function fetchWC26News(limit = 10): Promise<FootballNewsItem[]> {
  const cached = getCachedWC26News(limit)
  if (_cache && Date.now() - _fetchedAt < TTL) {
    return _cache.slice(0, limit)
  }

  // Em mock mode nao ha backend; nao tenta a Edge Function.
  if (isMockMode) return cached

  try {
    const { data, error } = await supabase.functions.invoke('news-proxy', {
      body: { limit },
    })
    if (error) {
      // Falha real do proxy: nao mascarar como sucesso. Reaproveita cache se houver.
      return cached
    }
    const news = ((data as { news?: FootballNewsItem[] } | null)?.news ?? []) as FootballNewsItem[]
    if (news.length > 0) {
      _cache = news
      _fetchedAt = Date.now()
      writeStoredNews(news)
      return news.slice(0, limit)
    }
    return cached
  } catch {
    return cached
  }
}

// A disponibilidade real depende do proxy server-side; o cliente nao conhece nem
// deve conhecer chaves externas.
export function isConfigured(): boolean {
  return !isMockMode
}
