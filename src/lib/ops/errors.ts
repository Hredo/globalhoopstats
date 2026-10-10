/**
 * Server error tracking without a third party: Next's onRequestError hook
 * (src/instrumentation.ts) lands here, errors are grouped by fingerprint into
 * `app_errors`, and the admin panel reads them. Nothing leaves the server, so
 * no DSN, no extra CSP origin and no visitor data shipped to a vendor.
 */
import { createHash } from "node:crypto"
import { desc, eq, sql } from "drizzle-orm"
import { getDb } from "@/lib/db/client"
import { appErrors, newId, users } from "@/lib/db/schema"
import { alwaysAdminEmails } from "@/lib/auth/current-user"
import { sendEmail } from "@/lib/email/send"
import { escapeHtml, h1, p, quote, renderEmail } from "@/lib/email/layout"
import { SITE } from "@/lib/site"

/** Strip what varies between occurrences of the same bug (ids, numbers). */
export function normalizeMessage(message: string): string {
  return message
    .split("\n")[0]!
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "<id>")
    .replace(/\d+/g, "<n>")
    .slice(0, 300)
}

export function errorFingerprint(kind: string, route: string | null, message: string): string {
  return createHash("sha256")
    .update(`${kind}|${route ?? ""}|${normalizeMessage(message)}`)
    .digest("hex")
}

/** Secrets that must never be persisted even if they end up in a message. */
function scrub(text: string): string {
  return text
    .replace(/(mysql|postgres(?:ql)?):\/\/[^\s@]+@/gi, "$1://***@")
    .replace(/\b(sk|pk|rk)_(live|test)_[A-Za-z0-9]{8,}/g, "$1_$2_***")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]{12,}/g, "Bearer ***")
}

export async function recordError(input: {
  kind: string
  route: string | null
  method: string | null
  error: unknown
}): Promise<void> {
  const err = input.error instanceof Error ? input.error : new Error(String(input.error))
  const message = scrub(err.message || err.name || "Unknown error").slice(0, 2000)
  const stack = err.stack ? scrub(err.stack).slice(0, 20_000) : null
  const digest = (err as { digest?: string }).digest?.slice(0, 64) ?? null
  const fingerprint = errorFingerprint(input.kind, input.route, message)
  const now = new Date()
  await getDb()
    .insert(appErrors)
    .values({
      id: newId(),
      fingerprint,
      kind: input.kind.slice(0, 32),
      route: input.route?.slice(0, 191) ?? null,
      method: input.method?.slice(0, 16) ?? null,
      message,
      stack,
      digest,
    })
    .onDuplicateKeyUpdate({
      set: { count: sql`${appErrors.count} + 1`, lastSeenAt: now, stack, digest, message },
    })
}

export async function recentErrors(limit = 100) {
  return getDb()
    .select({
      id: appErrors.id,
      kind: appErrors.kind,
      route: appErrors.route,
      method: appErrors.method,
      message: appErrors.message,
      stack: appErrors.stack,
      count: appErrors.count,
      firstSeenAt: appErrors.firstSeenAt,
      lastSeenAt: appErrors.lastSeenAt,
    })
    .from(appErrors)
    .orderBy(desc(appErrors.lastSeenAt))
    .limit(limit)
}

/** Email the admins when a league failed to sync, so a broken scrape is noticed. */
export async function alertSyncFailures(
  failures: Array<{ source: string; error: string }>,
  adminEmails: string[],
): Promise<void> {
  if (failures.length === 0 || adminEmails.length === 0) return
  const list = failures.map((f) => `${f.source}: ${scrub(f.error).slice(0, 400)}`).join("\n")
  await sendEmail({
    to: adminEmails,
    subject: `Sync fallido: ${failures.map((f) => f.source).join(", ")}`,
    html: renderEmail({
      preview: "Una o más ligas no se han sincronizado",
      locale: "es",
      content: [
        h1("La sincronización ha fallado"),
        p("La puerta de calidad ha protegido los datos buenos; no se ha sobrescrito nada. Detalle:"),
        quote(escapeHtml(list)),
        p(`Panel: <a href="${SITE.url}/admin">${SITE.url}/admin</a>`),
      ].join("\n"),
    }),
    text: `La sincronización ha fallado:\n${list}\n\n${SITE.url}/admin`,
  })
}

/** Every admin address: the built-in ones plus accounts with role=admin. */
export async function adminRecipients(): Promise<string[]> {
  const rows = await getDb().select({ email: users.email }).from(users).where(eq(users.role, "admin"))
  return [...new Set([...alwaysAdminEmails(), ...rows.map((r) => r.email.toLowerCase())])]
}
