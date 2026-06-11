import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'

// ============================================================================
// Bolao Suprema · sync de resultados — fonte: TheSportsDB (FIFA World Cup 2026)
// ----------------------------------------------------------------------------
// A football-data.org (free) marcava os jogos como FINISHED mas SEM placar.
// A TheSportsDB (free, key publica '123') entrega o placar real do Mundial.
//
// Mapeamento: casamos o evento da TheSportsDB com a nossa partida pelo par de
// selecoes (home_code, away_code) — unico por jogo num Mundial. Os nomes em
// ingles da TheSportsDB foram confirmados para as 48 selecoes (NAME_TO_CODE).
//
// Seguranca:
//   - modo PADRAO = dry-run (NAO grava). So grava com ?live=1.
//   - nunca sobrescreve placar real com null; respeita lock manual de admin;
//     so atualiza quando ha mudanca de fato.
//   - a UPDATE em matches dispara o trigger trg_auto_score_predictions, que
//     calcula os pontos e atualiza o ranking automaticamente.
// ============================================================================

const TSDB_KEY = Deno.env.get('THESPORTSDB_KEY') ?? '123'
const WC_LEAGUE_ID = '4429'
const TSDB_BASE = `https://www.thesportsdb.com/api/v1/json/${TSDB_KEY}`

interface TsdbEvent {
  idEvent: string
  strEvent?: string
  strHomeTeam?: string
  strAwayTeam?: string
  intHomeScore?: string | null
  intAwayScore?: string | null
  strStatus?: string | null
  strTimestamp?: string | null
  dateEvent?: string | null
  idLeague?: string | null
}

const FINISHED_STATUS = new Set(['FT', 'AET', 'PEN', 'AWD', 'WO', 'MATCH FINISHED', 'FINISHED'])
const LIVE_STATUS = new Set(['1H', '2H', 'HT', 'ET', 'BT', 'P', 'PEN.', 'LIVE', 'HALF TIME', 'EXTRA TIME', 'BREAK TIME', 'PENALTIES'])

function norm(s: string): string {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()
}

// Nome (ingles, TheSportsDB) -> codigo da nossa base. Chaves normalizadas.
const NAME_TO_CODE: Record<string, string> = {}
const addName = (name: string, code: string) => { NAME_TO_CODE[norm(name)] = code }
;([
  ['Mexico', 'MEX'], ['South Africa', 'RSA'], ['South Korea', 'KOR'], ['Korea Republic', 'KOR'],
  ['Czech Republic', 'CZE'], ['Czechia', 'CZE'], ['Canada', 'CAN'],
  ['Bosnia-Herzegovina', 'BIH'], ['Bosnia and Herzegovina', 'BIH'], ['Qatar', 'QAT'], ['Switzerland', 'SUI'],
  ['Brazil', 'BRA'], ['Morocco', 'MAR'], ['Haiti', 'HTI'], ['Scotland', 'SCO'],
  ['USA', 'USA'], ['United States', 'USA'], ['Paraguay', 'PAR'], ['Australia', 'AUS'],
  ['Turkey', 'TUR'], ['Turkiye', 'TUR'], ['Germany', 'GER'], ['Curacao', 'CUW'],
  ['Ivory Coast', 'CIV'], ["Cote d'Ivoire", 'CIV'], ['Ecuador', 'ECU'],
  ['Netherlands', 'NED'], ['Japan', 'JPN'], ['Sweden', 'SWE'], ['Tunisia', 'TUN'],
  ['Belgium', 'BEL'], ['Egypt', 'EGY'], ['Iran', 'IRN'], ['New Zealand', 'NZL'],
  ['Spain', 'ESP'], ['Cape Verde', 'CPV'], ['Cape Verde Islands', 'CPV'], ['Saudi Arabia', 'KSA'], ['Uruguay', 'URU'],
  ['France', 'FRA'], ['Senegal', 'SEN'], ['Iraq', 'IRQ'], ['Norway', 'NOR'],
  ['Argentina', 'ARG'], ['Algeria', 'ALG'], ['Austria', 'AUT'], ['Jordan', 'JOR'],
  ['Portugal', 'POR'], ['DR Congo', 'COD'], ['Congo DR', 'COD'], ['Uzbekistan', 'UZB'], ['Colombia', 'COL'],
  ['England', 'ENG'], ['Croatia', 'CRO'], ['Ghana', 'GHA'], ['Panama', 'PAN'],
] as Array<[string, string]>).forEach(([n, c]) => addName(n, c))

function codeFor(name?: string | null): string | null {
  if (!name) return null
  return NAME_TO_CODE[norm(name)] ?? null
}

function parseScore(v: string | null | undefined): number | null {
  if (v == null || v === '') return null
  const n = parseInt(v, 10)
  return Number.isFinite(n) ? n : null
}

