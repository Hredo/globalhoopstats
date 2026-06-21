/*
 * Fills EuroLeague team metadata that no official feed exposes: founded year,
 * primary/secondary brand colors, and the few remaining website/arena gaps.
 * Values are curated from each club's official identity (cross-checked against
 * Wikipedia) because parsing colors out of Wikipedia infoboxes is unreliable.
 * Only null columns are written. Usage:
 *   pnpm exec tsx scripts/backfill-euroleague-teams-curated.ts [--dry]
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

type Curated = {
  foundedYear?: number
  primaryColor?: string
  secondaryColor?: string
  website?: string
  arena?: string
}

// Keyed by DB slug. Colors are the club's primary identity hex pair.
const TEAMS: Record<string, Curated> = {
  "anadolu-efes": { primaryColor: "#001E62", secondaryColor: "#FFFFFF" },
  "as-monaco": { primaryColor: "#E2001A", secondaryColor: "#FFFFFF" },
  barcelona: { primaryColor: "#004D98", secondaryColor: "#A50044" },
  baskonia: { primaryColor: "#13366B", secondaryColor: "#FFFFFF" },
  "crvena-zvezda-meridianbet": { primaryColor: "#ED1C24", secondaryColor: "#FFFFFF" },
  "ea7-emporio-armani-milano": { primaryColor: "#E2001A", secondaryColor: "#FFFFFF" },
  "fenerbahce-beko": { primaryColor: "#1B1464", secondaryColor: "#FFED00" },
  "ldlc-asvel": { primaryColor: "#009639", secondaryColor: "#FFFFFF" },
  "maccabi-playtika-tel-aviv": {
    foundedYear: 1932,
    primaryColor: "#F8E300",
    secondaryColor: "#004B9B",
  },
  olympiacos: { foundedYear: 1931, primaryColor: "#DA1A32", secondaryColor: "#FFFFFF" },
  "partizan-mozzart-bet": {
    foundedYear: 1945,
    primaryColor: "#000000",
    secondaryColor: "#FFFFFF",
  },
  "real-madrid": { secondaryColor: "#5C2D91" },
  "virtus-segafredo-bologna": {
    foundedYear: 1929,
    primaryColor: "#000000",
    secondaryColor: "#FFFFFF",
  },
  zalgiris: { foundedYear: 1944, primaryColor: "#007A33", secondaryColor: "#FFFFFF" },
  "alba-berlin": {
    primaryColor: "#FFD700",
    secondaryColor: "#003DA5",
    website: "https://www.albaberlin.de",
    arena: "Uber Arena",
  },
  // Panathinaikos exists under two DB rows (duplicate from sync); fill both.
  panathinaikos: {
    foundedYear: 1919,
    primaryColor: "#007942",
    secondaryColor: "#FFFFFF",
  },
  "panathinaikos-aktor": {
    foundedYear: 1919,
    primaryColor: "#007942",
    secondaryColor: "#FFFFFF",
    website: "https://www.paobc.gr",
    arena: "OAKA Olympic Indoor Hall",
  },
}

async function main() {
  loadEnv()
  const sql = postgres(process.env.DATABASE_URL!, {
    prepare: false,
    connect_timeout: 20,
  })
  try {
    const rows = await sql<
      {
        id: string
        name: string
        slug: string
        founded_year: number | null
        primary_color: string | null
        secondary_color: string | null
        website: string | null
        arena: string | null
      }[]
    >`
      select distinct t.id, t.name, t.slug, t.founded_year, t.primary_color,
        t.secondary_color, t.website, t.arena
      from teams t
      join player_season_stats pss on pss.team_id = t.id
      join leagues l on l.id = pss.league_id
      join seasons s on s.id = pss.season_id
      where l.slug = 'euroleague' and s.is_current
    `
    let updated = 0
    const unmapped: string[] = []
    for (const t of rows) {
      const c = TEAMS[t.slug]
      if (!c) {
        if (
          t.founded_year == null ||
          t.primary_color == null ||
          t.secondary_color == null ||
          t.website == null ||
          t.arena == null
        ) {
          unmapped.push(`${t.name} (${t.slug})`)
        }
        continue
      }
      const fills: Record<string, string | number> = {}
      if (t.founded_year == null && c.foundedYear != null) fills.founded_year = c.foundedYear
      if (t.primary_color == null && c.primaryColor) fills.primary_color = c.primaryColor
      if (t.secondary_color == null && c.secondaryColor) fills.secondary_color = c.secondaryColor
      if (t.website == null && c.website) fills.website = c.website
      if (t.arena == null && c.arena) fills.arena = c.arena
      if (Object.keys(fills).length === 0) continue
      if (DRY) {
        console.log(`  [dry] ${t.name}: ${Object.keys(fills).join(",")}`)
      } else {
        await sql`update teams set ${sql(fills)} where id = ${t.id}`
        updated++
        console.log(`  ${t.name}: ${Object.keys(fills).join(",")}`)
      }
    }
    console.log(`[teams] updated=${updated}`)
    if (unmapped.length) {
      console.log(`[teams] still-incomplete & unmapped:\n  ${unmapped.join("\n  ")}`)
    }
  } finally {
    await sql.end()
  }
}

main().catch((e) => {
  console.error("TEAMS CURATED BACKFILL FAILED:", e?.message ?? e)
  process.exit(1)
})
