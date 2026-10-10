import { NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { getDb } from "@/lib/db/client"
import { shortlists } from "@/lib/db/schema"
import { authed, badRequest, forbidden, isUuid, notFound, readJson, str } from "@/lib/workspace/http"
import { canEdit, shortlistAccess, shortlistDetail, touchShortlist } from "@/lib/workspace/shortlists"

export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

export async function GET(request: Request, { params }: Ctx) {
  const a = await authed(request, "shortlists")
  if ("response" in a) return a.response
  const { id } = await params
  if (!isUuid(id)) return notFound()
  const access = await shortlistAccess(a.user.id, id)
  if (!access) return notFound()
  const detail = await shortlistDetail(id)
  if (!detail) return notFound()
  // Members' email addresses are for the owner, who manages the list.
  const members =
    access === "owner" ? detail.members : detail.members.map((m) => ({ ...m, email: null }))
  const owner = detail.owner && access !== "owner" ? { ...detail.owner, email: null } : detail.owner
  return NextResponse.json({ ...detail, members, owner, access, me: a.user.id })
}

/** PATCH { name?, description? } — editors and owner. */
export async function PATCH(request: Request, { params }: Ctx) {
  const a = await authed(request, "shortlists-write", 30, 0.5)
  if ("response" in a) return a.response
  const { id } = await params
  if (!isUuid(id)) return notFound()
  if (!canEdit(await shortlistAccess(a.user.id, id))) return forbidden()
  const body = await readJson(request)
  const set: { name?: string; description?: string | null } = {}
  if (body?.name !== undefined) {
    const name = str(body.name, 120)
    if (!name) return badRequest("A name of 1-120 characters is required.")
    set.name = name
  }
  if (body?.description !== undefined) {
    set.description = body.description == null || body.description === "" ? null : str(body.description, 1000)
  }
  if (Object.keys(set).length === 0) return badRequest("Nothing to update.")
  await getDb().update(shortlists).set(set).where(eq(shortlists.id, id))
  await touchShortlist(id)
  return NextResponse.json({ ok: true })
}

/** DELETE — owner only. */
export async function DELETE(request: Request, { params }: Ctx) {
  const a = await authed(request, "shortlists-write", 30, 0.5)
  if ("response" in a) return a.response
  const { id } = await params
  if (!isUuid(id)) return notFound()
  if ((await shortlistAccess(a.user.id, id)) !== "owner") return forbidden()
  await getDb().delete(shortlists).where(eq(shortlists.id, id))
  return NextResponse.json({ ok: true })
}
