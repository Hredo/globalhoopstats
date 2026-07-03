/*
 * PHOTOS PAUSED (2026-07-03): wipe all people photos from the database.
 * The UI renders typographic avatars (PersonAvatar) instead, and every photo
 * write in sync/backfills is commented out (grep "PHOTOS PAUSED").
 * Team/league logos are NOT touched.
 *
 * Usage: pnpm exec tsx scripts/clear-photos.ts [--dry]
 */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import postgres from "postgres"

function loadEnv() {
  const raw = readFileSync(resolve(process.cwd(), ".env"), "utf8")
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.*)$/)
    if (!m) continue
    let v = m[2].trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    process.env[m[1]] = v
  }
}

const DRY = process.argv.includes("--dry")

async function main() {
  loadEnv()
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false, connect_timeout: 20 })
  try {
    const [p] = await sql<{ n: string }[]>`
      select count(*) as n from players where image_url is not null
    `
    const [c] = await sql<{ n: string }[]>`
      select count(*) as n from coaches where photo_url is not null
    `
    console.log(`players con foto: ${p.n} · coaches con foto: ${c.n}`)
    if (DRY) {
      console.log("[dry] no se borra nada")
      return
    }
    const players = await sql`
      update players set image_url = null where image_url is not null
    `
    const coaches = await sql`
      update coaches set photo_url = null where photo_url is not null
    `
    console.log(`borradas: ${players.count} fotos de jugadores, ${coaches.count} de entrenadores`)
  } finally {
    await sql.end()
  }
}

main().catch((e) => {
  console.error("CLEAR PHOTOS FAILED:", e?.message ?? e)
  process.exit(1)
})
