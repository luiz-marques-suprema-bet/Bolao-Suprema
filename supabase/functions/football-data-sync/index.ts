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
    regularTime?: { home?: number | null; away?: number | null }
  }
}

interface FootballDataScorer {
  player?: {
    id?: number | null
    name?: string | null
  } | null
  team?: {
    tla?: string | null
  } | null
  goals?: number | null
  assists?: number | null
}

interface CurrentMatchRow {
  match_code: string
  home_code?: string | null
  away_code?: string | null
  status?: string | null
  market_status?: string | null
  lock_reason?: string | null
}

function finishedScore(match: FootballDataMatch, side: 'home' | 'away') {
  return match.score?.regularTime?.[side] ?? match.score?.fullTime?.[side] ?? null
}

function liveScore(match: FootballDataMatch, side: 'home' | 'away') {
  return match.score?.fullTime?.[side] ?? null
}

function winnerCode(match: FootballDataMatch, current?: CurrentMatchRow | null) {
  if (match.score?.winner === 'HOME_TEAM') {
    return current?.home_code ?? match.homeTeam.tla ?? null
  }
  if (match.score?.winner === 'AWAY_TEAM') {
    return current?.away_code ?? match.awayTeam.tla ?? null
  }
  if (match.score?.winner === 'DRAW') return 'draw'
  return null
}

function normalizePlayerName(name: string) {
  return name.trim().replace(/\s+/g, ' ').toLowerCase()
}

function statusPatch(match: FootballDataMatch, current?: CurrentMatchRow | null) {
  const homeScore = match.status === 'FINISHED' ? finishedScore(match, 'home') : liveScore(match, 'home')
  const awayScore = match.status === 'FINISHED' ? finishedScore(match, 'away') : liveScore(match, 'away')

  if (match.status === 'FINISHED') {
    return {
      status: 'finished',
      market_status: 'settled',
      home_score: homeScore,
      away_score: awayScore,
      winner: winnerCode(match, current),
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
        winner: null,
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
    winner: null,
    live_minute: null,
  }
}

// A football-data.org ocasionalmente derruba a conexao HTTP/2 ("http2 error:
// connection error received"), fazendo o fetch LANCAR excecao. Sem retry isso
// virava HTTP 500 no cron. Tentamos algumas vezes com backoff antes de desistir.
async function fetchWithRetry(url: string, init: RequestInit, attempts = 4): Promise<Response> {
  let lastError: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, init)
      if (res.status === 429 || res.status >= 500) {
        lastError = new Error(`upstream HTTP ${res.status}`)
      } else {
        return res
      }
    } catch (err) {
      lastError = err
    }
    if (i < attempts - 1) await new Promise(resolve => setTimeout(resolve, 600 * (i + 1)))
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}

async function syncScorers(
  supabase: ReturnType<typeof createClient>,
  footballToken: string,
  season: string,
) {
  const url = `https://api.football-data.org/v4/competitions/WC/scorers?season=${encodeURIComponent(season)}`
  const scorersRes = await fetchWithRetry(url, {
    headers: { 'X-Auth-Token': footballToken },
  })

  if (!scorersRes.ok) {
    return {
      ok: false,
      status: scorersRes.status,
      updated: 0,
      body: await scorersRes.text(),
    }
  }

  const body = await scorersRes.json() as { scorers?: FootballDataScorer[] }
  const scorers = body.scorers ?? []
  let updated = 0

  for (const scorer of scorers) {
    const playerName = scorer.player?.name?.trim()
    if (!playerName) continue

    const externalPlayerId = scorer.player?.id ? String(scorer.player.id) : null
    const normalizedName = normalizePlayerName(playerName)
    let playerId: string | null = null

    if (externalPlayerId) {
      const { data: player, error: playerError } = await supabase
        .from('players')
        .upsert(
          {
            team_code: scorer.team?.tla ?? null,
            display_name: playerName,
            normalized_name: normalizedName,
            external_id: externalPlayerId,
            source: 'football-data',
            status: 'active',
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'source,external_id' },
        )
        .select('id')
        .single()

      if (playerError) throw playerError
      playerId = player?.id ?? null
    }

    const payload = {
      player_id: playerId,
      player_name: playerName,
      normalized_name: normalizedName,
      team_code: scorer.team?.tla ?? null,
      goals: scorer.goals ?? 0,
      assists: scorer.assists ?? null,
      source: 'football-data',
      external_player_id: externalPlayerId ?? `name:${normalizedName}`,
      updated_at: new Date().toISOString(),
    }

    const { error: goalError } = await supabase
      .from('player_goal_totals')
      .upsert(payload, { onConflict: 'source,external_player_id' })

    if (goalError) throw goalError
    updated += 1
  }

  return { ok: true, updated }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
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
  const footballRes = await fetchWithRetry(url, {
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
  let scorerSync: Record<string, unknown>

  for (const fdMatch of matches) {
    const { data: idRows, error: idFindError } = await supabase
      .from('matches')
      .select('match_code,home_code,away_code,status,market_status,lock_reason')
      .eq('football_data_id', fdMatch.id)
      .limit(1)

    if (idFindError) throw idFindError

    let current = idRows?.[0]

    if (!current && fdMatch.homeTeam.tla && fdMatch.awayTeam.tla) {
      const { data: codeRows, error: codeFindError } = await supabase
        .from('matches')
        .select('match_code,home_code,away_code,status,market_status,lock_reason')
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

    const patch = statusPatch(fdMatch, current)
    const isManualLock =
      current.market_status === 'locked' &&
      current.lock_reason &&
      !String(current.lock_reason).startsWith('api_')

    // Resultado ja apurado (admin OU sync) tem autoridade: a fonte NUNCA rebaixa
    // um jogo finished/settled de volta para scheduled/live so porque o provedor
    // ainda o reporta como TIMED. So sobrescreve se o provedor tambem disser
    // FINISHED (ex.: para corrigir o placar final).
    const dbSettled = current.status === 'finished' || current.market_status === 'settled'
    const providerFinished = fdMatch.status === 'FINISHED'
    const freeze = isManualLock || (dbSettled && !providerFinished)

    // M9 hardening: um lock MANUAL de admin (lock_reason != 'api_*') tem
    // autoridade final. A API nunca pode sobrescrever status/placar/mercado de
    // uma partida travada pelo admin — nem com LIVE nem com FINISHED. Gravamos
    // apenas os metadados football_data_* para diagnostico. Para liberar/apurar,
    // o admin usa admin_update_match_status / settle_match_result.
    const safePatch = freeze
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

  try {
    scorerSync = await syncScorers(supabase, footballToken, season)
  } catch (error) {
    scorerSync = {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }

  return Response.json({ ok: true, competition: 'WC', season, updated, unmatched, scorerSync })
  } catch (error) {
    console.error('[football-data-sync]', error)
    return Response.json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 502 })
  }
})
