import { NextResponse } from "next/server"
import { and, eq } from "drizzle-orm"
import { getDb } from "@/lib/db/client"
import { playbookPlays } from "@/lib/db/schema"
import { getCurrentUser } from "@/lib/auth/current-user"
import { parsePlay } from "@/lib/playbook/types"
import {
  clientIp,
  jsonTooManyRequests,
  readRateLimit,
} from "@/lib/security/ai-advisor"
import { MAX_PLAY_BYTES } from "../route"

export const dynamic = "force-dynamic"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Params = { params: Promise<{ id: string }> }

export async function PUT(request: Request, { params }: Params) {
  const ip = clientIp(request)
  const limit = readRateLimit(ip, "playbooks-write", 30, 0.5)
  if (!limit.ok) return jsonTooManyRequests(limit.retryAfterSec)

  const user = await getCurrentUser(request.headers.get("cookie"))
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 })
  }

  const { id } = await params
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 })
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
  const rows = await db
    .update(playbookPlays)
    .set({ name: play.name, data: play, updatedAt: new Date() })
    .where(and(eq(playbookPlays.id, id), eq(playbookPlays.userId, user.id)))
    .returning({ id: playbookPlays.id, updatedAt: playbookPlays.updatedAt })

  if (!rows[0]) {
    return NextResponse.json({ error: "Play not found." }, { status: 404 })
  }
  return NextResponse.json({
    id: rows[0].id,
    updatedAt: rows[0].updatedAt.toISOString(),
  })
}

export async function DELETE(request: Request, { params }: Params) {
  const ip = clientIp(request)
  const limit = readRateLimit(ip, "playbooks-write", 30, 0.5)
  if (!limit.ok) return jsonTooManyRequests(limit.retryAfterSec)

  const user = await getCurrentUser(request.headers.get("cookie"))
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 })
  }

  const { id } = await params
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 })
  }

  const db = getDb()
  const rows = await db
    .delete(playbookPlays)
    .where(and(eq(playbookPlays.id, id), eq(playbookPlays.userId, user.id)))
    .returning({ id: playbookPlays.id })

  if (!rows[0]) {
    return NextResponse.json({ error: "Play not found." }, { status: 404 })
  }
  return NextResponse.json({ ok: true })
}
