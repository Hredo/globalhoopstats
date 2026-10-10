/**
 * Web push delivery. Optional: without VAPID keys in the environment push is
 * not offered at all and alerts still arrive in-app and by email.
 */
import webpush from "web-push"
import { eq, inArray } from "drizzle-orm"
import { getDb } from "@/lib/db/client"
import { pushSubscriptions } from "@/lib/db/schema"
import { getServerEnv } from "@/lib/env"

let configured: boolean | null = null

export function pushEnabled(): boolean {
  if (configured !== null) return configured
  const env = getServerEnv()
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return (configured = false)
  webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY)
  return (configured = true)
}

export function vapidPublicKey(): string | null {
  return getServerEnv().VAPID_PUBLIC_KEY ?? null
}

export type PushPayload = { title: string; body: string; href: string }

/**
 * Send to every device of a user. Subscriptions the push service reports as
 * gone (404/410) are deleted so we stop paying for them on every run.
 */
export async function pushToUser(userId: string, payload: PushPayload): Promise<number> {
  if (!pushEnabled()) return 0
  const db = getDb()
  const subs = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId))
  const gone: string[] = []
  let sent = 0
  for (const s of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload),
        { TTL: 24 * 3600 },
      )
      sent++
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode
      if (status === 404 || status === 410) gone.push(s.id)
      else console.warn("[push] send failed:", status ?? err)
    }
  }
  if (gone.length) await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.id, gone))
  return sent
}

/**
 * The server POSTs to whatever endpoint a browser registered, so an endpoint is
 * accepted only on the push services browsers actually use. Anything else would
 * turn the alerts job into a request-forgery relay towards arbitrary hosts.
 */
const PUSH_HOSTS = [
  /^fcm\.googleapis\.com$/,
  /^updates\.push\.services\.mozilla\.com$/,
  /^[a-z0-9.-]+\.notify\.windows\.com$/,
  /^web\.push\.apple\.com$/,
  /^[a-z0-9.-]+\.push\.apple\.com$/,
]

export function isValidPushEndpoint(endpoint: unknown): endpoint is string {
  if (typeof endpoint !== "string" || endpoint.length > 768) return false
  try {
    const u = new URL(endpoint)
    return (
      u.protocol === "https:" &&
      u.port === "" &&
      !u.username &&
      PUSH_HOSTS.some((re) => re.test(u.hostname))
    )
  } catch {
    return false
  }
}
