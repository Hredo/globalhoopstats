/**
 * Season rollover: make the database agree with the season model.
 *
 * Run this ONCE after `scripts/migrations/coaches-season-1-before-deploy.sql`
 * has been applied AND the season-model code is live — never before the deploy:
 * the older code reads `seasons.is_current`, and step 3 below hands that flag
 * to a season that may not have data yet. Then apply
 * `scripts/migrations/coaches-season-2-after-deploy.sql`. It is idempotent, so
 * running it twice changes nothing the second time.
 *
 * It does four things, all of which are corrections to state the old code
 * created and none of which a sync can fix on its own:
 *
 *  1. **Creates the current season row** and makes `is_current` a singleton.
 *     Every previous insert set `is_current = true` and never demoted the
 *     season before it, so after one rollover two seasons both claimed to be
 *     live and every `WHERE is_current` query returned both.
 *
 *  2. **Folds the legacy EuroLeague `E2025` season into `2025-26`.** The
 *     orchestrator used to write each adapter's FEED CODE as the season name,
 *     so the EuroLeague got a private season row that no other league shared —
 *     which makes a global season filter impossible. Stats, team stats and
 *     coaches are repointed at the canonical row and the orphan is deleted.
 *
 *  3. **Collapses duplicate season rows with the same name**, another legacy
 *     artefact: the winner is the row holding the most stats.
 *
 *  4. **Backfills `coaches.season_id`.** A staff row is assigned the season its
 *     club actually played in that league — read from the club's own stat rows
 *     — falling back to the league's newest season, then to the newest season
 *     overall.
 *
 * Usage:
 *   pnpm exec tsx scripts/rollover-season.ts --dry    # report, write nothing
 *   pnpm exec tsx scripts/rollover-season.ts
 */
import { sql } from "drizzle-orm"
import { closeDb, getDb, rawRows } from "@/lib/db/client"
import { newId } from "@/lib/db/schema"
import {
  CURRENT_SEASON_LABEL,
  canonicalSeasonLabel,
  compareSeasonsDesc,
} from "@/lib/seasons"

const DRY = process.argv.includes("--dry")

function say(msg: string) {
  console.log(`${DRY ? "[dry] " : ""}${msg}`)
}

type SeasonRow = { id: string; name: string; is_current: number }

async function loadSeasons(db: ReturnType<typeof getDb>) {
  return rawRows<SeasonRow>(
    db.execute(sql`SELECT id, name, is_current FROM seasons`),
  )
}

/** Every table that points at a season, so a merge repoints all of them. */
const SEASON_REFS = [
  { table: "player_season_stats", column: "season_id" },
  { table: "team_season_stats", column: "season_id" },
  { table: "coaches", column: "season_id" },
] as const

async function repointSeason(
  db: ReturnType<typeof getDb>,
  fromId: string,
  toId: string,
): Promise<void> {
  for (const ref of SEASON_REFS) {
    // A row may already exist for the target season with the same natural key
    // (same player, team and league). UPDATE would then hit the unique index,
    // so the duplicates are dropped first and the rest are moved.
    if (ref.table === "player_season_stats") {
      await db.execute(sql`
        DELETE dup FROM player_season_stats dup
        JOIN player_season_stats keep
          ON keep.player_id = dup.player_id
         AND keep.team_id  = dup.team_id
         AND keep.league_id = dup.league_id
         AND keep.season_id = ${toId}
        WHERE dup.season_id = ${fromId}
      `)
    } else if (ref.table === "team_season_stats") {
      await db.execute(sql`
        DELETE dup FROM team_season_stats dup
        JOIN team_season_stats keep
          ON keep.team_id = dup.team_id
         AND keep.league_id = dup.league_id
         AND keep.season_id = ${toId}
        WHERE dup.season_id = ${fromId}
      `)
    } else {
      await db.execute(sql`
        DELETE dup FROM coaches dup
        JOIN coaches keep
          ON keep.team_id = dup.team_id
         AND keep.league_id = dup.league_id
         AND keep.slug = dup.slug
         AND keep.season_id = ${toId}
        WHERE dup.season_id = ${fromId}
      `)
    }
    await db.execute(
      sql`UPDATE ${sql.raw(ref.table)} SET ${sql.raw(ref.column)} = ${toId} WHERE ${sql.raw(ref.column)} = ${fromId}`,
    )
  }
  await db.execute(sql`DELETE FROM seasons WHERE id = ${fromId}`)
}

