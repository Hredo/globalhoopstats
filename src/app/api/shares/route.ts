import { NextResponse } from "next/server"
import { and, desc, eq } from "drizzle-orm"
import { getDb } from "@/lib/db/client"
import { sharedLinks } from "@/lib/db/schema"
import { authed, badRequest, isUuid, notFound, readJson, str } from "@/lib/workspace/http"
import {
  activeShareCount,
  createShare,
  isShareKind,
  MAX_ACTIVE_SHARES,
  resolveShareTarget,
  SHARE_DAYS,
  shareUrl,
} from "@/lib/workspace/shares"

export const dynamic = "force-dynamic"

/** GET → the user's links (active and past), newest first. */
export async function GET(request: Request) {
  const a = await authed(request, "shares")
  if ("response" in a) return a.response
  const url = new URL(request.url)
  const kind = url.searchParams.get("kind")
  const target = url.searchParams.get("target")
  const rows = await getDb()
    .select()
    .from(sharedLinks)
    .where(eq(sharedLinks.userId, a.user.id))
    .orderBy(desc(sharedLinks.createdAt))
    .limit(200)
  const now = Date.now()
  return NextResponse.json({
    shares: rows
      .filter((r) => (!kind || r.kind === kind) && (!target || r.targetId === target))
      .map((r) => ({
        id: r.id,
        kind: r.kind,
        targetId: r.targetId,
        url: shareUrl(r.token),
        note: r.note,
        views: r.viewCount,
        expiresAt: r.expiresAt.toISOString(),
        active: !r.revokedAt && r.expiresAt.getTime() > now,
        createdAt: r.createdAt.toISOString(),
      })),
  })
}

/** POST { kind, ref, note?, days } — ref is a player slug, a play id or a shortlist id. */
export async function POST(request: Request) {
  const a = await authed(request, "shares-write", 20, 0.2)
  if ("response" in a) return a.response
  const body = await readJson(request)
  if (!body || !isShareKind(body.kind) || typeof body.ref !== "string" || body.ref.length > 191) {
    return badRequest("Invalid share.")
  }
  const days = SHARE_DAYS.includes(Number(body.days) as (typeof SHARE_DAYS)[number]) ? Number(body.days) : 30
  const note = body.note == null || body.note === "" ? null : str(body.note, 1000)
  if (body.note && !note) return badRequest("The note is too long.")
  if ((await activeShareCount(a.user.id)) >= MAX_ACTIVE_SHARES) {
    return NextResponse.json({ error: "Too many active links." }, { status: 409 })
  }
  const targetId = await resolveShareTarget(a.user.id, body.kind, body.ref)
  if (!targetId) return notFound()
  const share = await createShare({ userId: a.user.id, kind: body.kind, targetId, note, days })
  return NextResponse.json(
    { id: share.id, url: share.url, expiresAt: share.expiresAt.toISOString() },
    { status: 201 },
  )
}

/** DELETE ?id= — revoke. */
export async function DELETE(request: Request) {
  const a = await authed(request, "shares-write", 20, 0.2)
  if ("response" in a) return a.response
  const id = new URL(request.url).searchParams.get("id")
  if (!isUuid(id)) return badRequest("Invalid link.")
  await getDb()
    .update(sharedLinks)
    .set({ revokedAt: new Date() })
    .where(and(eq(sharedLinks.id, id), eq(sharedLinks.userId, a.user.id)))
  return NextResponse.json({ ok: true })
}
