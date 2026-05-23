// Football atmosphere images for the Home hero.
// Priority: Pexels API (if key set) → Scorebat thumbnails → local curated fallbacks.

export interface FootballImage {
  url: string
  alt: string
  credit?: string
}

const PEXELS_KEY = import.meta.env.VITE_PEXELS_API_KEY as string | undefined

// Curated fallbacks. Local assets come first so the hero still works on
// GitHub Pages even when remote photo APIs/CDNs are blocked or slow.
const localAsset = (file: string) => `${import.meta.env.BASE_URL}assets/${file}`

export const FOOTBALL_FALLBACKS: FootballImage[] = [
  { url: localAsset('hero-onboarding.png'), alt: 'Jogadores brasileiros', credit: 'Bolão Suprema' },
  { url: localAsset('hero-portrait.png'), alt: 'Torcedor em clima de Copa', credit: 'Bolão Suprema' },
  { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3b/MetLife_Stadium_New_York_Giants_vs._New_York_Jets.jpg/1280px-MetLife_Stadium_New_York_Giants_vs._New_York_Jets.jpg',  alt: 'MetLife Stadium', credit: 'Wikimedia' },
  { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fd/AT%26T_Stadium_-_Aerial.jpg/1280px-AT%26T_Stadium_-_Aerial.jpg', alt: 'AT&T Stadium Dallas', credit: 'Wikimedia' },
  { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e3/SoFi_Stadium_-_Inglewood_CA.jpg/1280px-SoFi_Stadium_-_Inglewood_CA.jpg', alt: 'SoFi Stadium Los Angeles', credit: 'Wikimedia' },
  { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/Estadio_Azteca_-_Mexico.jpg/1280px-Estadio_Azteca_-_Mexico.jpg', alt: 'Estadio Azteca', credit: 'Wikimedia' },
  { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/43/BC_Place_-_July_2014.jpg/1280px-BC_Place_-_July_2014.jpg', alt: 'BC Place Vancouver', credit: 'Wikimedia' },
  { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/World_Cup_2014_-_Crowds_and_Celebrations_%28cropped%29.jpg/1280px-World_Cup_2014_-_Crowds_and_Celebrations_%28cropped%29.jpg', alt: 'Copa do Mundo', credit: 'Wikimedia' },
  { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/FIFA_World_Cup_Trophy.jpg/853px-FIFA_World_Cup_Trophy.jpg', alt: 'Taça da Copa do Mundo', credit: 'Wikimedia' },
  { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/44/Football_in_Justice_%28cropped%29.jpg/1280px-Football_in_Justice_%28cropped%29.jpg', alt: 'Futebol', credit: 'Wikimedia' },
]

export async function fetchPexelsFootball(query = 'soccer world cup stadium'): Promise<FootballImage[]> {
  if (!PEXELS_KEY) return []
  try {
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=12&orientation=landscape`,
      { headers: { Authorization: PEXELS_KEY } }
    )
    if (!res.ok) return []
    const data = await res.json() as {
      photos: { id: number; alt: string; src: { large2x: string; large: string } }[]
    }
    return (data.photos ?? []).map(p => ({
      url: p.src.large,
      alt: p.alt || 'Football',
      credit: 'Pexels',
    }))
  } catch {
    return []
  }
}

export async function fetchFootballImages(): Promise<FootballImage[]> {
  const pexels = await fetchPexelsFootball()
  if (pexels.length >= 6) return pexels
  return FOOTBALL_FALLBACKS
}