async function main() {
  const db = getDb()

  /* ---- 1. Inventory ---- */
  let seasons = await loadSeasons(db)
  say(
    `found ${seasons.length} season row(s): ` +
      seasons
        .map((s) => `${s.name}${s.is_current ? "*" : ""}`)
        .sort()
        .join(", "),
  )

  /* ---- 2. Merge every row onto its canonical label ---- */
  // Group by the canonical label so "E2025" and "2025-26" land together, then
  // keep the row with the most stats and repoint the rest onto it.
  const counts = await rawRows<{ season_id: string; n: number }>(
    db.execute(sql`
      SELECT season_id, count(*) AS n FROM player_season_stats GROUP BY season_id
    `),
  )
  const rowsBySeason = new Map(counts.map((c) => [c.season_id, Number(c.n)]))

  const byCanonical = new Map<string, SeasonRow[]>()
  for (const s of seasons) {
    const key = canonicalSeasonLabel(s.name)
    const list = byCanonical.get(key) ?? []
    list.push(s)
    byCanonical.set(key, list)
  }

  let merged = 0
  for (const [label, group] of byCanonical) {
    if (group.length < 2) continue
    // Prefer a row already named canonically, then the one holding most stats.
    const winner = [...group].sort((a, b) => {
      const aCanon = a.name === label ? 0 : 1
      const bCanon = b.name === label ? 0 : 1
      if (aCanon !== bCanon) return aCanon - bCanon
      return (rowsBySeason.get(b.id) ?? 0) - (rowsBySeason.get(a.id) ?? 0)
    })[0]
    for (const loser of group) {
      if (loser.id === winner.id) continue
      say(
        `merging season "${loser.name}" (${rowsBySeason.get(loser.id) ?? 0} rows) ` +
          `into "${winner.name}"`,
      )
      if (!DRY) await repointSeason(db, loser.id, winner.id)
      merged++
    }
    if (winner.name !== label) {
      say(`renaming season "${winner.name}" -> "${label}"`)
      if (!DRY) {
        await db.execute(
          sql`UPDATE seasons SET name = ${label} WHERE id = ${winner.id}`,
        )
      }
    }
  }
  say(merged === 0 ? "no duplicate seasons to merge" : `merged ${merged} season row(s)`)

  /* ---- 3. Ensure the current season exists and owns is_current ---- */
  seasons = DRY ? seasons : await loadSeasons(db)
  let currentId = seasons.find(
    (s) => canonicalSeasonLabel(s.name) === CURRENT_SEASON_LABEL,
  )?.id
  if (!currentId) {
    currentId = newId()
    say(`creating season "${CURRENT_SEASON_LABEL}"`)
    if (!DRY) {
      await db.execute(
        sql`INSERT INTO seasons (id, name, is_current) VALUES (${currentId}, ${CURRENT_SEASON_LABEL}, 0)`,
      )
    }
  }
  say(`marking "${CURRENT_SEASON_LABEL}" as the only current season`)
  if (!DRY) {
    await db.execute(sql`UPDATE seasons SET is_current = (id = ${currentId})`)
  }

  /* ---- 4. Backfill coaches.season_id ---- */
  const nullCoaches = await rawRows<{ n: number }>(
    db.execute(sql`SELECT count(*) AS n FROM coaches WHERE season_id IS NULL`),
  )
  const pending = Number(nullCoaches[0]?.n ?? 0)
  if (pending === 0) {
    say("coaches already carry a season")
  } else {
    say(`backfilling season_id for ${pending} coach row(s)`)
    if (!DRY) {
      // Best evidence first: the season this club actually played in this
      // league, taken from its own stat rows.
      await db.execute(sql`
        UPDATE coaches c
        JOIN (
          SELECT pss.team_id, pss.league_id, pss.season_id, count(*) AS n
          FROM player_season_stats pss
          GROUP BY pss.team_id, pss.league_id, pss.season_id
        ) best
          ON best.team_id = c.team_id AND best.league_id = c.league_id
        LEFT JOIN (
          SELECT pss.team_id, pss.league_id, pss.season_id, count(*) AS n
          FROM player_season_stats pss
          GROUP BY pss.team_id, pss.league_id, pss.season_id
        ) better
          ON better.team_id = best.team_id
         AND better.league_id = best.league_id
         AND better.n > best.n
        SET c.season_id = best.season_id
        WHERE c.season_id IS NULL AND better.team_id IS NULL
      `)
      // Anything still null (a club with no stat rows at all) falls back to the
      // newest season overall, computed here rather than in SQL so the same
      // ordering rule as the app applies.
      const remaining = await rawRows<{ n: number }>(
        db.execute(sql`SELECT count(*) AS n FROM coaches WHERE season_id IS NULL`),
      )
      if (Number(remaining[0]?.n ?? 0) > 0) {
        const all = await loadSeasons(db)
        const newest = [...all].sort((a, b) =>
          compareSeasonsDesc(a.name, b.name),
        )[0]
        if (newest) {
          say(
            `${remaining[0].n} coach row(s) had no club stats to date from — ` +
              `assigning "${newest.name}"`,
          )
          await db.execute(
            sql`UPDATE coaches SET season_id = ${newest.id} WHERE season_id IS NULL`,
          )
        }
      }
    }
  }

  /* ---- 5. Report ---- */
  if (!DRY) {
    const final = await loadSeasons(db)
    const perSeason = await rawRows<{ name: string; n: number }>(
      db.execute(sql`
        SELECT s.name AS name, count(*) AS n
        FROM player_season_stats p JOIN seasons s ON s.id = p.season_id
        GROUP BY s.name
      `),
    )
    const counted = new Map(perSeason.map((r) => [r.name, Number(r.n)]))
    console.log("\nSeasons after rollover:")
    for (const s of [...final].sort((a, b) => compareSeasonsDesc(a.name, b.name))) {
      console.log(
        `  ${s.name.padEnd(10)} ${s.is_current ? "current" : "       "} ` +
          `${counted.get(s.name) ?? 0} player rows`,
      )
    }
  }
}

main()
  .then(() => closeDb())
  .catch(async (err) => {
    console.error(err)
    await closeDb()
    process.exit(1)
  })
