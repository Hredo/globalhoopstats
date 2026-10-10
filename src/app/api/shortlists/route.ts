import { NextResponse } from "next/server"
import { eq, sql } from "drizzle-orm"
import { getDb } from "@/lib/db/client"
import { newId, shortlists } from "@/lib/db/schema"
import { authed, badRequest, readJson, str } from "@/lib/workspace/http"
import { listShortlistsFor, MAX_LISTS_PER_USER } from "@/lib/workspace/shortlists"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const a = await authed(request, "shortlists")
  if ("response" in a) return a.response
  return NextResponse.json({ shortlists: await listShortlistsFor(a.user.id) })
}

/** POST { name, description? } */
export async function POST(request: Request) {
  const a = await authed(request, "shortlists-write", 30, 0.5)
  if ("response" in a) return a.response
  const body = await readJson(request)
  const name = str(body?.name, 120)
  if (!name) return badRequest("A name of 1-120 characters is required.")
  const description = body?.description == null ? null : str(body.description, 1000)

  const db = getDb()
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)` })
    .from(shortlists)
    .where(eq(shortlists.ownerId, a.user.id))
  if (Number(n) >= MAX_LISTS_PER_USER) {
    return NextResponse.json({ error: "Shortlist limit reached." }, { status: 409 })
  }
  const id = newId()
  await db.insert(shortlists).values({ id, ownerId: a.user.id, name, description })
  return NextResponse.json({ id }, { status: 201 })
}
