import { NextResponse } from "next/server"
import { and, eq, sql } from "drizzle-orm"
import { getDb } from "@/lib/db/client"
import { newId, pushSubscriptions, userSettings } from "@/lib/db/schema"
import { authed, badRequest, readJson, str } from "@/lib/workspace/http"
import { isValidPushEndpoint, pushEnabled, vapidPublicKey } from "@/lib/alerts/push"

export const dynamic = "force-dynamic"

const MAX_DEVICES = 10

/** GET → { enabled, publicKey, emailAlerts } — what the alerts settings need. */
export async function GET(request: Request) {
  const a = await authed(request, "push")
  if ("response" in a) return a.response
  const db = getDb()
  const settings = (
    await db
      .select({ emailAlerts: userSettings.emailAlerts })
      .from(userSettings)
      .where(eq(userSettings.userId, a.user.id))
      .limit(1)
  )[0]
  const [{ devices }] = await db
    .select({ devices: sql<number>`count(*)` })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, a.user.id))
  return NextResponse.json({
    enabled: pushEnabled(),
    publicKey: vapidPublicKey(),
    devices: Number(devices),
    emailAlerts: settings?.emailAlerts ?? true,
  })
}

/**
 * POST { subscription: PushSubscriptionJSON } — register this device.
 * POST { emailAlerts: boolean }               — toggle the email digest.
 */
export async function POST(request: Request) {
  const a = await authed(request, "push-write", 20, 0.2)
  if ("response" in a) return a.response
  const body = await readJson<{
    subscription?: { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } }
    emailAlerts?: unknown
  }>(request)
  if (!body) return badRequest("Invalid body.")
  const db = getDb()

  if (typeof body.emailAlerts === "boolean") {
    await db
      .insert(userSettings)
      .values({ userId: a.user.id, emailAlerts: body.emailAlerts })
      .onDuplicateKeyUpdate({ set: { emailAlerts: body.emailAlerts, updatedAt: new Date() } })
    return NextResponse.json({ ok: true, emailAlerts: body.emailAlerts })
  }

  if (!pushEnabled()) return NextResponse.json({ error: "Push is not configured." }, { status: 501 })
  const sub = body.subscription
  const endpoint = sub?.endpoint
  const p256dh = str(sub?.keys?.p256dh, 200)
  const auth = str(sub?.keys?.auth, 100)
  if (!isValidPushEndpoint(endpoint) || !p256dh || !auth) return badRequest("Invalid subscription.")

  const [{ devices }] = await db
    .select({ devices: sql<number>`count(*)` })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, a.user.id))
  if (Number(devices) >= MAX_DEVICES) {
    return NextResponse.json({ error: "Too many devices." }, { status: 409 })
  }

  // The endpoint is unique per browser: re-subscribing moves it to this user.
  await db
    .insert(pushSubscriptions)
    .values({ id: newId(), userId: a.user.id, endpoint, p256dh, auth })
    .onDuplicateKeyUpdate({ set: { userId: a.user.id, p256dh, auth } })
  return NextResponse.json({ ok: true }, { status: 201 })
}

/** DELETE { endpoint } — unregister this device. */
export async function DELETE(request: Request) {
  const a = await authed(request, "push-write", 20, 0.2)
  if ("response" in a) return a.response
  const body = await readJson<{ endpoint?: unknown }>(request)
  if (!body || typeof body.endpoint !== "string") return badRequest("Invalid body.")
  await getDb()
    .delete(pushSubscriptions)
    .where(and(eq(pushSubscriptions.userId, a.user.id), eq(pushSubscriptions.endpoint, body.endpoint)))
  return NextResponse.json({ ok: true })
}
