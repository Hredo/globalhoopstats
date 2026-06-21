/*
 * Corrects wrong (non-null) EuroLeague values found during the null backfill:
 *  - Real Madrid primary_color placeholder #999999 -> #005CAB (the club color
 *    already used by src/lib/theme/team-colors.ts EUROLEAGUE_TEAM_COLORS.MAD).
 *  - Player nationality "Illinois" (a US state, a scrape error) -> "USA".
 * Idempotent and narrowly scoped. Usage:
 *   pnpm exec tsx scripts/fix-euroleague-data.ts [--dry]
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

async function main() {
  loadEnv()
  const sql = postgres(process.env.DATABASE_URL!, {
    prepare: false,
    connect_timeout: 20,
  })
  try {
    if (DRY) {
      const mad = await sql`select name, primary_color from teams where slug = 'real-madrid'`
      const il = await sql`select first_name || ' ' || last_name as name, nationality from players where nationality = 'Illinois'`
      console.log("[dry] Real Madrid:", JSON.stringify(mad))
      console.log("[dry] nationality=Illinois:", JSON.stringify(il))
      return
    }

    const mad = await sql`
      update teams set primary_color = '#005CAB'
      where slug = 'real-madrid' and primary_color = '#999999'
    `
    console.log(`[real-madrid] primary_color fixed (${mad.count} row)`)

    const nat = await sql`
      update players set nationality = 'USA' where nationality = 'Illinois'
    `
    console.log(`[nationality] "Illinois" -> "USA" (${nat.count} row)`)
  } finally {
    await sql.end()
  }
}

main().catch((e) => {
  console.error("FIX FAILED:", e?.message ?? e)
  process.exit(1)
})
