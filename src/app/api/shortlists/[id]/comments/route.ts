import { NextResponse } from "next/server"
import { and, eq } from "drizzle-orm"
import { getDb } from "@/lib/db/client"
import { newId, shortlistComments, shortlistItems, shortlists } from "@/lib/db/schema"
import { authed, badRequest, isUuid, notFound, readJson } from "@/lib/workspace/http"
import { shortlistAccess, shortlistAudience, touchShortlist } from "@/lib/workspace/shortlists"
import { notifyUsers } from "@/lib/alerts/notify"

export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

/** POST { body, itemId? } — any member, viewers included, can comment. */
export async function POST(request: Request, { params }: Ctx) {
  const a = await authed(request, "shortlists-comment", 20, 0.3)
  if ("response" in a) return a.response
  const { id } = await params
  if (!isUuid(id)) return notFound()
  if (!(await shortlistAccess(a.user.id, id))) return notFound()
  const payload = await readJson(request)
  const text = typeof payload?.body === "string" ? payload.body.trim() : ""
  if (text.length < 1 || text.length > 2000) return badRequest("A comment of 1-2000 characters is required.")

  const db = getDb()
  let itemId: string | null = null
  if (payload?.itemId != null) {
    if (!isUuid(payload.itemId)) return badRequest("Invalid item.")
    const item = (
      await db
        .select({ id: shortlistItems.id })
        .from(shortlistItems)
        .where(and(eq(shortlistItems.id, payload.itemId), eq(shortlistItems.shortlistId, id)))
        .limit(1)
    )[0]
    if (!item) return badRequest("Invalid item.")
    itemId = item.id
  }

  const commentId = newId()
  await db.insert(shortlistComments).values({ id: commentId, shortlistId: id, itemId, userId: a.user.id, body: text })
  await touchShortlist(id)

  const list = (await db.select({ name: shortlists.name }).from(shortlists).where(eq(shortlists.id, id)))[0]
  const preview = text.length > 140 ? `${text.slice(0, 139)}…` : text
  await notifyUsers(await shortlistAudience(id, a.user.id), `/shortlists/${id}`, (locale) => ({
    kind: "shortlist_comment",
    title:
      locale === "es"
        ? `${a.user.name} ha comentado en «${list?.name ?? ""}»`
        : `${a.user.name} commented on “${list?.name ?? ""}”`,
    body: preview,
  }))
  return NextResponse.json({ id: commentId }, { status: 201 })
}

/** DELETE ?commentId= — the author removes their own comment. */
export async function DELETE(request: Request, { params }: Ctx) {
  const a = await authed(request, "shortlists-comment", 20, 0.3)
  if ("response" in a) return a.response
  const { id } = await params
  const commentId = new URL(request.url).searchParams.get("commentId")
  if (!isUuid(id) || !isUuid(commentId)) return badRequest("Invalid comment.")
  await getDb()
    .delete(shortlistComments)
    .where(
      and(
        eq(shortlistComments.id, commentId),
        eq(shortlistComments.shortlistId, id),
        eq(shortlistComments.userId, a.user.id),
      ),
    )
  return NextResponse.json({ ok: true })
}
