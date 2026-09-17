import { NextResponse } from "next/server"
import { listSeasons } from "@/lib/data/seasons"
import {
  clientIp,
  jsonTooManyRequests,
  readRateLimit,
} from "@/lib/security/ai-advisor"

export const dynamic = "force-dynamic"

/**
 * Seasons that actually hold data, newest first.
 *
 * Client-side pickers (the playbook roster panel, anything else that has to
 * offer a season without a server render) read this instead of guessing from a
 * constant, so a season with no rows is never offered as an empty option.
 */
export async function GET(req: Request) {
  const ip = clientIp(req)
  const limit = readRateLimit(ip, "seasons-list")
  if (!limit.ok) return jsonTooManyRequests(limit.retryAfterSec)

  try {
    const seasons = await listSeasons()
    return NextResponse.json({ seasons: seasons.map((s) => s.name) })
  } catch (error) {
    console.error("seasons list error", error)
    // An empty list makes every picker fall back to "newest", which is the
    // behaviour with no season parameter at all — degraded, never broken.
    return NextResponse.json({ seasons: [] })
  }
}
