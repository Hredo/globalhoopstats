import pLimit from "p-limit"
import { and, eq, lt, sql } from "drizzle-orm"
import { getDb } from "@/lib/db/client"
import {
  coaches,
  leagues,
  newId,
  playerSeasonStats,
  players,
  seasons,
  syncRuns,
  teams,
} from "@/lib/db/schema"
import { SOURCES, SOURCE_IDS } from "@/lib/sources"
import type {
  ExtractedPlayerStat,
  SourceAdapter,
  SourceId,
  SourceTeam,
} from "@/lib/sources/types"
import { EntityMatcher, type MatcherStats } from "@/lib/sync/entity-matcher"
import {
  alertQualityGate,
  evaluateScrape,
  QualityGateError,
} from "@/lib/sync/quality-gate"
import { revalidateCacheTags } from "@/lib/sync/revalidate"
import { slugify, uniqueSlug } from "@/lib/sync/slug"
import { tierForName, tierForSlug, type LeagueTier } from "@/lib/leagues-tier"
import { isSyncCancelled } from "@/lib/sync/controller"

/**
 * Central ingestion orchestrator: runs every league adapter (NBA, EuroLeague,
 * ACB and the three FEB competitions) through the same pipeline —
 * scrape → entity-match players via Ollama → ensure teams → upsert stats.
 *
 * Concurrency is capped at 2 leagues so the MySQL connection pool stays calm
 * and no source sees a burst of parallel traffic. Seasons, teams and the
 * player identity registry are shared across the parallel jobs, which is what
 * keeps a multi-league player (e.g. Edy Tavares) on a single players row.
 */

const MAX_CONCURRENT_LEAGUES = 2

/** A "running" sync row older than this is treated as orphaned and swept. */
const STALE_RUN_WINDOW_MS = 45 * 60_000

export type LeagueSyncTotals = {
  teams: number
  playersCreated: number
  playersReused: number
  statsUpserted: number
  statsSkipped: number
  coaches: number
}

export type LeagueSyncResult = {
  source: SourceId
  league: string
  status: "ok" | "failed"
  durationMs: number
  rowsWritten: number
  error?: string
  totals: LeagueSyncTotals
}

export type GlobalSyncReport = {
  durationMs: number
  results: LeagueSyncResult[]
  matcherStats: MatcherStats
}

type Db = ReturnType<typeof getDb>

type SyncContext = {
  db: Db
  matcher: EntityMatcher
  usedPlayerSlugs: Set<string>
  ensureSeason(code: string): Promise<string>
  ensureTeam(team: SourceTeam): Promise<string>
}

function emptyTotals(): LeagueSyncTotals {
  return {
    teams: 0,
    playersCreated: 0,
    playersReused: 0,
    statsUpserted: 0,
    statsSkipped: 0,
    coaches: 0,
  }
}

function statColumns(s: ExtractedPlayerStat) {
  return {
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
  }
}