type Phase = 'finished' | 'live' | 'scheduled' | 'other'
function phaseOf(status: string | null | undefined): Phase {
  const s = (status ?? '').toUpperCase().trim()
  if (FINISHED_STATUS.has(s)) return 'finished'
  if (LIVE_STATUS.has(s)) return 'live'
  if (s === 'NS' || s === '' || s === 'TBD' || s === 'TIME TO BE DEFINED') return 'scheduled'
  return 'other'
}

async function fetchEvents(path: string): Promise<TsdbEvent[]> {
  const res = await fetch(`${TSDB_BASE}/${path}`)
  if (!res.ok) throw new Error(`TheSportsDB ${path} -> HTTP ${res.status}`)
  const data = await res.json() as { events?: TsdbEvent[] | null }
  return (data.events ?? []).filter(e => e.idLeague === WC_LEAGUE_ID)
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10)
}

interface CurrentRow {
  match_code: string
  status?: string | null
  market_status?: string | null
  lock_reason?: string | null
  home_score?: number | null
  away_score?: number | null
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceRoleKey) {
      return Response.json({ error: 'Missing Supabase env vars.' }, { status: 500 })
    }
    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })

    const url = new URL(req.url)
    const live = url.searchParams.get('live') === '1'          // grava de verdade
    const reconcile = url.searchParams.get('reconcile') === '1' // varre todos os jogos (rounds 1-3)
    const dateOverride = url.searchParams.get('date')

    // Coleta eventos. Por padrao: hoje + ontem (UTC) — pega o que acabou agora.
    // ?reconcile=1: rounds 1,2,3 (todos os jogos de grupos) p/ validar o mapeamento.
    let events: TsdbEvent[] = []
    if (reconcile) {
      for (const r of [1, 2, 3]) events.push(...await fetchEvents(`eventsround.php?id=${WC_LEAGUE_ID}&r=${r}&s=2026`))
    } else if (dateOverride) {
      events = await fetchEvents(`eventsday.php?d=${dateOverride}&s=Soccer`)
    } else {
      const now = new Date()
      const yest = new Date(now.getTime() - 86_400_000)
      for (const d of [isoDay(now), isoDay(yest)]) {
        events.push(...await fetchEvents(`eventsday.php?d=${d}&s=Soccer`))
      }
    }

    const unmatchedNames: string[] = []
    const planned: Array<Record<string, unknown>> = []
    let updated = 0

    for (const ev of events) {
      const homeCode = codeFor(ev.strHomeTeam)
      const awayCode = codeFor(ev.strAwayTeam)
      if (!homeCode || !awayCode) {
        unmatchedNames.push(`${ev.strHomeTeam} x ${ev.strAwayTeam} (${ev.strStatus})`)
        continue
      }

      const phase = phaseOf(ev.strStatus)
      if (phase === 'scheduled' || phase === 'other') continue // nada a apurar

      const h = parseScore(ev.intHomeScore)
      const a = parseScore(ev.intAwayScore)
      const providerHasScore = h != null && a != null
      if (!providerHasScore) continue // sem placar real, nao toca

      // Acha a nossa partida pelo par de selecoes (unico no Mundial).
      const { data: rows, error: findErr } = await supabase
        .from('matches')
        .select('match_code,status,market_status,lock_reason,home_score,away_score')
        .eq('home_code', homeCode)
        .eq('away_code', awayCode)
        .limit(1)
      if (findErr) throw findErr
      const current = rows?.[0] as CurrentRow | undefined
      if (!current) {
        unmatchedNames.push(`${homeCode} x ${awayCode} (sem partida no banco)`)
        continue
      }

      // Lock manual de admin tem autoridade final.
      const isManualLock =
        current.market_status === 'locked' &&
        current.lock_reason &&
        !String(current.lock_reason).startsWith('api_')
      if (isManualLock) continue

      const winner = h > a ? homeCode : a > h ? awayCode : 'draw'
      const patch = phase === 'finished'
        ? { status: 'finished', market_status: 'settled', home_score: h, away_score: a, winner, live_minute: null, settled_at: new Date().toISOString() }
        : { status: 'live', market_status: 'closed', home_score: h, away_score: a, winner: null }

      // Idempotencia: so atualiza se mudou status ou placar.
      const unchanged =
        current.status === patch.status &&
        current.home_score === patch.home_score &&
        current.away_score === patch.away_score
      if (unchanged) continue

      planned.push({ match_code: current.match_code, from: `${current.status} ${current.home_score ?? '-'}x${current.away_score ?? '-'}`, to: `${patch.status} ${h}x${a}`, winner })

      if (live) {
        const { error: updErr } = await supabase.from('matches').update(patch).eq('match_code', current.match_code)
        if (updErr) throw updErr
        updated += 1
      }
    }

    return Response.json({
      ok: true,
      source: 'thesportsdb',
      mode: live ? 'LIVE (gravando)' : 'DRY-RUN (nao grava)',
      scanned: events.length,
      changes: planned.length,
      updated,
      planned,
      unmatched: unmatchedNames,
    })
  } catch (error) {
    console.error('[tsdb-sync]', error)
    return Response.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 502 })
  }
})
