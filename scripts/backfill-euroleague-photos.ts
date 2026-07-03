/*
 * Last-mile EuroLeague gaps that the official feeds lack: the lone player image
 * and coach photo/age, sourced from Wikipedia (thumbnail + birth year). Matching
 * is conservative — a photo/age is only written when the article is clearly the
 * right person (basketball + coach/player + birth year). Null columns only.
 * Usage: pnpm exec tsx scripts/backfill-euroleague-photos.ts [--dry]
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
const UA = "globalhoopstats-backfill/1.0 (https://globalhoopstats; hrvaldes22@gmail.com)"
const THIS_YEAR = 2026

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

type WikiHit = { extract: string; thumb: string | null }

async function wikiPerson(name: string, role: "player" | "coach"): Promise<WikiHit | null> {
  const url =
    "https://en.wikipedia.org/w/api.php?" +
    new URLSearchParams({
      action: "query",
      format: "json",
      prop: "extracts|pageimages",
      exintro: "1",
      explaintext: "1",
      piprop: "thumbnail",
      pithumbsize: "500",
      redirects: "1",
      generator: "search",
      gsrsearch: `${name} basketball ${role}`,
      gsrlimit: "1",
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
        query?: {
          pages?: Record<
            string,
            { title: string; extract?: string; thumbnail?: { source?: string } }
          >
        }
      }
      const page = data.query?.pages ? Object.values(data.query.pages)[0] : undefined
      const extract = page?.extract?.trim()
      if (!extract) return null
      return { extract, thumb: page?.thumbnail?.source ?? null }
    } catch {
      if (attempt === 3) return null
      await sleep(1200 * attempt)
    }
  }
  return null
}

function looksRight(extract: string, role: "player" | "coach"): boolean {
  if (!/basketball/i.test(extract)) return false
  return role === "coach"
    ? /\bcoach\b/i.test(extract)
    : /\bplayer\b/i.test(extract)
}

function birthYear(extract: string): number | null {
  const m = extract.match(/\bborn[^)]*?(\b(?:19|20)\d{2})\b/i)
  if (!m) return null
  const y = Number(m[1])
  return y > 1930 && y < THIS_YEAR - 14 ? y : null
}

async function main() {
  // PHOTOS PAUSED (2026-07-03): people photos were removed from the DB and the
  // UI renders typographic avatars (PersonAvatar). Delete this guard to re-run.
  console.log("PHOTOS PAUSED: este script rellena fotos y está desactivado.")
  if (!process.argv.includes("--force")) return

  loadEnv()
  const sql = postgres(process.env.DATABASE_URL!, {
    prepare: false,
    connect_timeout: 20,
  })
  try {
    /* ---- the lone player image ---- */
    const players = await sql<{ id: string; name: string }[]>`
      select distinct p.id, p.first_name || ' ' || p.last_name as name
      from players p
      join player_season_stats pss on pss.player_id = p.id
      join leagues l on l.id = pss.league_id
      join seasons s on s.id = pss.season_id
      where l.slug = 'euroleague' and s.is_current and p.image_url is null
    `
    console.log(`[player-images] ${players.length} missing`)
    let pImg = 0
    for (const p of players) {
      const hit = await wikiPerson(p.name, "player")
      if (!hit || !hit.thumb || !looksRight(hit.extract, "player")) {
        console.warn(`  [player-images] no confident photo for ${p.name}`)
        await sleep(180)
        continue
      }
      if (DRY) console.log(`  [dry] ${p.name}: ${hit.thumb}`)
      else {
        await sql`update players set image_url = ${hit.thumb} where id = ${p.id}`
        pImg++
        console.log(`  ${p.name}: image`)
      }
      await sleep(180)
    }
    console.log(`[player-images] updated=${pImg}`)

    /* ---- coach photo + age ---- */
    const coaches = await sql<
      { id: string; full_name: string; photo_url: string | null; age: number | null }[]
    >`
      select c.id, c.full_name, c.photo_url, c.age
      from coaches c
      join leagues l on l.id = c.league_id
      where l.slug = 'euroleague' and (c.photo_url is null or c.age is null)
    `
    console.log(`\n[coaches] ${coaches.length} with missing photo/age`)
    let cUpd = 0
    for (const c of coaches) {
      const hit = await wikiPerson(c.full_name, "coach")
      if (!hit || !looksRight(hit.extract, "coach")) {
        console.warn(`  [coaches] no confident match for ${c.full_name}`)
        await sleep(180)
        continue
      }
      const fills: Record<string, string | number> = {}
      if (c.photo_url == null && hit.thumb) fills.photo_url = hit.thumb
      if (c.age == null) {
        const y = birthYear(hit.extract)
        if (y) fills.age = THIS_YEAR - y
      }
      if (Object.keys(fills).length === 0) {
        console.log(`  ~ ${c.full_name}: matched but nothing confident to fill`)
        await sleep(180)
        continue
      }
      if (DRY) console.log(`  [dry] ${c.full_name}: ${Object.keys(fills).join(",")}`)
      else {
        await sql`update coaches set ${sql(fills)} where id = ${c.id}`
        cUpd++
        console.log(`  ${c.full_name}: ${Object.keys(fills).join(",")}`)
      }
      await sleep(180)
    }
    console.log(`[coaches] updated=${cUpd}`)
  } finally {
    await sql.end()
  }
}

main().catch((e) => {
  console.error("PHOTOS BACKFILL FAILED:", e?.message ?? e)
  process.exit(1)
})
