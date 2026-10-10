import { NextResponse } from "next/server"
import { desc, eq } from "drizzle-orm"
import { getDb } from "@/lib/db/client"
import { apiClients, newId, users } from "@/lib/db/schema"
import { getCurrentUser, isAdmin } from "@/lib/auth/current-user"
import { generateApiKey } from "@/lib/api/keys"
import { badRequest, isUuid, readJson, str } from "@/lib/workspace/http"

export const dynamic = "force-dynamic"

async function admin(request: Request) {
  const user = await getCurrentUser(request.headers.get("cookie"))
  if (!user) return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  if (!isAdmin(user)) return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  return { user }
}

export async function GET(request: Request) {
  const a = await admin(request)
  if ("response" in a) return a.response
  const rows = await getDb()
    .select({
      id: apiClients.id,
      name: apiClients.name,
      keyPrefix: apiClients.keyPrefix,
      dailyQuota: apiClients.dailyQuota,
      lastUsedAt: apiClients.lastUsedAt,
      revokedAt: apiClients.revokedAt,
      createdAt: apiClients.createdAt,
      ownerEmail: users.email,
    })
    .from(apiClients)
    .innerJoin(users, eq(apiClients.userId, users.id))
    .orderBy(desc(apiClients.createdAt))
  return NextResponse.json({ clients: rows })
}

/**
 * POST { ownerEmail, name, dailyQuota } → the plaintext key, ONCE. Only its
 * hash is stored; a lost key is revoked and reissued, never recovered.
 */
export async function POST(request: Request) {
  const a = await admin(request)
  if ("response" in a) return a.response
  const body = await readJson(request)
  const name = str(body?.name, 120)
  const email = typeof body?.ownerEmail === "string" ? body.ownerEmail.trim().toLowerCase() : ""
  const quota = Math.round(Number(body?.dailyQuota ?? 1000))
  if (!name || !email) return badRequest("name and ownerEmail are required.")
  if (!Number.isFinite(quota) || quota < 10 || quota > 1_000_000) return badRequest("dailyQuota must be 10-1,000,000.")
  const db = getDb()
  const owner = (await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1))[0]
  if (!owner) return badRequest("No account with that email.")
  const { key, prefix, hash } = await generateApiKey()
  const id = newId()
  await db.insert(apiClients).values({ id, userId: owner.id, name, keyPrefix: prefix, keyHash: hash, dailyQuota: quota })
  return NextResponse.json({ id, key, keyPrefix: prefix }, { status: 201, headers: { "Cache-Control": "no-store" } })
}

/** PATCH { id, dailyQuota } */
export async function PATCH(request: Request) {
  const a = await admin(request)
  if ("response" in a) return a.response
  const body = await readJson(request)
  const quota = Math.round(Number(body?.dailyQuota))
  if (!isUuid(body?.id) || !Number.isFinite(quota) || quota < 10 || quota > 1_000_000) {
    return badRequest("id and a dailyQuota of 10-1,000,000 are required.")
  }
  await getDb().update(apiClients).set({ dailyQuota: quota }).where(eq(apiClients.id, body.id))
  return NextResponse.json({ ok: true })
}

/** DELETE ?id= — revoke (kept for the audit trail). */
export async function DELETE(request: Request) {
  const a = await admin(request)
  if ("response" in a) return a.response
  const id = new URL(request.url).searchParams.get("id")
  if (!isUuid(id)) return badRequest("Invalid id.")
  await getDb().update(apiClients).set({ revokedAt: new Date() }).where(eq(apiClients.id, id))
  return NextResponse.json({ ok: true })
}
