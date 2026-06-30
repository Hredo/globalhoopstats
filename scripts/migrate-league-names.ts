import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { getDb } from "@/lib/db/client"
import { leagues } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { SOURCE_META } from "@/lib/sources/types"

function loadEnv() {
  for (const file of [".env", ".env.local"]) {
    const path = resolve(process.cwd(), file)
    if (!existsSync(path)) continue
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
      if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "")
    }
  }
}

loadEnv()

async function main() {
  const db = getDb()

  for (const [slug, meta] of Object.entries(SOURCE_META)) {
    const [before] = await db
      .select({ name: leagues.name })
      .from(leagues)
      .where(eq(leagues.slug, slug))
      .limit(1)

    if (!before) {
      console.log(`  - ${slug}: not found in DB (league row missing)`)
      continue
    }

    if (before.name === meta.displayName) {
      console.log(`  ✓ ${slug}: already "${meta.displayName}"`)
      continue
    }

    await db
      .update(leagues)
      .set({ name: meta.displayName })
      .where(eq(leagues.slug, slug))

    console.log(`  ✓ ${slug}: "${before.name}" → "${meta.displayName}"`)
  }

  await db.$client.end()
  console.log("\nDone. League names updated in DB.")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