async function syncLeague(
  adapter: SourceAdapter,
  ctx: SyncContext,
): Promise<LeagueSyncResult> {
  const { db, matcher } = ctx
  const tag = `[${adapter.displayName}]`
  const started = Date.now()
  const totals = emptyTotals()

  // sync_runs.id is AUTO_INCREMENT; $returningId reads back the insertId.
  const [run] = await db
    .insert(syncRuns)
    .values({ source: adapter.id, status: "running", rowsWritten: 0 })
    .$returningId()

  try {
    console.log(`${tag} sync started (season ${adapter.seasonCode})`)

    /* ---- League & season ---- */
    // Upsert, then read the id back: on a duplicate slug MySQL keeps the
    // existing row's id, so the generated one may not be the winner.
    await db
      .insert(leagues)
      .values({
        id: newId(),
        name: adapter.displayName,
        slug: adapter.id,
        region: adapter.country,
      })
      .onDuplicateKeyUpdate({
        set: { name: adapter.displayName, region: adapter.country },
      })
    const [league] = await db
      .select({ id: leagues.id })
      .from(leagues)
      .where(eq(leagues.slug, adapter.id))
      .limit(1)
    if (!league) throw new Error(`league ${adapter.id} vanished after upsert`)
    const leagueId = league.id
    const seasonId = await ctx.ensureSeason(adapter.seasonCode)

    /* ---- Fetch the full batch before writing anything ---- */
    // The quality gate needs to see teams, players and stats together and
    // compare them against the last good sync, so nothing is persisted until
    // the batch has been judged healthy.
    const sourceTeams = await adapter.fetchTeams()
    const sourcePlayers = await adapter.fetchPlayers()
    const sourceStats = await adapter.fetchStats()

    /* ---- Quality gate ---- */
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

    // Last checkpoint before any write: the scrape above is where a sync spends
    // its long "running" time, so a Stop pressed during it must leave the DB
    // untouched. Bail now — nothing below this line has run yet.
    if (await isSyncCancelled(started)) {
      throw new Error("cancelled by operator (before writes)")
    }

    /* ---- Teams ---- */
    const teamIdBySourceId = new Map<string, string>()
    for (const st of sourceTeams) {
      teamIdBySourceId.set(st.sourceId, await ctx.ensureTeam(st))
    }
    totals.teams = teamIdBySourceId.size
    console.log(`${tag} teams ready (${totals.teams})`)

    /* ---- Players (entity matching) ---- */
    const playerIdBySourceId = new Map<string, string>()
    for (const sp of sourcePlayers) {
      const decision = await matcher.resolve({
        fullName: sp.fullName,
        league: adapter.displayName,
        nationality: sp.nationality,
        position: sp.position,
        heightCm: sp.heightCm,
      })

      if (decision.kind === "existing") {
        const fillIns: Partial<typeof players.$inferInsert> = {}
        // PHOTOS PAUSED (2026-07-03): players render typographic avatars
        // (PersonAvatar); uncomment to resume photo ingestion.
        // if (sp.photoUrl) fillIns.imageUrl = sp.photoUrl
        if (sp.nationality) fillIns.nationality = sp.nationality
        if (sp.position) fillIns.position = sp.position
        if (sp.heightCm) fillIns.heightCm = sp.heightCm
        if (sp.weightKg) fillIns.weightKg = sp.weightKg
        if (Object.keys(fillIns).length > 0) {
          await db
            .update(players)
            .set(fillIns)
            .where(eq(players.id, decision.playerId))
        }
        playerIdBySourceId.set(sp.sourceId, decision.playerId)
        totals.playersReused++
        continue
      }

      const parts = sp.fullName.trim().split(/\s+/)
      const firstName = parts[0] ?? ""
      const lastName = parts.slice(1).join(" ") || firstName
      const baseSlug = slugify(sp.fullName) || `player-${sp.sourceId}`
      const slug = uniqueSlug(baseSlug, ctx.usedPlayerSlugs)

      const playerId = newId()
      await db.insert(players).values({
        id: playerId,
        firstName,
        lastName,
        slug,
        nationality: sp.nationality ?? null,
        position: sp.position ?? null,
        heightCm: sp.heightCm ?? null,
        weightKg: sp.weightKg ?? null,
        // PHOTOS PAUSED (2026-07-03): imageUrl: sp.photoUrl ?? null,
      })
      matcher.register(
        {
          id: playerId,
          fullName: sp.fullName,
          nationality: sp.nationality ?? null,
          position: sp.position ?? null,
          heightCm: sp.heightCm ?? null,
        },
        tierForName(adapter.displayName),
      )
      playerIdBySourceId.set(sp.sourceId, playerId)
      totals.playersCreated++
    }
    console.log(
      `${tag} players resolved (${sourcePlayers.length} — ` +
        `${totals.playersCreated} new / ${totals.playersReused} reused)`,
    )

    /* ---- Player season stats ---- */
    for (const stat of sourceStats) {
      const playerId = playerIdBySourceId.get(stat.playerSourceId)
      const teamId = stat.teamSourceId
        ? teamIdBySourceId.get(stat.teamSourceId)
        : undefined
      if (!playerId || !teamId) {
        totals.statsSkipped++
        continue
      }
      await db
        .insert(playerSeasonStats)
        .values({ playerId, teamId, leagueId, seasonId, ...statColumns(stat) })
        .onDuplicateKeyUpdate({
          set: statColumns(stat),
        })
      totals.statsUpserted++
    }
    console.log(
      `${tag} stats upserted (${totals.statsUpserted}, skipped ${totals.statsSkipped})`,
    )

    /* ---- Coaches ---- */
    const sourceCoaches = await adapter.fetchCoaches()
    // Same inline slug as run.ts (no accent stripping) so upserts land on the
    // coach rows previous syncs created instead of inserting near-duplicates.
    const usedCoachSlugs = new Set<string>()
    for (const sc of sourceCoaches) {
      const teamId = sc.teamSourceId
        ? teamIdBySourceId.get(sc.teamSourceId)
        : undefined
      if (!teamId) continue
      const baseSlug =
        sc.fullName.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "coach"
      let coachSlug = baseSlug
      let i = 2
      while (usedCoachSlugs.has(coachSlug)) coachSlug = `${baseSlug}-${i++}`
      usedCoachSlugs.add(coachSlug)
      await db
        .insert(coaches)
        .values({
          leagueId,
          teamId,
          fullName: sc.fullName,
          slug: coachSlug,
          role: sc.role,
          nationality: sc.nationality ?? null,
          age: sc.age ?? null,
          // PHOTOS PAUSED (2026-07-03): photoUrl: sc.photoUrl ?? null,
        })
        .onDuplicateKeyUpdate({
          set: {
            fullName: sc.fullName,
            role: sc.role,
            // Keep whatever a previous sync already filled when this source
            // has no value, instead of regressing the column to null.
            // Postgres names the proposed row `excluded`; MySQL reaches it with
            // values(column).
            nationality: sql`coalesce(values(${coaches.nationality}), ${coaches.nationality})`,
            age: sql`coalesce(values(${coaches.age}), ${coaches.age})`,
            // PHOTOS PAUSED (2026-07-03):
            // photoUrl: sql`coalesce(values(${coaches.photoUrl}), ${coaches.photoUrl})`,
          },
        })
      totals.coaches++
    }
    console.log(`${tag} coaches upserted (${totals.coaches})`)

    /* ---- Finalize ---- */
    const rowsWritten =
      totals.teams +
      totals.playersCreated +
      totals.playersReused +
      totals.statsUpserted +
      totals.coaches
    await db
      .update(syncRuns)
      .set({ finishedAt: new Date(), status: "ok", rowsWritten })
      .where(eq(syncRuns.id, run.id))

    const durationMs = Date.now() - started
    console.log(`${tag} ✓ done in ${(durationMs / 1000).toFixed(1)}s`)
    return {
      source: adapter.id,
      league: adapter.displayName,
      status: "ok",
      durationMs,
      rowsWritten,
      totals,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const durationMs = Date.now() - started
    console.error(
      `${tag} ✗ FAILED after ${(durationMs / 1000).toFixed(1)}s — ${message}`,
    )
    try {
      await db
        .update(syncRuns)
        .set({ finishedAt: new Date(), status: "failed", error: message })
        .where(eq(syncRuns.id, run.id))
    } catch {
      console.error(`${tag} could not record the failure in sync_runs`)
    }
    return {
      source: adapter.id,
      league: adapter.displayName,
      status: "failed",
      durationMs,
      rowsWritten: 0,
      error: message,
      totals,
    }
  }
}

export async function startGlobalSync(
  targets: SourceId[] = SOURCE_IDS,
  opts: { shouldCancel?: () => boolean } = {},
): Promise<GlobalSyncReport> {
  const shouldCancel = opts.shouldCancel ?? (() => false)
  const started = Date.now()
  const db = getDb()

  // Self-heal: close out orphaned "running" rows left by a previous process
  // that died mid-sync (crash, restart, Ctrl-C, aborted admin request). Without
  // this they pile up in the admin view forever and could block the cron's
  // overlap guard. Only rows older than the window are touched, so the current
  // run's own rows are never affected.
  const staleCutoff = new Date(Date.now() - STALE_RUN_WINDOW_MS)
  const staleFilter = and(
    eq(syncRuns.status, "running"),
    lt(syncRuns.startedAt, staleCutoff),
  )
  // MySQL has no UPDATE ... RETURNING, so the affected rows are counted from
  // the update result instead of collected from it.
  const [swept] = await db
    .update(syncRuns)
    .set({
      status: "failed",
      finishedAt: new Date(),
      error: "stale run (process ended before completion)",
    })
    .where(staleFilter)
  if (swept.affectedRows > 0) {
    console.log(
      `[orchestrator] swept ${swept.affectedRows} stale running sync rows`,
    )
  }

  console.log(
    `[orchestrator] global sync starting — leagues: ${targets.join(", ")} · ` +
      `concurrency: ${MAX_CONCURRENT_LEAGUES}`,
  )

  /* ---- Shared state: identity registry, slugs, team & season caches ---- */
  const existingPlayers = await db
    .select({
      id: players.id,
      firstName: players.firstName,
      lastName: players.lastName,
      slug: players.slug,
      nationality: players.nationality,
      position: players.position,
      heightCm: players.heightCm,
    })
    .from(players)
  // Each player's current league tiers, so the matcher never fuses a FEB
  // namesake into a top-tier professional (or vice versa) on a name collision.
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
  const matcher = new EntityMatcher(
    existingPlayers.map((p) => ({
      id: p.id,
      fullName: `${p.firstName} ${p.lastName}`.trim(),
      nationality: p.nationality,
      position: p.position,
      heightCm: p.heightCm,
      tiers: [...(tiersByPlayer.get(p.id) ?? [])],
    })),
  )
  const usedPlayerSlugs = new Set(existingPlayers.map((p) => p.slug))
  console.log(
    `[orchestrator] entity matcher primed with ${existingPlayers.length} known players · ` +
      `ollama ${matcher.llmAvailable ? "available" : "unavailable (deterministic fallback)"}`,
  )

  const existingTeams = await db
    .select({
      id: teams.id,
      slug: teams.slug,
      city: teams.city,
      logoUrl: teams.logoUrl,
      foundedYear: teams.foundedYear,
      website: teams.website,
      arena: teams.arena,
      primaryColor: teams.primaryColor,
      secondaryColor: teams.secondaryColor,
    })
    .from(teams)
  const teamStateBySlug = new Map(
    existingTeams.map((t) => [
      t.slug,
      {
        id: t.id,
        city: t.city,
        logoUrl: t.logoUrl,
        foundedYear: t.foundedYear,
        website: t.website,
        arena: t.arena,
        primaryColor: t.primaryColor,
        secondaryColor: t.secondaryColor,
      },
    ]),
  )
  const teamPromises = new Map<string, Promise<string>>()
  const seasonPromises = new Map<string, Promise<string>>()

  const ctx: SyncContext = {
    db,
    matcher,
    usedPlayerSlugs,
    // Memoized get-or-create so two leagues syncing in parallel can never
    // insert the same season ("2025-26" is shared by NBA, ACB and FEB).
    ensureSeason(code) {
      let pending = seasonPromises.get(code)
      if (!pending) {
        pending = (async () => {
          // The DB currently holds duplicate season rows per name (legacy
          // syncs); deterministically converge on the one with most stats.
          const existing = (await db.execute(
            sql`
              SELECT s.id
              FROM seasons s
              LEFT JOIN player_season_stats p ON p.season_id = s.id
              WHERE s.name = ${code}
              GROUP BY s.id
              ORDER BY count(p.id) DESC, s.id
              LIMIT 1
            `,
          )) as unknown as { id: string }[]
          if (existing[0]) return existing[0].id
          const seasonId = newId()
          await db
            .insert(seasons)
            .values({ id: seasonId, name: code, isCurrent: true })
          return seasonId
        })()
        seasonPromises.set(code, pending)
      }
      return pending
    },
    async ensureTeam(team) {
      const slug = slugify(team.name) || `team-${team.sourceId}`
      let pending = teamPromises.get(slug)
      if (!pending) {
        pending = (async () => {
          const cached = teamStateBySlug.get(slug)
          if (cached) return cached.id
          await db
            .insert(teams)
            .values({
              id: newId(),
              name: team.name,
              slug,
              city: team.city ?? null,
              logoUrl: team.logoUrl ?? null,
              foundedYear: team.foundedYear ?? null,
              website: team.websiteUrl ?? null,
              arena: team.arena ?? null,
              primaryColor: team.primaryColor ?? null,
              secondaryColor: team.secondaryColor ?? null,
            })
            .onDuplicateKeyUpdate({
              set: { name: team.name },
            })
          // Read back by slug, not by the generated id: when the upsert hits an
          // existing team the row keeps its original id.
          const [row] = await db
            .select({
              id: teams.id,
              city: teams.city,
              logoUrl: teams.logoUrl,
              foundedYear: teams.foundedYear,
              website: teams.website,
              arena: teams.arena,
              primaryColor: teams.primaryColor,
              secondaryColor: teams.secondaryColor,
            })
            .from(teams)
            .where(eq(teams.slug, slug))
            .limit(1)
          if (!row) throw new Error(`team ${slug} vanished after upsert`)
          teamStateBySlug.set(slug, {
            id: row.id,
            city: row.city,
            logoUrl: row.logoUrl,
            foundedYear: row.foundedYear,
            website: row.website,
            arena: row.arena,
            primaryColor: row.primaryColor,
            secondaryColor: row.secondaryColor,
          })
          return row.id
        })()
        teamPromises.set(slug, pending)
      }
      const id = await pending
      // Each league gets a chance to fill fields the others left null.
      const state = teamStateBySlug.get(slug)
      if (state) {
        const fills: Partial<typeof teams.$inferInsert> = {}
        if (team.city && !state.city) fills.city = team.city
        if (team.logoUrl && !state.logoUrl) fills.logoUrl = team.logoUrl
        if (team.foundedYear && !state.foundedYear) {
          fills.foundedYear = team.foundedYear
        }
        if (team.websiteUrl && !state.website) fills.website = team.websiteUrl
        if (team.arena && !state.arena) fills.arena = team.arena
        if (team.primaryColor && !state.primaryColor) {
          fills.primaryColor = team.primaryColor
        }
        if (team.secondaryColor && !state.secondaryColor) {
          fills.secondaryColor = team.secondaryColor
        }
        if (Object.keys(fills).length > 0) {
          await db.update(teams).set(fills).where(eq(teams.id, id))
          Object.assign(state, fills)
        }
      }
      return id
    },
  }

  /* ---- Run all leagues, max 2 at a time ---- */
  const limit = pLimit(MAX_CONCURRENT_LEAGUES)
  const results = await Promise.all(
    targets.map((id) =>
      limit(async (): Promise<LeagueSyncResult> => {
        // Cancellation is cooperative and checked between leagues: once a stop
        // is requested, queued leagues are skipped while in-flight ones finish.
        // Both the in-process flag and the cross-process DB sentinel count.
        if (shouldCancel() || (await isSyncCancelled(started))) {
          return {
            source: id,
            league: SOURCES[id].displayName,
            status: "failed",
            durationMs: 0,
            rowsWritten: 0,
            error: "cancelled by operator",
            totals: emptyTotals(),
          }
        }
        return syncLeague(SOURCES[id], ctx)
      }),
    ),
  )

  /* ---- Summary ---- */
  const durationMs = Date.now() - started
  const okCount = results.filter((r) => r.status === "ok").length
  console.log("[orchestrator] ── summary ──")
  for (const r of results) {
    console.log(
      r.status === "ok"
        ? `[orchestrator] ${r.league.padEnd(14)} ok     ${String(r.rowsWritten).padStart(6)} rows  ${(r.durationMs / 1000).toFixed(1)}s`
        : `[orchestrator] ${r.league.padEnd(14)} FAILED ${r.error}`,
    )
  }
  const ms = matcher.stats
  console.log(
    `[orchestrator] entity matcher — exact: ${ms.exactMatches} · ` +
      `no-candidates: ${ms.noCandidates} · ` +
      `ollama: ${ms.llmExisting + ms.llmNew} decisions (${ms.llmExisting} matched / ${ms.llmNew} new) · ` +
      `heuristic: ${ms.heuristicFallbacks} · errors: ${ms.llmErrors}`,
  )
  console.log(
    `[orchestrator] global sync finished in ${(durationMs / 1000).toFixed(1)}s — ` +
      `${okCount}/${results.length} leagues ok`,
  )

  if (okCount > 0) await revalidateCacheTags()

  return { durationMs, results, matcherStats: { ...matcher.stats } }
}
