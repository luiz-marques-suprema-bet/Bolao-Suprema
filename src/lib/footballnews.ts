// Copa 2026 news.
//
// H5: a chave da World News API e PAGA e NAO pode ir para o bundle do cliente.
// Toda a chamada acontece no Edge Function `news-proxy` (secret server-side
// WORLD_NEWS_API_KEY). O cliente apenas invoca o proxy via supabase-js — nenhum
// segredo de noticias e exposto no navegador.
//
// Sem chave configurada no servidor, o proxy retorna { news: [] } e a secao de
// noticias some sozinha (ver Home/index.tsx).

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

export async function fetchWC26News(limit = 10): Promise<FootballNewsItem[]> {
  if (_cache && Date.now() - _fetchedAt < TTL) {
    return _cache.slice(0, limit)
  }

  // Em mock mode nao ha backend; nao tenta a Edge Function.
  if (isMockMode) return []

  try {
    const { data, error } = await supabase.functions.invoke('news-proxy', {
      body: { limit },
    })
    if (error) {
      // Falha real do proxy: nao mascarar como sucesso. Reaproveita cache se houver.
      return _cache?.slice(0, limit) ?? []
    }
    const news = ((data as { news?: FootballNewsItem[] } | null)?.news ?? []) as FootballNewsItem[]
    _cache = news
    _fetchedAt = Date.now()
    return news.slice(0, limit)
  } catch {
    return _cache?.slice(0, limit) ?? []
  }
}

// A disponibilidade real depende do secret server-side (WORLD_NEWS_API_KEY), que
// o cliente nao conhece nem deve conhecer. A secao de noticias se esconde sozinha
// quando `fetchWC26News` retorna lista vazia (sem chave, sem resultados ou erro).
export function isConfigured(): boolean {
  return !isMockMode
}
