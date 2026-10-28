import { NextResponse } from "next/server"
import { listTeamOptions } from "@/lib/data/teams"
import {
  clientIp,
  jsonTooManyRequests,
  readRateLimit,
} from "@/lib/security/ai-advisor"

// Every league's current clubs fit comfortably; the cap only guards the payload.
const MAX_OPTIONS = 1000

export async function GET(req: Request) {
  const ip = clientIp(req)
  const limit = readRateLimit(ip, "teams-options")
  if (!limit.ok) return jsonTooManyRequests(limit.retryAfterSec)

  try {
    const teams = await listTeamOptions(MAX_OPTIONS)
    return NextResponse.json(teams)
  } catch (error) {
    console.error("Error fetching team options:", error)
    return NextResponse.json(
      { error: "Failed to fetch teams" },
      { status: 500 },
    )
  }
}
