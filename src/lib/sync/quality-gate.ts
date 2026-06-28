import { sql } from "drizzle-orm"
import { getDb } from "@/lib/db/client"
import type {
  ExtractedPlayerStat,
  SourcePlayer,
  SourceTeam,
} from "@/lib/sources/types"

/**
 * Data-quality gate for scraped ingestion.
 *
 * Scraping's worst failure mode is silent: a source changes its HTML, the
 * parser returns blanks or a partial page, and a naive sync happily overwrites
 * good, fresh data with garbage. For a product whose whole value is "the
 * numbers are right and up to date", that single event destroys trust.
 *
 * The gate runs after a league's batch is fetched but BEFORE anything is
 * written. If the batch looks broken — empty, mostly-blank, or a sharp
 * regression against the last good data — it blocks the write and alerts,
 * leaving yesterday's correct data in place.
 */

export class QualityGateError extends Error {
  constructor(
    message: string,
    public readonly reasons: string[],
  ) {
    super(message)
    this.name = "QualityGateError"
  }
}

export type ScrapeBatch = {
  teams: SourceTeam[]
  players: SourcePlayer[]
  stats: ExtractedPlayerStat[]
}

export type GateVerdict = {
  ok: boolean
  reasons: string[]
  /** Stat-line count already stored for this league+season (the baseline). */
  baseline: number
}

/** Need a real prior baseline before a "the data shrank" check means anything. */
const MIN_BASELINE_FOR_SHRINK_CHECK = 20
/** Reject if the new batch holds fewer than this fraction of the baseline. */
const MAX_SHRINK_RATIO = 0.5
/** Reject if at least this share of played stat lines are completely blank. */
const MAX_EMPTY_STAT_SHARE = 0.85

/** A played game with every core counter null/zero is the signature of a
 *  broken parser, not a real performance. */
function isEmptyStatLine(s: ExtractedPlayerStat): boolean {
  if (s.gamesPlayed <= 0) return false
  const core = [s.pointsTotal, s.reboundsTotal, s.assistsTotal, s.minutesTotal]
  return core.every((v) => v == null || v === 0)
}

/**
 * Pure verdict given a batch and the stored baseline. Separated from the DB
 * read so the rules can be unit-tested deterministically.
 */
export function judgeBatch(batch: ScrapeBatch, baseline: number): GateVerdict {
  const reasons: string[] = []

  /* 1. Hard floors: a batch missing a whole structural layer is broken. */
  if (batch.teams.length === 0) reasons.push("0 teams scraped")
  if (batch.players.length === 0) reasons.push("0 players scraped")
  if (batch.stats.length === 0) reasons.push("0 stat lines scraped")

  /* 2. Blank-line share: parser returning empty rows for played games. */
  const played = batch.stats.filter((s) => s.gamesPlayed > 0)
  if (played.length > 0) {
    const empty = played.filter(isEmptyStatLine).length
    const share = empty / played.length
    if (share >= MAX_EMPTY_STAT_SHARE) {
      reasons.push(
        `${(share * 100).toFixed(0)}% of played stat lines are blank — parser likely broke`,
      )
    }
  }

  /* 3. Regression vs. last good data: never replace a healthy league with a
        half-empty scrape (source outage, markup change, partial fetch…). */
  if (
    baseline >= MIN_BASELINE_FOR_SHRINK_CHECK &&
    batch.stats.length < baseline * MAX_SHRINK_RATIO
  ) {
    reasons.push(
      `stat lines collapsed from ${baseline} to ${batch.stats.length} ` +
        `(>${((1 - MAX_SHRINK_RATIO) * 100).toFixed(0)}% loss vs. last good sync)`,
    )
  }

  return { ok: reasons.length === 0, reasons, baseline }
}

export async function evaluateScrape(
  leagueId: string,
  seasonId: string,
  batch: ScrapeBatch,
): Promise<GateVerdict> {
  const db = getDb()
  const rows = (await db.execute(sql`
    SELECT count(*)::int AS n
    FROM player_season_stats
    WHERE league_id = ${leagueId} AND season_id = ${seasonId}
  `)) as unknown as { n: number }[]
  const baseline = Number(rows[0]?.n ?? 0)
  return judgeBatch(batch, baseline)
}

/**
 * Surface a blocked sync loudly. Always logs a prominent banner; if
 * SCRAPER_ALERT_WEBHOOK is set (Slack/Discord-style incoming webhook), also
 * posts there so a broken source pages someone instead of failing in silence.
 */
export async function alertQualityGate(
  league: string,
  reasons: string[],
): Promise<void> {
  const msg =
    `🚨 [quality-gate] BLOCKED "${league}" — kept existing data. ` +
    `Reasons: ${reasons.join("; ")}`
  console.error(
    "\n========================================\n" +
      msg +
      "\n========================================\n",
  )
  const webhook = process.env.SCRAPER_ALERT_WEBHOOK?.trim()
  if (!webhook) return
  try {
    await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: msg }),
    })
  } catch (err) {
    console.error(
      `[quality-gate] alert webhook failed: ${(err as Error).message}`,
    )
  }
}
