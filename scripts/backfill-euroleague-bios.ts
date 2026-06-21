/*
 * Fills players.bio for EuroLeague current-season players. Primary source is the
 * English Wikipedia intro extract (verified to be about basketball). Players
 * without a usable article get a factual one-line bio assembled purely from
 * known DB fields (nationality, position, team) — no invented content.
 * Only null bios are written. Usage:
 *   pnpm exec tsx scripts/backfill-euroleague-bios.ts [--dry] [--limit N]
 */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import postgres from "postgres"

function loadEnv() {
  for (const file of [".env", ".env.local"]) {
    try {
      const raw = readFileSync(resolve(process.cwd(), file), "utf8")
      for (const line of raw.split(/\r?\n/)) {
        const m = line.match(/^([A-Z_]+)=(.*)$/)
        if (!m) continue
        let v = m[2].trim()
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
          v = v.slice(1, -1)
        }
        if (!process.env[m[1]]) process.env[m[1]] = v
      }
    } catch {
      /* optional */
    }
  }
}

const DRY = process.argv.includes("--dry")
const LIMIT = (() => {
  const i = process.argv.indexOf("--limit")
  return i >= 0 ? Number(process.argv[i + 1]) : Infinity
})()
const UA = "globalhoopstats-backfill/1.0 (https://globalhoopstats; hrvaldes22@gmail.com)"

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

const POSITION_WORD: Record<string, string> = {
  G: "guard",
  F: "forward",
  C: "center",
  "G-F": "guard-forward",
  "F-G": "forward-guard",
  "F-C": "forward-center",
  "C-F": "center-forward",
}

// Same-name collisions where Wikipedia's default search returns a more famous,
// different player. Keyed by lowercased DB name -> exact Wikipedia article title.
const TITLE_OVERRIDE: Record<string, string> = {
  "devin booker": "Devin Booker (basketball, born 1991)",
}

/** Keep the first 1-3 sentences, capped at ~600 chars on a sentence boundary. */
function trimExtract(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim()
  if (clean.length <= 600) return clean
  const cut = clean.slice(0, 600)
  const lastStop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "))
  return (lastStop > 200 ? cut.slice(0, lastStop + 1) : cut.trimEnd() + "…").trim()
}

async function fetchExtract(params: Record<string, string>): Promise<string | null> {
  const url =
    "https://en.wikipedia.org/w/api.php?" +
    new URLSearchParams({
      action: "query",
      format: "json",
      prop: "extracts",
      exintro: "1",
      explaintext: "1",
      redirects: "1",
      ...params,
    })
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": UA, Accept: "application/json" },
        signal: AbortSignal.timeout(30_000),
      })
      if (res.status === 429 || res.status >= 500) throw new Error(`${res.status}`)
      if (!res.ok) return null
      const data = (await res.json()) as {
        query?: { pages?: Record<string, { title: string; extract?: string }> }
      }
      const page = data.query?.pages ? Object.values(data.query.pages)[0] : undefined
      const extract = page?.extract?.trim()
      if (!extract) return null
      return extract
    } catch {
      if (attempt === 3) return null
      await sleep(1200 * attempt)
    }
  }
  return null
}

async function wikiExtract(name: string): Promise<string | null> {
  const override = TITLE_OVERRIDE[name.toLowerCase()]
  const extract = override
    ? await fetchExtract({ titles: override })
    : await fetchExtract({
        generator: "search",
        gsrsearch: `${name} basketball`,
        gsrlimit: "1",
      })
  if (!extract) return null
  // Overridden titles are trusted; otherwise require a basketball signal to
  // guard against same-name non-athletes.
  if (!override && !/basketball|baloncesto|euroleague|nba\b/i.test(extract)) return null
  return trimExtract(extract)
}

function templateBio(p: {
  name: string
  nationality: string | null
  position: string | null
  team: string | null
}): string {
  const nat = p.nationality ? `${p.nationality} ` : ""
  const pos = p.position ? POSITION_WORD[p.position] ?? null : null
  const posPhrase = pos ? ` who plays as a ${pos}` : ""
  const teamPhrase = p.team ? ` for ${p.team} in the EuroLeague` : " in the EuroLeague"
  return `${p.name} is a ${nat}professional basketball player${posPhrase}${teamPhrase}.`
    .replace(/\s+/g, " ")
    .trim()
}

async function main() {
  loadEnv()
  const sql = postgres(process.env.DATABASE_URL!, {
    prepare: false,
    connect_timeout: 20,
  })
  try {
    const players = await sql<
      {
        id: string
        name: string
        nationality: string | null
        position: string | null
        team: string | null
      }[]
    >`
      select distinct on (p.id) p.id,
        p.first_name || ' ' || p.last_name as name,
        p.nationality, p.position, t.name as team
      from players p
      join player_season_stats pss on pss.player_id = p.id
      join leagues l on l.id = pss.league_id
      join seasons s on s.id = pss.season_id
      left join teams t on t.id = pss.team_id
      where l.slug = 'euroleague' and s.is_current and p.bio is null
      order by p.id, pss.games_played desc nulls last
    `
    console.log(`[bios] ${players.length} players with null bio`)
    let wiki = 0
    let template = 0
    let processed = 0
    for (const p of players) {
      if (processed >= LIMIT) break
      processed++
      let bio = await wikiExtract(p.name)
      const source = bio ? "wiki" : "template"
      if (!bio) bio = templateBio(p)
      if (source === "wiki") wiki++
      else template++
      if (DRY) {
        console.log(`  [dry] ${p.name} [${source}]: ${bio.slice(0, 90)}…`)
      } else {
        await sql`update players set bio = ${bio} where id = ${p.id}`
        if (processed % 25 === 0) console.log(`  …${processed}/${players.length} (wiki=${wiki} tmpl=${template})`)
      }
      await sleep(180) // be gentle with the Wikipedia API
    }
    console.log(`[bios] done: wiki=${wiki} template=${template} total=${processed}`)
  } finally {
    await sql.end()
  }
}

main().catch((e) => {
  console.error("BIO BACKFILL FAILED:", e?.message ?? e)
  process.exit(1)
})
