import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'

type FootballDataStatus =
  | 'SCHEDULED'
  | 'TIMED'
  | 'LIVE'
  | 'IN_PLAY'
  | 'PAUSED'
  | 'FINISHED'
  | 'POSTPONED'
  | 'SUSPENDED'
  | 'CANCELLED'

interface FootballDataMatch {
  id: number
  utcDate: string
  status: FootballDataStatus
  minute?: number | null
  lastUpdated?: string | null
  stage?: string | null
  group?: string | null
  matchday?: number | null
  homeTeam: { tla?: string | null }
  awayTeam: { tla?: string | null }
  score: {
    winner?: 'HOME_TEAM' | 'AWAY_TEAM' | 'DRAW' | null
    fullTime?: { home?: number | null; away?: number | null }
  }
}

function statusPatch(match: FootballDataMatch) {
  const homeScore = match.score?.fullTime?.home ?? null
  const awayScore = match.score?.fullTime?.away ?? null

  if (match.status === 'FINISHED') {
    return {
      status: 'finished',
      market_status: 'settled',
      home_score: homeScore,
      away_score: awayScore,
      live_minute: null,
      settled_at: new Date().toISOString(),
    }
  }

  if (match.status === 'LIVE' || match.status === 'IN_PLAY' || match.status === 'PAUSED') {
    return {
      status: 'live',
      market_status: 'closed',
      home_score: homeScore,
      away_score: awayScore,
      live_minute: match.minute ? String(match.minute) : null,
    }
  }

  if (match.status === 'POSTPONED' || match.status === 'SUSPENDED' || match.status === 'CANCELLED') {
    return {
      status: 'locked',
      market_status: 'locked',
      locked_at: new Date().toISOString(),
      lock_reason: `api_${match.status.toLowerCase()}`,
    }
  }

  return {
    status: 'scheduled',
    market_status: 'open',
    home_score: null,
    away_score: null,
    live_minute: null,
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const footballToken = Deno.env.get('FOOTBALL_DATA_TOKEN')

  if (!supabaseUrl || !serviceRoleKey || !footballToken) {
    return Response.json({ error: 'Missing required environment variables.' }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  })

  const season = new URL(req.url).searchParams.get('season') ?? '2026'
  const url = `https://api.football-data.org/v4/competitions/WC/matches?season=${encodeURIComponent(season)}`
  const footballRes = await fetch(url, {
    headers: { 'X-Auth-Token': footballToken },
  })

  if (!footballRes.ok) {
    return Response.json({
      error: 'football-data.org request failed',
      status: footballRes.status,
      body: await footballRes.text(),
    }, { status: 502 })
  }

  const body = await footballRes.json() as { matches?: FootballDataMatch[] }
  const matches = body.matches ?? []
  let updated = 0
  const unmatched: number[] = []

  for (const fdMatch of matches) {
    const { data: idRows, error: idFindError } = await supabase
      .from('matches')
      .select('match_code,market_status,lock_reason')
      .eq('football_data_id', fdMatch.id)
      .limit(1)

    if (idFindError) throw idFindError

    let current = idRows?.[0]

    if (!current && fdMatch.homeTeam.tla && fdMatch.awayTeam.tla) {
      const { data: codeRows, error: codeFindError } = await supabase
        .from('matches')
        .select('match_code,market_status,lock_reason')
        .eq('home_code', fdMatch.homeTeam.tla)
        .eq('away_code', fdMatch.awayTeam.tla)
        .eq('kickoff_utc', fdMatch.utcDate)
        .limit(1)

      if (codeFindError) throw codeFindError
      current = codeRows?.[0]
    }

    if (!current) {
      unmatched.push(fdMatch.id)
      continue
    }

    const patch = statusPatch(fdMatch)
    const isManualLock =
      current.market_status === 'locked' &&
      current.lock_reason &&
      !String(current.lock_reason).startsWith('api_')

    // M9 hardening: um lock MANUAL de admin (lock_reason != 'api_*') tem
    // autoridade final. A API nunca pode sobrescrever status/placar/mercado de
    // uma partida travada pelo admin — nem com LIVE nem com FINISHED. Gravamos
    // apenas os metadados football_data_* para diagnostico. Para liberar/apurar,
    // o admin usa admin_update_match_status / settle_match_result.
    const safePatch = isManualLock
      ? {
          football_data_id: fdMatch.id,
          football_data_status: fdMatch.status,
          football_data_last_updated: fdMatch.lastUpdated ?? new Date().toISOString(),
        }
      : {
          ...patch,
          football_data_id: fdMatch.id,
          football_data_status: fdMatch.status,
          football_data_last_updated: fdMatch.lastUpdated ?? new Date().toISOString(),
          kickoff_utc: fdMatch.utcDate,
        }

    const { error: updateError } = await supabase
      .from('matches')
      .update(safePatch)
      .eq('match_code', current.match_code)

    if (updateError) throw updateError
    updated += 1
  }

  return Response.json({ ok: true, competition: 'WC', season, updated, unmatched })
})
