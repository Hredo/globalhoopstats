/**
 * Availability probe for the configured season.
 *
 * Answers ONE question before a rollover sync is attempted: does each upstream
 * source actually publish the season we are about to ask it for? A scraper
 * pointed at a page that does not exist yet fails quietly — it parses an empty
 * table and reports "0 rows" — which from the logs is indistinguishable from a
 * parser break. Running this first turns that into a straight yes/no per
 * league, and it checks the SAME urls and shapes the adapters use, so a pass
 * here means the adapter will find data.
 *
 * Touches no database, writes nothing, and goes through the polite fetcher.
 *
 *   pnpm exec tsx scripts/probe-season-sources.ts
 */
import { fetchText, fetchJson } from "@/lib/sources/fetcher"
import { FEB_CONFIGS } from "@/lib/sources/feb"
import { SOURCE_META } from "@/lib/sources/types"
import { CURRENT_SEASON_LABEL, CURRENT_SEASON_START_YEAR } from "@/lib/seasons"

const BR = "https://www.basketball-reference.com"
const FEB = "https://baloncestoenvivo.feb.es"
const NBA_STATS = "https://stats.nba.com/stats"
const ACB = "https://www.acb.com"

// The adapters send these; stats.nba.com hangs forever without them.
const NBA_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Referer: "https://www.nba.com/",
  Origin: "https://www.nba.com",
  "Accept-Language": "en-US,en;q=0.9",
}

type Result = { league: string; what: string; ok: boolean; detail: string }

const start = CURRENT_SEASON_START_YEAR
const end = start + 1

async function probeNbaApi(): Promise<Result> {
  const season = SOURCE_META.nba.seasonCode
  const url =
    `${NBA_STATS}/leaguestandingsv3?LeagueID=00&Season=${season}` +
    `&SeasonType=Regular+Season`
  try {
    const payload = await fetchJson<{ resultSets?: { rowSet?: unknown[] }[] }>(
      url,
      { headers: NBA_HEADERS, timeoutMs: 60_000 },
    )
    const rows = payload.resultSets?.[0]?.rowSet?.length ?? 0
    return {
      league: "NBA",
      what: `stats API standings ${season}`,
      ok: rows > 0,
      detail: `${rows} team rows`,
    }
  } catch (err) {
    return {
      league: "NBA",
      what: `stats API standings ${season}`,
      ok: false,
      detail: (err as Error).message.slice(0, 70),
    }
  }
}

/** A Basketball-Reference season page exists and carries the expected table. */
async function probeBr(
  league: string,
  path: string,
  tableId: string,
): Promise<Result> {
  const url = `${BR}${path}`
  try {
    const html = await fetchText(url, { timeoutMs: 45_000 })
    const has = new RegExp(`id="${tableId}"`, "i").test(html)
    return {
      league,
      what: path,
      ok: has,
      detail: has ? `table ${tableId} present` : `no table ${tableId}`,
    }
  } catch (err) {
    return { league, what: path, ok: false, detail: (err as Error).message.slice(0, 70) }
  }
}

/** The FEB group dropdown, read exactly the way the adapter reads it. */
async function probeFeb(cfg: (typeof FEB_CONFIGS)[number]): Promise<Result> {
  const url = `${FEB}/rankings.aspx?g=${cfg.g}&t=${start}&nm=${cfg.nm}`
  try {
    const html = await fetchText(url, { timeoutMs: 45_000 })
    const sel = html.match(
      /<select[^>]*name="[^"]*gruposDropDownList"[\s\S]*?<\/select>/i,
    )
    const options = sel
      ? [...sel[0].matchAll(/<option[^>]*value="(-?\d+)"[^>]*>([^<]*)</g)].map(
          (m) => m[2].trim(),
        )
      : []
    const regular = options.filter((o) => /liga\s+regular/i.test(o))
    return {
      league: cfg.displayName,
      what: `rankings t=${start}`,
      ok: regular.length > 0,
      detail:
        regular.length > 0
          ? `${regular.length} regular-season group(s)`
          : "no Liga Regular group published yet",
    }
  } catch (err) {
    return {
      league: cfg.displayName,
      what: `rankings t=${start}`,
      ok: false,
      detail: (err as Error).message.slice(0, 70),
    }
  }
}

/** ACB rosters live on acb.com and are not season-parameterised. */
async function probeAcbRosters(): Promise<Result> {
  const url = `${ACB}/es/liga/equipos`
  try {
    const html = await fetchText(url, { timeoutMs: 45_000 })
    const clubs = new Set(
      [...html.matchAll(/\/es\/liga\/equipos\/([a-z0-9-]+)/g)].map((m) => m[1]),
    )
    return {
      league: "Liga Endesa",
      what: "acb.com club list (rosters)",
      ok: clubs.size >= 10,
      detail: `${clubs.size} clubs listed`,
    }
  } catch (err) {
    return {
      league: "Liga Endesa",
      what: "acb.com club list (rosters)",
      ok: false,
      detail: (err as Error).message.slice(0, 70),
    }
  }
}

async function main() {
  console.log(
    `Probing sources for season ${CURRENT_SEASON_LABEL} ` +
      `(start year ${start})\n`,
  )

  const results: Result[] = []
  results.push(await probeNbaApi())
  results.push(await probeBr("NBA", `/leagues/NBA_${end}.html`, `roster`))
  results.push(
    await probeBr(
      "NBA",
      `/leagues/NBA_${end}_advanced.html`,
      `advanced-stats-${end}`,
    ),
  )
  results.push(
    await probeBr(
      "EuroLeague",
      `/international/euroleague/${end}_totals.html`,
      `totals-stats-${end}`,
    ),
  )
  results.push(await probeAcbRosters())
  results.push(
    await probeBr(
      "Liga Endesa",
      `/international/spain-liga-acb/${end}_per_game.html`,
      `per_game-stats-${end}`,
    ),
  )
  for (const cfg of FEB_CONFIGS) results.push(await probeFeb(cfg))

  for (const r of results) {
    console.log(
      `  ${r.ok ? "✓" : "✗"} ${r.league.padEnd(14)} ${r.what.padEnd(48)} ${r.detail}`,
    )
  }

  const failed = results.filter((r) => !r.ok)
  console.log("")
  if (failed.length === 0) {
    console.log(
      `Every source publishes ${CURRENT_SEASON_LABEL}. A full rollover sync can run.`,
    )
    return
  }
  console.log(
    `${failed.length} of ${results.length} checks did not return ${CURRENT_SEASON_LABEL} data.\n` +
      `Before a competition opens its season pages this is expected, not a bug:\n` +
      `sync the leagues that pass and re-run this for the rest later. A league\n` +
      `whose source is not ready is blocked by the quality gate anyway, so last\n` +
      `season's data stays untouched.`,
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
