import { eq, sql } from "drizzle-orm"
import { getDb, closeDb } from "@/lib/db/client"
import {
  coaches,
  leagues,
  playerSeasonStats,
  players,
  seasons,
  syncRuns,
  teamSeasonStats,
  teams,
} from "@/lib/db/schema"
import type { SourceAdapter, SourceId } from "@/lib/sources/types"
import {
  alertQualityGate,
  evaluateScrape,
  QualityGateError,
} from "@/lib/sync/quality-gate"
import { slugify, uniqueSlug } from "@/lib/sync/slug"
import { tierForSlug, type LeagueTier } from "@/lib/leagues-tier"
import { normalizeName } from "@/lib/sync/entity-matcher"
import { isSyncCancelled } from "@/lib/sync/controller"

function scorePlayerRecord(p: {
  imageUrl: string | null
  nationality: string | null
  position: string | null
  heightCm: number | null
  weightKg: number | null
}): number {
  let s = 0
  if (p.imageUrl) s += 10
  if (p.nationality) s += 5
  if (p.position) s += 3
  if (p.heightCm) s += 1
  if (p.weightKg) s += 1
  return s
}

export type SyncResult = {
  source: SourceId
  status: "ok" | "failed"
  durationMs: number
  rowsWritten: number
  error?: string
  totals: {
    teams: number
    players: number
    stats: number
    coaches: number
    teamStats: number
  }
}

