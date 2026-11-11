import { NextResponse } from "next/server"
import {
  rankByQuery,
  searchPlayersAutocomplete,
  type AutocompleteOptions,
  type AutocompleteSort,
} from "@/lib/data/players"
import {
  clientIp,
  jsonTooManyRequests,
  readRateLimit,
} from "@/lib/security/ai-advisor"
import { parseSeasonParam } from "@/lib/seasons"
import { LEAGUE_FILTER_VALUES } from "@/lib/league-groups"
import { requestLeagueScope } from "@/lib/gender-server"

export const dynamic = "force-dynamic"

const SORTS: AutocompleteSort[] = ["points", "assists", "rebounds", "name"]
const MAX_Q_LEN = 100
const MAX_LIMIT = 30

function parseSort(v: string | null): AutocompleteSort {
  return SORTS.includes(v as AutocompleteSort)
    ? (v as AutocompleteSort)
    : "points"
}

function parseLeague(v: string | null): string | undefined {
  if (!v) return undefined
  return LEAGUE_FILTER_VALUES.has(v) ? v : undefined
}

export async function GET(req: Request) {
  const ip = clientIp(req)
  const limit = readRateLimit(ip, "players-search")
  if (!limit.ok) return jsonTooManyRequests(limit.retryAfterSec)

  const url = new URL(req.url)
  const rawQ = url.searchParams.get("q") ?? ""
  const q = rawQ.slice(0, MAX_Q_LEN)
  const picked = parseLeague(url.searchParams.get("league"))
  // No league picked: search the side the visitor is browsing (cookie), so the
  // palette and every picker built on this route follow the gender switch.
  const league = requestLeagueScope(req, picked)
  const sort = parseSort(url.searchParams.get("sort"))
  const rawLimit = Number(url.searchParams.get("limit") ?? 12)
  const cappedLimit = Math.min(
    Math.max(Number.isFinite(rawLimit) ? rawLimit : 12, 1),
    MAX_LIMIT,
  )

  // Undefined resolves to the newest season in the data layer, which is what
  // every picker in the app should show by default.
  const season = parseSeasonParam(url.searchParams.get("season"))
  const options: AutocompleteOptions = {
    league,
    sort,
    limit: cappedLimit,
    season,
  }
  const results =
    q.length >= 1
      ? rankByQuery(await searchPlayersAutocomplete(q, options), q)
      : await searchPlayersAutocomplete(q, options)

  return NextResponse.json({
    results,
    q,
    league: picked ?? null,
    sort,
    season: season ?? null,
  })
}
