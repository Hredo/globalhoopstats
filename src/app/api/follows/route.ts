import { NextResponse } from "next/server"
import { and, desc, eq, sql } from "drizzle-orm"
import { getDb } from "@/lib/db/client"
import { follows, newId } from "@/lib/db/schema"
import { authed, badRequest, isSlug, isUuid, notFound, readJson } from "@/lib/workspace/http"
import { isFollowKind, targetById, targetBySlug } from "@/lib/alerts/targets"
import { sanitizeThresholds } from "@/lib/alerts/diff"
import { initialSnapshot } from "@/lib/alerts/engine"

export const dynamic = "force-dynamic"

const MAX_FOLLOWS = 300

/**
 * GET                      → every follow of the user, with name + link
 * GET ?kind=player&slug=x  → { following, id, thresholds } for one target
 */
export async function GET(request: Request) {
  const a = await authed(request, "follows")
  if ("response" in a) return a.response
  const db = getDb()
  const url = new URL(request.url)
  const kind = url.searchParams.get("kind")
  const slug = url.searchParams.get("slug")

  if (kind || slug) {
    if (!isFollowKind(kind) || !isSlug(slug)) return badRequest("Invalid target.")
    const target = await targetBySlug(kind, slug)
    if (!target) return notFound()
    const row = (
      await db
        .select({ id: follows.id, thresholds: follows.thresholds })
        .from(follows)
        .where(and(eq(follows.userId, a.user.id), eq(follows.kind, kind), eq(follows.targetId, target.id)))
        .limit(1)
    )[0]
    return NextResponse.json({ following: !!row, id: row?.id ?? null, thresholds: row?.thresholds ?? null })
  }

  const rows = await db
    .select()
    .from(follows)
    .where(eq(follows.userId, a.user.id))
    .orderBy(desc(follows.createdAt))
    .limit(MAX_FOLLOWS)
  const items = []
  for (const r of rows) {
    const kindOf = isFollowKind(r.kind) ? r.kind : "player"
    const target = await targetById(kindOf, r.targetId)
    if (!target) continue
    items.push({
      id: r.id,
      kind: kindOf,
      name: target.name,
      href: target.href,
      imageUrl: target.imageUrl,
      thresholds: r.thresholds ?? null,
      snapshot: r.snapshot ?? null,
      createdAt: r.createdAt.toISOString(),
    })
  }
  return NextResponse.json({ follows: items })
}

/** POST { kind, slug, thresholds? } — follow (idempotent). */
export async function POST(request: Request) {
  const a = await authed(request, "follows-write", 30, 0.5)
  if ("response" in a) return a.response
  const body = await readJson(request)
  if (!body || !isFollowKind(body.kind) || !isSlug(body.slug)) return badRequest("Invalid target.")
  const target = await targetBySlug(body.kind, body.slug)
  if (!target) return notFound()

  const db = getDb()
  const existing = (
    await db
      .select({ id: follows.id })
      .from(follows)
      .where(and(eq(follows.userId, a.user.id), eq(follows.kind, body.kind), eq(follows.targetId, target.id)))
      .limit(1)
  )[0]
  if (existing) return NextResponse.json({ id: existing.id, following: true })

  const [{ n }] = await db
    .select({ n: sql<number>`count(*)` })
    .from(follows)
    .where(eq(follows.userId, a.user.id))
  if (Number(n) >= MAX_FOLLOWS) {
    return NextResponse.json({ error: "Follow limit reached." }, { status: 409 })
  }

  const id = newId()
  await db.insert(follows).values({
    id,
    userId: a.user.id,
    kind: body.kind,
    targetId: target.id,
    thresholds: sanitizeThresholds(body.thresholds),
    // Baseline now, so the first nightly run only reports real changes.
    snapshot: await initialSnapshot(body.kind, target.id),
  })
  return NextResponse.json({ id, following: true }, { status: 201 })
}

/** PATCH { id, thresholds } */
export async function PATCH(request: Request) {
  const a = await authed(request, "follows-write", 30, 0.5)
  if ("response" in a) return a.response
  const body = await readJson(request)
  if (!body || !isUuid(body.id)) return badRequest("Invalid follow.")
  const thresholds = sanitizeThresholds(body.thresholds)
  const db = getDb()
  const res = await db
    .update(follows)
    .set({ thresholds })
    .where(and(eq(follows.id, body.id), eq(follows.userId, a.user.id)))
  const affected = (res as unknown as [{ affectedRows?: number }])[0]?.affectedRows ?? 1
  if (!affected) return notFound()
  return NextResponse.json({ ok: true, thresholds })
}

/** DELETE ?id= */
export async function DELETE(request: Request) {
  const a = await authed(request, "follows-write", 30, 0.5)
  if ("response" in a) return a.response
  const id = new URL(request.url).searchParams.get("id")
  if (!isUuid(id)) return badRequest("Invalid follow.")
  await getDb()
    .delete(follows)
    .where(and(eq(follows.id, id), eq(follows.userId, a.user.id)))
  return NextResponse.json({ ok: true, following: false })
}
