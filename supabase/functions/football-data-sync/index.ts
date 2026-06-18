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
const TSDB_SEASON = '2026'
const TSDB_BASE = `https://www.thesportsdb.com/api/v1/json/${TSDB_KEY}`

// Rodadas no TheSportsDB (convencao confirmada nos dados reais da Copa 2022):
//   grupos = 1, 2, 3 (24 jogos cada em 2026) · Oitavas = 16 · Quartas = 125 ·
//   Semis = 150 · 3o lugar = 160 · Final = 200.
// A Fase de 32 (nova em 2026) nao existia em 2022; o codigo mais provavel e 32
// (segue o padrao "16 = oitavas"). eventsround traz TODOS os jogos da rodada, entao
// um jogo encerrado nunca "some" antes de ser apurado. past/nextleague seguem de
// rede de seguranca caso a Fase de 32 use outro codigo — reconfirmar quando a
// fonte publicar os confrontos (~27/06).
const GROUP_STAGE_ROUNDS = [1, 2, 3]
const KNOCKOUT_ROUNDS = [32, 16, 125, 150, 160, 200]

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

// Versao tolerante: uma falha pontual em um endpoint nao deve abortar a rodada
// inteira (senao um past/next instavel impede apurar jogos das rodadas).
async function fetchEventsSafe(path: string): Promise<TsdbEvent[]> {
  try {
    return await fetchEvents(path)
  } catch (e) {
    console.error('[tsdb-sync] fetch falhou, seguindo:', path, e)
    return []
  }
}


interface CurrentRow {
  match_code: string
  stage?: string | null
  status?: string | null
  market_status?: string | null
  lock_reason?: string | null
  home_score?: number | null
  away_score?: number | null
  kickoff_utc?: string | null
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

    // Coleta eventos.
    //   Fluxo automatico = eventsround das rodadas de grupos (1,2,3): traz TODOS
    //   os 24 jogos de cada rodada, inclusive ao vivo/encerrado, entao um jogo
    //   encerrado NUNCA some antes de ser apurado. (O past/nextleague no tier
    //   free voltou a devolver so 1 jogo e fazia jogos travarem em "live".)
    //   past/nextleague ficam como REDE DE SEGURANCA p/ o que estiver fora das
    //   rodadas mapeadas (ex.: mata-mata antes de a fonte publicar os codigos).
    //   ?reconcile=1: idem (rounds 1,2,3) — mantido p/ validar mapeamento.
    //   ?date=YYYY-MM-DD: eventsday pontual (debug).
    let events: TsdbEvent[] = []
    if (dateOverride) {
      events = await fetchEvents(`eventsday.php?d=${dateOverride}&s=Soccer`)
    } else {
      const byId = new Map<string, TsdbEvent>()
      // Rede de seguranca primeiro (prioridade menor).
      if (!reconcile) {
        for (const e of await fetchEventsSafe(`eventsnextleague.php?id=${WC_LEAGUE_ID}`)) byId.set(e.idEvent, e)
        for (const e of await fetchEventsSafe(`eventspastleague.php?id=${WC_LEAGUE_ID}`)) byId.set(e.idEvent, e)
      }
      // Rodadas (prioridade maior): o dado completo sobrescreve a rede de seguranca.
      // Grupos + mata-mata; rodadas que ainda nao existem voltam vazias (sem erro).
      for (const r of [...GROUP_STAGE_ROUNDS, ...KNOCKOUT_ROUNDS]) {
        for (const e of await fetchEventsSafe(`eventsround.php?id=${WC_LEAGUE_ID}&r=${r}&s=${TSDB_SEASON}`)) byId.set(e.idEvent, e)
      }
      events = [...byId.values()]
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

      // Acha a nossa partida pelo par de selecoes (unico no Mundial).
      const { data: rows, error: findErr } = await supabase
        .from('matches')
        .select('match_code,stage,status,market_status,lock_reason,home_score,away_score,kickoff_utc')
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

      const phase = phaseOf(ev.strStatus)

      // Um jogo JA encerrado nunca volta pra "ao vivo"/"agendado". Se ja temos
      // finished e a fonte ainda mostra ao vivo (lag comum: a fonte demora a
      // marcar FT) ou agendado, ignoramos — assim o cron NUNCA desfaz um
      // encerramento (manual do admin ou automatico). Correcao de placar com a
      // fonte tambem encerrada (phase==='finished') continua passando abaixo.
      if (current.status === 'finished' && phase !== 'finished') continue

      // (A) Sincroniza o HORARIO de inicio com a fonte (jogos NAO encerrados).
      // Garante que o horario exibido e o fechamento da aposta batam com quando
      // o jogo realmente acontece — corrige escalas erradas antes de o jogo rolar.
      // Encerrados ficam como estao (historico). strTimestamp da TheSportsDB e UTC.
      if (phase !== 'finished' && ev.strTimestamp) {
        const raw = /Z$|[+-]\d\d:?\d\d$/.test(ev.strTimestamp) ? ev.strTimestamp : `${ev.strTimestamp}Z`
        const when = new Date(raw)
        const curMs = current.kickoff_utc ? new Date(current.kickoff_utc).getTime() : 0
        if (!Number.isNaN(when.getTime()) && Math.abs(when.getTime() - curMs) > 60_000) {
          planned.push({ match_code: current.match_code, kickoff_fix: `${current.kickoff_utc ?? '-'} -> ${when.toISOString()}` })
          if (live) {
            const { error: kErr } = await supabase.from('matches').update({ kickoff_utc: when.toISOString() }).eq('match_code', current.match_code)
            if (kErr) throw kErr
            updated += 1
          }
        }
      }

      // (B) Status/placar — so com jogo ao vivo/encerrado e placar real.
      if (phase === 'scheduled' || phase === 'other') continue // nada a apurar

      const h = parseScore(ev.intHomeScore)
      const a = parseScore(ev.intAwayScore)
      const providerHasScore = h != null && a != null
      if (!providerHasScore) continue // sem placar real, nao toca

      // No mata-mata, empate no tempo regulamentar = decidido em prorrogacao/
      // penaltis. A fonte free nao entrega o vencedor dos penaltis, e gravar
      // winner='draw' quebraria o "+2 quem avanca" e o avanco da chave. Entao NAO
      // finalizamos esses casos automaticamente — ficam pro admin confirmar o
      // classificado na mao (rede de seguranca combinada).
      const isKnockout = (current.stage ?? 'group') !== 'group'
      if (phase === 'finished' && isKnockout && h === a) {
        planned.push({ match_code: current.match_code, ko_penaltis: `${h}x${a} — mata-mata empatado: confirmar classificado manualmente` })
        continue
      }

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
