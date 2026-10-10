import { authed } from "@/lib/workspace/http"
import { csvResponse, exportLeagueSeason } from "@/lib/workspace/export"
import { leagueSlugsFor } from "@/lib/league-groups"
import { resolveSeasonName } from "@/lib/data/seasons"
import { SOURCE_IDS } from "@/lib/sources"

export const dynamic = "force-dynamic"

/**
 * GET ?league=acb|feb|…&season=2026-27&excel=1 → CSV of every player line.
 *
 * Signed-in only, and throttled hard: an export is the whole catalogue of a
 * league in one request, which is exactly what a scraper of OUR data wants.
 */
export async function GET(request: Request) {
  const a = await authed(request, "export", 6, 0.05)
  if ("response" in a) return a.response
  const url = new URL(request.url)
  const league = url.searchParams.get("league")
  const wanted = leagueSlugsFor(league) ?? [...SOURCE_IDS]
  const slugs = wanted.filter((s) => (SOURCE_IDS as readonly string[]).includes(s))
  if (slugs.length === 0) return new Response("Unknown league.", { status: 400 })
  const season = await resolveSeasonName(url.searchParams.get("season"), slugs.length === 1 ? slugs[0] : undefined)
  const excel = url.searchParams.get("excel") === "1"
  const csv = await exportLeagueSeason(slugs, season, { separator: excel ? ";" : "," })
  return csvResponse(csv, `globalhoopstats-${league ?? "all"}-${season}.csv`)
}
