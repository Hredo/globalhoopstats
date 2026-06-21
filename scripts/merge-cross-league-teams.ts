/*
 * Unifies clubs that the sync split into separate team rows — either across
 * leagues under different names (Barcelona/Barça, Baskonia/Kosner Baskonia) or a
 * pure same-league duplicate (Panathinaikos). Each dup is merged into its keeper:
 * player_season_stats / team_season_stats / coaches are repointed to the keeper,
 * dropping any row that would violate the per-table unique index (keeping the
 * keeper's), then the dup team row is deleted. One transaction per merge.
 *
 * Curated, verified pairs only. Destructive — preview first:
 *   pnpm exec tsx scripts/merge-cross-league-teams.ts --dry
 *   pnpm exec tsx scripts/merge-cross-league-teams.ts
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

// keeper slug <- dup slug. Keeper is the fuller / cleaner-named row.
const MERGES: { keeper: string; dup: string }[] = [
  { keeper: "barcelona", dup: "barca" },
  { keeper: "baskonia", dup: "kosner-baskonia" },
  { keeper: "panathinaikos", dup: "panathinaikos-aktor" },
]

async function main() {
  loadEnv()
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false, connect_timeout: 20 })
  try {
    for (const { keeper: keeperSlug, dup: dupSlug } of MERGES) {
      const keep = (await sql<{ id: string; name: string }[]>`select id, name from teams where slug = ${keeperSlug}`)[0]
      const dup = (await sql<{ id: string; name: string }[]>`select id, name from teams where slug = ${dupSlug}`)[0]
      if (!keep || !dup) {
        console.log(`[skip] ${keeperSlug} <- ${dupSlug} (keeper=${!!keep} dup=${!!dup})`)
        continue
      }
      const counts = async (id: string) => ({
        pss: Number((await sql`select count(*) c from player_season_stats where team_id = ${id}`)[0].c),
        tss: Number((await sql`select count(*) c from team_season_stats where team_id = ${id}`)[0].c),
        coaches: Number((await sql`select count(*) c from coaches where team_id = ${id}`)[0].c),
      })
      console.log(`\n[merge] ${keep.name} (${keeperSlug}) <- ${dup.name} (${dupSlug})`)
      console.log(`  keeper rows: ${JSON.stringify(await counts(keep.id))}`)
      console.log(`  dup rows:    ${JSON.stringify(await counts(dup.id))}`)
      if (DRY) continue

      await sql.begin(async (tx) => {
        const pssDel = await tx`
          delete from player_season_stats d
          where d.team_id = ${dup.id} and exists (
            select 1 from player_season_stats k
            where k.team_id = ${keep.id} and k.player_id = d.player_id
              and k.league_id = d.league_id and k.season_id = d.season_id)`
        const pssUpd = await tx`update player_season_stats set team_id = ${keep.id} where team_id = ${dup.id}`
        const tssDel = await tx`
          delete from team_season_stats d
          where d.team_id = ${dup.id} and exists (
            select 1 from team_season_stats k
            where k.team_id = ${keep.id} and k.season_id = d.season_id and k.league_id = d.league_id)`
        const tssUpd = await tx`update team_season_stats set team_id = ${keep.id} where team_id = ${dup.id}`
        const coDel = await tx`
          delete from coaches d
          where d.team_id = ${dup.id} and exists (
            select 1 from coaches k
            where k.team_id = ${keep.id} and k.league_id = d.league_id and k.slug = d.slug)`
        const coUpd = await tx`update coaches set team_id = ${keep.id} where team_id = ${dup.id}`
        const del = await tx`delete from teams where id = ${dup.id}`
        console.log(
          `  pss +${pssUpd.count}/-${pssDel.count} | tss +${tssUpd.count}/-${tssDel.count} | ` +
            `coaches +${coUpd.count}/-${coDel.count} | team deleted ${del.count}`,
        )
        console.log(`  keeper rows after: ${JSON.stringify(await (async () => ({
          pss: Number((await tx`select count(*) c from player_season_stats where team_id = ${keep.id}`)[0].c),
          tss: Number((await tx`select count(*) c from team_season_stats where team_id = ${keep.id}`)[0].c),
          coaches: Number((await tx`select count(*) c from coaches where team_id = ${keep.id}`)[0].c),
        }))())}`)
      })
    }
    console.log(`\n[merge] done${DRY ? " (dry)" : ""}.`)
  } finally {
    await sql.end()
  }
}

main().catch((e) => {
  console.error("MERGE TEAMS FAILED:", e?.message ?? e)
  process.exit(1)
})
