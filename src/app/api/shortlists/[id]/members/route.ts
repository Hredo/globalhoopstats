import { NextResponse } from "next/server"
import { and, eq, sql } from "drizzle-orm"
import { getDb } from "@/lib/db/client"
import { newId, shortlistMembers, shortlists, users } from "@/lib/db/schema"
import { authed, badRequest, forbidden, isUuid, notFound, readJson } from "@/lib/workspace/http"
import { MAX_MEMBERS_PER_LIST, shortlistAccess } from "@/lib/workspace/shortlists"
import { notifyUsers } from "@/lib/alerts/notify"

export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * POST { email, role } — owner invites an existing account.
 *
 * Deliberately answers the same way whether or not the address has an account,
 * so the invite form cannot be used to find out who is registered.
 */
export async function POST(request: Request, { params }: Ctx) {
  const a = await authed(request, "shortlists-invite", 10, 0.1)
  if ("response" in a) return a.response
  const { id } = await params
  if (!isUuid(id)) return notFound()
  if ((await shortlistAccess(a.user.id, id)) !== "owner") return forbidden()
  const body = await readJson(request)
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : ""
  if (!EMAIL.test(email) || email.length > 255) return badRequest("Invalid email.")
  const role = body?.role === "viewer" ? "viewer" : "editor"

  const db = getDb()
  const generic = NextResponse.json({
    ok: true,
    message: "If that address has an account, it now has access.",
  })
  const invitee = (await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1))[0]
  if (!invitee || invitee.id === a.user.id) return generic

  const [{ n }] = await db
    .select({ n: sql<number>`count(*)` })
    .from(shortlistMembers)
    .where(eq(shortlistMembers.shortlistId, id))
  if (Number(n) >= MAX_MEMBERS_PER_LIST) {
    return NextResponse.json({ error: "Member limit reached." }, { status: 409 })
  }

  const existed = (
    await db
      .select({ id: shortlistMembers.id })
      .from(shortlistMembers)
      .where(and(eq(shortlistMembers.shortlistId, id), eq(shortlistMembers.userId, invitee.id)))
      .limit(1)
  )[0]
  await db
    .insert(shortlistMembers)
    .values({ id: newId(), shortlistId: id, userId: invitee.id, role })
    .onDuplicateKeyUpdate({ set: { role } })

  if (!existed) {
    const list = (await db.select({ name: shortlists.name }).from(shortlists).where(eq(shortlists.id, id)))[0]
    await notifyUsers([invitee.id], `/shortlists/${id}`, (locale) => ({
      kind: "shortlist_invite",
      title:
        locale === "es"
          ? `${a.user.name} te ha añadido a «${list?.name ?? ""}»`
          : `${a.user.name} added you to “${list?.name ?? ""}”`,
      body: locale === "es" ? "Ya puedes verla y trabajar en ella." : "You can now open it and work on it.",
    }))
  }
  return generic
}

/** PATCH { userId, role } — owner changes a member's role. */
export async function PATCH(request: Request, { params }: Ctx) {
  const a = await authed(request, "shortlists-write", 30, 0.5)
  if ("response" in a) return a.response
  const { id } = await params
  if (!isUuid(id)) return notFound()
  if ((await shortlistAccess(a.user.id, id)) !== "owner") return forbidden()
  const body = await readJson(request)
  if (!body || !isUuid(body.userId)) return badRequest("Invalid member.")
  const role = body.role === "viewer" ? "viewer" : "editor"
  await getDb()
    .update(shortlistMembers)
    .set({ role })
    .where(and(eq(shortlistMembers.shortlistId, id), eq(shortlistMembers.userId, body.userId)))
  return NextResponse.json({ ok: true })
}

/** DELETE ?userId= — owner removes a member, or a member leaves. */
export async function DELETE(request: Request, { params }: Ctx) {
  const a = await authed(request, "shortlists-write", 30, 0.5)
  if ("response" in a) return a.response
  const { id } = await params
  if (!isUuid(id)) return notFound()
  const userId = new URL(request.url).searchParams.get("userId")
  if (!isUuid(userId)) return badRequest("Invalid member.")
  const access = await shortlistAccess(a.user.id, id)
  if (!access) return notFound()
  if (access !== "owner" && userId !== a.user.id) return forbidden()
  await getDb()
    .delete(shortlistMembers)
    .where(and(eq(shortlistMembers.shortlistId, id), eq(shortlistMembers.userId, userId)))
  return NextResponse.json({ ok: true })
}
