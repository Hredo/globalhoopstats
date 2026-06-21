/*
 * Replaces EuroLeague team logos with the official EuroLeague club crests
 * (media-cdn.incrowdsports.com / cortextech.io). The previous Wikimedia URLs
 * were partly 404 and hotlink-blocked, so the UI fell back to initials.
 * Crest URLs captured from api-live.euroleague.net clubs feed (E2025, + E2024
 * for ALBA Berlin). Overwrites logo_url for matched EL teams. Usage:
 *   pnpm exec tsx scripts/backfill-euroleague-logos.ts [--dry]
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

// DB slug -> official EuroLeague crest URL.
const LOGOS: Record<string, string> = {
  "anadolu-efes": "https://media-cdn.cortextech.io/9a463aa2-ceb2-481c-9a95-1cddee0a248e.png",
  "as-monaco": "https://media-cdn.incrowdsports.com/89ed276a-2ba3-413f-8ea2-b3be209ca129.png",
  "crvena-zvezda-meridianbet": "https://media-cdn.incrowdsports.com/d2eef4a8-62df-4fdd-9076-276004268515.png",
  "ea7-emporio-armani-milano": "https://media-cdn.cortextech.io/9512ee73-a0f1-4647-a01e-3c2938aba6b8.png",
  barcelona: "https://media-cdn.incrowdsports.com/35dfa503-e417-481f-963a-bdf6f013763e.png",
  "bayern-munchen": "https://media-cdn.incrowdsports.com/817b0e58-d595-4b09-ab0b-1e7cc26249ff.png",
  "fenerbahce-beko": "https://media-cdn.cortextech.io/3b7f020e-5b39-49a1-b4b2-efea918edab7.png",
  baskonia: "https://media-cdn.cortextech.io/cbc49cb0-99ce-4462-bdb7-56983ee03cf4.png",
  "ldlc-asvel": "https://media-cdn.incrowdsports.com/e33c6d1a-95ca-4dbc-b8cb-0201812104cc.png",
  "maccabi-playtika-tel-aviv": "https://media-cdn.cortextech.io/1b533342-78f5-4932-b714-a7d80b5826b5.png",
  olympiacos: "https://media-cdn.incrowdsports.com/789423ac-3cdf-4b89-b11c-b458aa5f59a6.png",
  panathinaikos: "https://media-cdn.incrowdsports.com/e3dff28a-9ec6-4faf-9d96-ecbc68f75780.png",
  "panathinaikos-aktor": "https://media-cdn.incrowdsports.com/e3dff28a-9ec6-4faf-9d96-ecbc68f75780.png",
  "partizan-mozzart-bet": "https://media-cdn.incrowdsports.com/2681304e-77dd-4331-88b1-683078c0fb49.png",
  "real-madrid": "https://media-cdn.incrowdsports.com/371b0d9b-9250-4c09-bda7-0686cf024657.png",
  "virtus-segafredo-bologna": "https://media-cdn.cortextech.io/1362801d-dd09-4fd0-932d-ead56063ab77.png",
  zalgiris: "https://media-cdn.incrowdsports.com/0aa09358-3847-4c4e-b228-3582ee4e536d.png",
  "alba-berlin": "https://media-cdn.incrowdsports.com/ccc34858-22b0-47dc-904c-9940b0a16ff3.png",
  // Other E2025 clubs, in case they exist under these slugs in the DB.
  "valencia-basket": "https://media-cdn.cortextech.io/d88f3c71-1519-4b19-8cfb-99e26a4c008e.png",
  "dubai-basketball": "https://media-cdn.incrowdsports.com/1efae090-16e2-4963-ae47-4b94f249c244.png",
  "hapoel-ibi-tel-aviv": "https://media-cdn.incrowdsports.com/cbb1c3ad-03d5-426a-b5ef-2832a4eee484.png",
  "paris-basketball": "https://media-cdn.incrowdsports.com/a033e5b3-0de7-48a3-98d9-d9a4b9df1f39.png",
}

async function main() {
  loadEnv()
  const sql = postgres(process.env.DATABASE_URL!, {
    prepare: false,
    connect_timeout: 20,
  })
  try {
    const rows = await sql<{ id: string; name: string; slug: string; logo_url: string | null }[]>`
      select distinct t.id, t.name, t.slug, t.logo_url
      from teams t
      join player_season_stats pss on pss.team_id = t.id
      join leagues l on l.id = pss.league_id
      where l.slug = 'euroleague'
      order by t.name
    `
    let updated = 0
    const unmapped: string[] = []
    for (const t of rows) {
      const crest = LOGOS[t.slug]
      if (!crest) {
        unmapped.push(`${t.name} (${t.slug})`)
        continue
      }
      if (t.logo_url === crest) continue
      if (DRY) {
        console.log(`  [dry] ${t.name}: ${crest}`)
      } else {
        await sql`update teams set logo_url = ${crest} where id = ${t.id}`
        updated++
        console.log(`  ${t.name}: crest set`)
      }
    }
    console.log(`[logos] updated=${updated}`)
    if (unmapped.length) console.log(`[logos] unmapped:\n  ${unmapped.join("\n  ")}`)
  } finally {
    await sql.end()
  }
}

main().catch((e) => {
  console.error("LOGOS BACKFILL FAILED:", e?.message ?? e)
  process.exit(1)
})
