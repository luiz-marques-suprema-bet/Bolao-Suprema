// Free tier key is '123'. Set VITE_THESPORTSDB_KEY for a paid key.
const API_KEY = (import.meta.env.VITE_THESPORTSDB_KEY as string | undefined) ?? '123'
const BASE = `https://www.thesportsdb.com/api/v1/json/${API_KEY}`

export interface PlayerResult {
  idPlayer:       string
  strPlayer:      string
  strTeam:        string
  strNationality: string
  strPosition:    string
  strThumb:       string | null
  strCutout:      string | null
}

export async function searchPlayers(query: string): Promise<PlayerResult[]> {
  if (!query.trim()) return []
  try {
    const res = await fetch(`${BASE}/searchplayers.php?p=${encodeURIComponent(query)}`)
    if (!res.ok) return []
    const data = await res.json() as { player: (PlayerResult & { strSport?: string })[] | null }
    return (data.player ?? [])
      .filter(p => !p.strSport || p.strSport === 'Soccer')
      .slice(0, 8)
  } catch {
    return []
  }
}
