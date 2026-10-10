import { NextResponse } from "next/server"
import { and, eq, sql } from "drizzle-orm"
import { getDb } from "@/lib/db/client"
import { newId, players, shortlistItems } from "@/lib/db/schema"
import { authed, badRequest, forbidden, isSlug, isUuid, notFound, readJson } from "@/lib/workspace/http"
import {
  canEdit,
  isStatus,
  MAX_ITEMS_PER_LIST,
  shortlistAccess,
  touchShortlist,
} from "@/lib/workspace/shortlists"

export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

async function gate(request: Request, params: Ctx["params"]) {
  const a = await authed(request, "shortlists-write", 60, 1)
  if ("response" in a) return { response: a.response }
  const { id } = await params
  if (!isUuid(id)) return { response: notFound() }
  const access = await shortlistAccess(a.user.id, id)
  if (!access) return { response: notFound() }
  if (!canEdit(access)) return { response: forbidden() }
  return { user: a.user, listId: id }
}

function note(value: unknown): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null || value === "") return null
  return typeof value === "string" ? value.trim().slice(0, 2000) || null : undefined
}

/** POST { slug, status?, note? } — add a player (idempotent). */
export async function POST(request: Request, { params }: Ctx) {
  const g = await gate(request, params)
  if ("response" in g) return g.response
  const body = await readJson(request)
  if (!body || !isSlug(body.slug)) return badRequest("Invalid player.")
  const db = getDb()
  const player = (await db.select({ id: players.id }).from(players).where(eq(players.slug, body.slug)).limit(1))[0]
  if (!player) return notFound()

  const existing = (
    await db
      .select({ id: shortlistItems.id })
      .from(shortlistItems)
      .where(and(eq(shortlistItems.shortlistId, g.listId), eq(shortlistItems.playerId, player.id)))
      .limit(1)
  )[0]
  if (existing) return NextResponse.json({ id: existing.id, added: false })

  const [{ n }] = await db
    .select({ n: sql<number>`count(*)` })
    .from(shortlistItems)
    .where(eq(shortlistItems.shortlistId, g.listId))
  if (Number(n) >= MAX_ITEMS_PER_LIST) {
    return NextResponse.json({ error: "This shortlist is full." }, { status: 409 })
  }

  const id = newId()
  await db.insert(shortlistItems).values({
    id,
    shortlistId: g.listId,
    playerId: player.id,
    status: isStatus(body.status) ? body.status : "watch",
    note: note(body.note) ?? null,
    addedBy: g.user.id,
  })
  await touchShortlist(g.listId)
  return NextResponse.json({ id, added: true }, { status: 201 })
}

/** PATCH { itemId, status?, note? } */
export async function PATCH(request: Request, { params }: Ctx) {
  const g = await gate(request, params)
  if ("response" in g) return g.response
  const body = await readJson(request)
  if (!body || !isUuid(body.itemId)) return badRequest("Invalid item.")
  const set: { status?: string; note?: string | null; updatedAt: Date } = { updatedAt: new Date() }
  if (body.status !== undefined) {
    if (!isStatus(body.status)) return badRequest("Invalid status.")
    set.status = body.status
  }
  const n = note(body.note)
  if (n !== undefined) set.note = n
  await getDb()
    .update(shortlistItems)
    .set(set)
    .where(and(eq(shortlistItems.id, body.itemId), eq(shortlistItems.shortlistId, g.listId)))
  await touchShortlist(g.listId)
  return NextResponse.json({ ok: true })
}

/** DELETE ?itemId= */
export async function DELETE(request: Request, { params }: Ctx) {
  const g = await gate(request, params)
  if ("response" in g) return g.response
  const itemId = new URL(request.url).searchParams.get("itemId")
  if (!isUuid(itemId)) return badRequest("Invalid item.")
  await getDb()
    .delete(shortlistItems)
    .where(and(eq(shortlistItems.id, itemId), eq(shortlistItems.shortlistId, g.listId)))
  await touchShortlist(g.listId)
  return NextResponse.json({ ok: true })
}
