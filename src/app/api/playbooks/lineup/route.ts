import { NextResponse } from "next/server"
import { clientIp, jsonTooManyRequests, readRateLimit } from "@/lib/security/ai-advisor"
import { isSlug } from "@/lib/workspace/http"
import { lineupStats } from "@/lib/playbook/lineup"

export const dynamic = "force-dynamic"

/** GET ?slugs=a,b,c — season lines of the players linked to a play (max 10). */
export async function GET(request: Request) {
  const limit = readRateLimit(clientIp(request), "playbook-lineup", 30, 0.5)
  if (!limit.ok) return jsonTooManyRequests(limit.retryAfterSec)
  const slugs = (new URL(request.url).searchParams.get("slugs") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(isSlug)
    .slice(0, 10)
  if (slugs.length === 0) return NextResponse.json({ members: [], totals: { pts: 0, reb: 0, ast: 0 } })
  return NextResponse.json(await lineupStats(slugs))
}