export async function runSync(adapter: SourceAdapter): Promise<SyncResult> {
  const db = getDb()
  const startedAt = new Date()
  const started = Date.now()
  const [run] = await db
    .insert(syncRuns)
    .values({
      source: adapter.id,
      startedAt,
      status: "running",
      rowsWritten: 0,
    })
    .returning({ id: syncRuns.id })

  const totals = { teams: 0, players: 0, stats: 0, coaches: 0, teamStats: 0 }

  try {
    /* ---- League ---- */
    const leagueSlug = adapter.id
    const [league] = await db
      .insert(leagues)
      .values({
        name: adapter.displayName,
        slug: leagueSlug,
        region: adapter.country,
      })
      .onConflictDoUpdate({
        target: leagues.slug,
        set: { name: adapter.displayName, region: adapter.country },
      })
      .returning({ id: leagues.id })
    const leagueId = league.id

    /* ---- Season ---- */
    const [existingSeason] = await db
      .select({ id: seasons.id })
      .from(seasons)
      .where(eq(seasons.name, adapter.seasonCode))
      .limit(1)
    let seasonId: string
    if (existingSeason) {
      seasonId = existingSeason.id
    } else {
      const [inserted] = await db
        .insert(seasons)
        .values({ name: adapter.seasonCode, isCurrent: true })
        .returning({ id: seasons.id })
      seasonId = inserted.id
    }

    /* ---- Fetch the full batch before writing anything ---- */
    // The quality gate sees teams + players + stats together and compares them
    // against the last good sync, so a broken scrape can never overwrite good
    // data — the league keeps yesterday's correct rows instead.
    // Everything is scraped up front so the transaction below holds no network.
    const sourceTeams = await adapter.fetchTeams()
    const sourcePlayers = await adapter.fetchPlayers()
    const sourceStats = await adapter.fetchStats()
    const sourceCoaches = await adapter.fetchCoaches()
    const sourceTeamStats = await adapter.fetchTeamStats()

    const verdict = await evaluateScrape(leagueId, seasonId, {
      teams: sourceTeams,
      players: sourcePlayers,
      stats: sourceStats,
    })
    if (!verdict.ok) {
      await alertQualityGate(adapter.displayName, verdict.reasons)
      throw new QualityGateError(
        `quality gate blocked ${adapter.displayName}: ${verdict.reasons.join("; ")}`,
        verdict.reasons,
      )
    }

    // Last checkpoint before any write: the scrape above is the long "running"
    // window, so a Stop pressed during it must leave the DB untouched.
    if (await isSyncCancelled(started)) {
      throw new Error("cancelled by operator (before writes)")
    }

    // ALL writes for this league run inside ONE transaction. If anything throws
    // — a mid-write cancel, a DB error — the whole league rolls back and the DB
    // is never left half-synced (matches "only persist when it all succeeded").
    // The callback parameter is named `db` so it shadows the outer pooled handle;
    // the existing write code below runs against the transaction unchanged.
    await db.transaction(async (db) => {
      /* ---- Teams ---- */
      const existingTeams = await db.select().from(teams)
      const teamBySlug = new Map(existingTeams.map((t) => [t.slug, t]))
      const usedTeamSlugs = new Set(existingTeams.map((t) => t.slug))
      const teamIdBySourceId = new Map<string, string>()

      for (const st of sourceTeams) {
        const baseSlug = slugify(st.name) || `team-${st.sourceId}`
        let row = teamBySlug.get(baseSlug)
        const fillIns: Partial<typeof teams.$inferInsert> = {}
        if (st.foundedYear) fillIns.foundedYear = st.foundedYear
        if (st.arena) fillIns.arena = st.arena
        if (st.arenaCapacity) fillIns.arenaCapacity = st.arenaCapacity
        if (st.websiteUrl) fillIns.website = st.websiteUrl
        if (st.primaryColor) fillIns.primaryColor = st.primaryColor
        if (st.secondaryColor) fillIns.secondaryColor = st.secondaryColor
        if (!row) {
          const slug = uniqueSlug(baseSlug, usedTeamSlugs)
          const [inserted] = await db
            .insert(teams)
            .values({
              name: st.name,
              slug,
              city: st.city ?? null,
              logoUrl: st.logoUrl ?? null,
              ...fillIns,
            })
            .returning()
          row = inserted
          teamBySlug.set(slug, row)
        } else if (Object.keys(fillIns).length > 0) {
          await db.update(teams).set(fillIns).where(eq(teams.id, row.id))
        }
        teamIdBySourceId.set(st.sourceId, row.id)
        totals.teams++
      }

      /* ---- Players ---- */
      const existingPlayerRows = await db
        .select({
          id: players.id,
          slug: players.slug,
          firstName: players.firstName,
          lastName: players.lastName,
          imageUrl: players.imageUrl,
          nationality: players.nationality,
          position: players.position,
          heightCm: players.heightCm,
          weightKg: players.weightKg,
        })
        .from(players)
      const existingPlayersBySlug = new Map(
        existingPlayerRows.map((p) => [p.slug, p]),
      )

      // Each existing player's league tiers, so name matching is tier-scoped: a
      // FEB namesake and a top-tier professional sharing a name are kept apart
      // (see src/lib/leagues-tier.ts). Without this, "Daniel García" (EBA) fuses
      // into "Daniel García" (ACB) on every CLI sync.
      const tierRows = (await db.execute(
        sql`
        SELECT pss.player_id AS player_id, l.slug AS slug
        FROM player_season_stats pss
        JOIN leagues l ON l.id = pss.league_id
        GROUP BY pss.player_id, l.slug
      `,
      )) as unknown as { player_id: string; slug: string }[]
      const tiersByPlayer = new Map<string, Set<LeagueTier>>()
      for (const r of tierRows) {
        const set = tiersByPlayer.get(r.player_id) ?? new Set<LeagueTier>()
        set.add(tierForSlug(r.slug))
        tiersByPlayer.set(r.player_id, set)
      }
      const incomingTier = tierForSlug(adapter.id)

      // Key existing players by `${name}|${tier}`. A lookup for an incoming player
      // only ever returns a same-tier record, so the FEB↔top boundary is never
      // crossed. A brand-new record (no stat rows yet) is indexed under the tier
      // of the league currently importing it.
      // Accent-folded so the split FEB namesake (which inherited the pro's exact
      // spelling) reliably matches the FEB scrape even when accents differ
      // ("Dario" vs "Darío"). Same normalization the orchestrator's matcher uses.
      const nameKeyFor = (full: string) => normalizeName(full)
      const tierKey = (name: string, tier: LeagueTier) => `${name}|${tier}`
      const byNameTier = new Map<string, (typeof existingPlayerRows)[number]>()
      const indexPlayer = (p: (typeof existingPlayerRows)[number]) => {
        const name = nameKeyFor(`${p.firstName} ${p.lastName}`)
        const tiers = tiersByPlayer.get(p.id)
        const keys =
          tiers && tiers.size
            ? [...tiers].map((t) => tierKey(name, t))
            : [tierKey(name, incomingTier)]
        for (const k of keys) {
          const prior = byNameTier.get(k)
          if (!prior || scorePlayerRecord(p) > scorePlayerRecord(prior))
            byNameTier.set(k, p)
        }
      }
      for (const p of existingPlayerRows) indexPlayer(p)
      const usedPlayerSlugs = new Set(existingPlayerRows.map((p) => p.slug))

      const playerIdBySourceId = new Map<string, string>()
      for (const sp of sourcePlayers) {
        const nameKey = nameKeyFor(sp.fullName)
        const matchByName = byNameTier.get(tierKey(nameKey, incomingTier))
        const parts = sp.fullName.trim().split(/\s+/)
        const firstName = parts[0] ?? ""
        const lastName = parts.slice(1).join(" ") || firstName
        const baseSlug = slugify(sp.fullName) || `player-${sp.sourceId}`
        const sourceScopedSlug = `${adapter.id}-${baseSlug}`
        const slug = uniqueSlug(sourceScopedSlug, usedPlayerSlugs)
        const existing = existingPlayersBySlug.get(slug)
        const fillIns: Partial<typeof players.$inferInsert> = {}

        // PHOTOS PAUSED (2026-07-03): players render typographic avatars
        // (PersonAvatar); uncomment to resume photo ingestion.
        // if (sp.photoUrl) fillIns.imageUrl = sp.photoUrl
        if (sp.birthdate) fillIns.birthdate = sp.birthdate
        if (sp.nationality) fillIns.nationality = sp.nationality
        if (sp.position) fillIns.position = sp.position
        if (sp.heightCm) fillIns.heightCm = sp.heightCm
        if (sp.weightKg) fillIns.weightKg = sp.weightKg

        if (existing) {
          if (Object.keys(fillIns).length > 0) {
            await db
              .update(players)
              .set(fillIns)
              .where(eq(players.id, existing.id))
          }
          playerIdBySourceId.set(sp.sourceId, existing.id)
          totals.players++
          continue
        }

        if (matchByName) {
          if (Object.keys(fillIns).length > 0) {
            await db
              .update(players)
              .set(fillIns)
              .where(eq(players.id, matchByName.id))
          }
          playerIdBySourceId.set(sp.sourceId, matchByName.id)
          totals.players++
          continue
        }

        const [row] = await db
          .insert(players)
          .values({
            firstName,
            lastName,
            slug,
            birthdate: sp.birthdate ?? null,
            nationality: sp.nationality ?? null,
            position: sp.position ?? null,
            heightCm: sp.heightCm ?? null,
            weightKg: sp.weightKg ?? null,
            // PHOTOS PAUSED (2026-07-03): imageUrl: sp.photoUrl ?? null,
            ...fillIns,
          })
          .returning({ id: players.id })
        playerIdBySourceId.set(sp.sourceId, row.id)
        usedPlayerSlugs.add(slug)
        // Make this fresh record matchable by later players in the same run.
        byNameTier.set(tierKey(nameKey, incomingTier), {
          id: row.id,
          slug,
          firstName,
          lastName,
          imageUrl: null,
          nationality: sp.nationality ?? null,
          position: sp.position ?? null,
          heightCm: sp.heightCm ?? null,
          weightKg: sp.weightKg ?? null,
        })
        totals.players++
      }

      /* ---- Player Stats ---- */
      for (const s of sourceStats) {
        const playerId = playerIdBySourceId.get(s.playerSourceId)
        if (!playerId) continue
        const teamId = s.teamSourceId
          ? (teamIdBySourceId.get(s.teamSourceId) ?? null)
          : null
        if (!teamId) continue
        await db
          .insert(playerSeasonStats)
          .values({
            playerId,
            teamId,
            leagueId,
            seasonId,
            gamesPlayed: s.gamesPlayed,
            minutesTotal: s.minutesTotal,
            pointsTotal: s.pointsTotal,
            reboundsTotal: s.reboundsTotal,
            assistsTotal: s.assistsTotal,
            stealsTotal: s.stealsTotal,
            blocksTotal: s.blocksTotal,
            fgMade: s.fgMade,
            fgAttempted: s.fgAttempted,
            threeMade: s.threeMade,
            threeAttempted: s.threeAttempted,
            ftMade: s.ftMade,
            ftAttempted: s.ftAttempted,
            offensiveRebounds: s.offensiveRebounds,
            defensiveRebounds: s.defensiveRebounds,
            foulsTotal: s.foulsTotal,
            plusMinus: s.plusMinus,
            per: s.per,
            trueShootingPct: s.trueShootingPct,
            winShares: s.winShares,
            bpm: s.bpm,
          })
          .onConflictDoUpdate({
            target: [
              playerSeasonStats.playerId,
              playerSeasonStats.teamId,
              playerSeasonStats.leagueId,
              playerSeasonStats.seasonId,
            ],
            set: {
              gamesPlayed: s.gamesPlayed,
              minutesTotal: s.minutesTotal,
              pointsTotal: s.pointsTotal,
              reboundsTotal: s.reboundsTotal,
              assistsTotal: s.assistsTotal,
              stealsTotal: s.stealsTotal,
              blocksTotal: s.blocksTotal,
              fgMade: s.fgMade,
              fgAttempted: s.fgAttempted,
              threeMade: s.threeMade,
              threeAttempted: s.threeAttempted,
              ftMade: s.ftMade,
              ftAttempted: s.ftAttempted,
              offensiveRebounds: s.offensiveRebounds,
              defensiveRebounds: s.defensiveRebounds,
              foulsTotal: s.foulsTotal,
              plusMinus: s.plusMinus,
              per: s.per,
              trueShootingPct: s.trueShootingPct,
              winShares: s.winShares,
              bpm: s.bpm,
            },
          })
        totals.stats++
      }

      /* ---- Coaches ---- */
      const usedCoachSlugs = new Set<string>()
      for (const sc of sourceCoaches) {
        const teamId = sc.teamSourceId
          ? (teamIdBySourceId.get(sc.teamSourceId) ?? null)
          : null
        if (!teamId) continue
        const baseSlug =
          sc.fullName.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "coach"
        const slug = (() => {
          let candidate = baseSlug
          let i = 2
          while (usedCoachSlugs.has(candidate)) {
            candidate = `${baseSlug}-${i++}`
          }
          usedCoachSlugs.add(candidate)
          return candidate
        })()
        await db
          .insert(coaches)
          .values({
            leagueId,
            teamId,
            fullName: sc.fullName,
            slug,
            role: sc.role,
            nationality: sc.nationality ?? null,
            age: sc.age ?? null,
            // PHOTOS PAUSED (2026-07-03): photoUrl: sc.photoUrl ?? null,
          })
          .onConflictDoUpdate({
            target: [coaches.teamId, coaches.leagueId, coaches.slug],
            set: {
              fullName: sc.fullName,
              role: sc.role,
              nationality: sc.nationality ?? null,
              age: sc.age ?? null,
              // PHOTOS PAUSED (2026-07-03): photoUrl: sc.photoUrl ?? null,
            },
          })
        totals.coaches++
      }

      /* ---- Team Stats ---- */
      for (const ts of sourceTeamStats) {
        const teamId = teamIdBySourceId.get(ts.teamSourceId)
        if (!teamId) continue
        await db
          .insert(teamSeasonStats)
          .values({
            teamId,
            seasonId,
            leagueId,
            gamesPlayed: ts.gamesPlayed,
            wins: ts.wins,
            losses: ts.losses,
            winPct: ts.winPct ?? null,
            pointsFor: ts.pointsFor ?? null,
            pointsAgainst: ts.pointsAgainst ?? null,
            position: ts.position ?? null,
            pace: ts.pace ?? null,
            offRtg: ts.offRtg ?? null,
            defRtg: ts.defRtg ?? null,
            netRtg: ts.netRtg ?? null,
            sos: ts.sos ?? null,
          })
          .onConflictDoUpdate({
            target: [
              teamSeasonStats.teamId,
              teamSeasonStats.seasonId,
              teamSeasonStats.leagueId,
            ],
            set: {
              gamesPlayed: ts.gamesPlayed,
              wins: ts.wins,
              losses: ts.losses,
              winPct: ts.winPct ?? null,
              pointsFor: ts.pointsFor ?? null,
              pointsAgainst: ts.pointsAgainst ?? null,
              position: ts.position ?? null,
              pace: ts.pace ?? null,
              offRtg: ts.offRtg ?? null,
              defRtg: ts.defRtg ?? null,
              netRtg: ts.netRtg ?? null,
              sos: ts.sos ?? null,
            },
          })
        totals.teamStats++
      }
    }) // end transaction — all league writes commit together or not at all

    /* ---- Finalize ---- */
    const rowsWritten =
      totals.teams +
      totals.players +
      totals.stats +
      totals.coaches +
      totals.teamStats
    const finishedAt = new Date()
    await db
      .update(syncRuns)
      .set({ finishedAt, status: "ok", rowsWritten })
      .where(eq(syncRuns.id, run.id))

    return {
      source: adapter.id,
      status: "ok",
      durationMs: Date.now() - started,
      rowsWritten,
      totals,
    }
  } catch (err) {
    const finishedAt = new Date()
    const message = err instanceof Error ? err.message : String(err)
    await db
      .update(syncRuns)
      .set({ finishedAt, status: "failed", error: message })
      .where(eq(syncRuns.id, run.id))
    return {
      source: adapter.id,
      status: "failed",
      durationMs: Date.now() - started,
      rowsWritten: 0,
      error: message,
      totals,
    }
  }
}

export function summarizeDb() {
  const db = getDb()
  return Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(leagues),
    db.select({ count: sql<number>`count(*)` }).from(teams),
    db.select({ count: sql<number>`count(*)` }).from(players),
    db.select({ count: sql<number>`count(*)` }).from(playerSeasonStats),
    db.select({ count: sql<number>`count(*)` }).from(coaches),
    db.select({ count: sql<number>`count(*)` }).from(teamSeasonStats),
  ]).then(([l, t, p, s, c, ts]) => ({
    leagues: Number(l[0]?.count ?? 0),
    teams: Number(t[0]?.count ?? 0),
    players: Number(p[0]?.count ?? 0),
    stats: Number(s[0]?.count ?? 0),
    coaches: Number(c[0]?.count ?? 0),
    teamStats: Number(ts[0]?.count ?? 0),
  }))
}

export function shutdown() {
  closeDb()
}
