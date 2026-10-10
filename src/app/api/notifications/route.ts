import { NextResponse } from "next/server"
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm"
import { getDb } from "@/lib/db/client"
import { notifications } from "@/lib/db/schema"
import { authed, badRequest, isUuid, readJson } from "@/lib/workspace/http"

export const dynamic = "force-dynamic"

/** GET ?limit=20 → { unread, items } — polled by the navbar bell. */
export async function GET(request: Request) {
  const a = await authed(request, "notifications", 120, 2)
  if ("response" in a) return a.response
  const limit = Math.min(50, Math.max(1, Number(new URL(request.url).searchParams.get("limit")) || 20))
  const db = getDb()
  const [{ unread }] = await db
    .select({ unread: sql<number>`count(*)` })
    .from(notifications)
    .where(and(eq(notifications.userId, a.user.id), isNull(notifications.readAt)))
  const rows = await db
    .select({
      id: notifications.id,
      kind: notifications.kind,
      title: notifications.title,
      body: notifications.body,
      href: notifications.href,
      readAt: notifications.readAt,
      createdAt: notifications.createdAt,
    })
    .from(notifications)
    .where(eq(notifications.userId, a.user.id))
    .orderBy(desc(notifications.createdAt))
    .limit(limit)
  return NextResponse.json(
    {
      unread: Number(unread),
      items: rows.map((r) => ({
        ...r,
        readAt: r.readAt?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
      })),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  )
}

/** POST { ids: string[] } or { all: true } — mark as read. */
export async function POST(request: Request) {
  const a = await authed(request, "notifications-write", 60, 1)
  if ("response" in a) return a.response
  const body = await readJson<{ ids?: unknown; all?: unknown }>(request)
  if (!body) return badRequest("Invalid body.")
  const db = getDb()
  const mine = and(eq(notifications.userId, a.user.id), isNull(notifications.readAt))
  if (body.all === true) {
    await db.update(notifications).set({ readAt: new Date() }).where(mine)
    return NextResponse.json({ ok: true })
  }
  const ids = Array.isArray(body.ids) ? body.ids.filter(isUuid).slice(0, 100) : []
  if (ids.length === 0) return badRequest("No notifications given.")
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(mine, inArray(notifications.id, ids)))
  return NextResponse.json({ ok: true })
}
