import { NextResponse } from "next/server"
import { desc, eq, sql } from "drizzle-orm"
import { getDb } from "@/lib/db/client"
import { playbookPlays } from "@/lib/db/schema"
import { getCurrentUser } from "@/lib/auth/current-user"
import { parsePlay } from "@/lib/playbook/types"
import {
  clientIp,
  jsonTooManyRequests,
  readRateLimit,
} from "@/lib/security/ai-advisor"

export const dynamic = "force-dynamic"

/** Hard cap on a single play document (jsonb) to keep rows small. */
export const MAX_PLAY_BYTES = 250_000
const MAX_PLAYS_PER_USER = 200

export async function GET(request: Request) {
  const ip = clientIp(request)
  const limit = readRateLimit(ip, "playbooks")
  if (!limit.ok) return jsonTooManyRequests(limit.retryAfterSec)

  const user = await getCurrentUser(request.headers.get("cookie"))
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 })
  }

  const db = getDb()
  const rows = await db
    .select({
      id: playbookPlays.id,
      name: playbookPlays.name,
      data: playbookPlays.data,
      updatedAt: playbookPlays.updatedAt,
    })
    .from(playbookPlays)
    .where(eq(playbookPlays.userId, user.id))
    .orderBy(desc(playbookPlays.updatedAt))
    .limit(MAX_PLAYS_PER_USER)

  return NextResponse.json({
    plays: rows.map((r) => ({
      id: r.id,
      name: r.name,
      data: r.data,
      updatedAt: r.updatedAt.toISOString(),
    })),
  })
}

export async function POST(request: Request) {
  const ip = clientIp(request)
  const limit = readRateLimit(ip, "playbooks-write", 30, 0.5)
  if (!limit.ok) return jsonTooManyRequests(limit.retryAfterSec)

  const user = await getCurrentUser(request.headers.get("cookie"))
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
  }

  const play = parsePlay((body as { play?: unknown })?.play)
  if (!play) {
    return NextResponse.json({ error: "Invalid play document." }, { status: 400 })
  }
  if (JSON.stringify(play).length > MAX_PLAY_BYTES) {
    return NextResponse.json({ error: "Play too large." }, { status: 413 })
  }

  const db = getDb()
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(playbookPlays)
    .where(eq(playbookPlays.userId, user.id))
  if (count >= MAX_PLAYS_PER_USER) {
    return NextResponse.json(
      { error: `Play limit reached (${MAX_PLAYS_PER_USER}).` },
      { status: 409 },
    )
  }

  const [row] = await db
    .insert(playbookPlays)
    .values({ userId: user.id, name: play.name, data: play })
    .returning({ id: playbookPlays.id, updatedAt: playbookPlays.updatedAt })

  return NextResponse.json({
    id: row.id,
    updatedAt: row.updatedAt.toISOString(),
  })
}
