/**
 * Direct notifications (shortlist invites, comments), as opposed to the nightly
 * follow alerts. Written in each recipient's language and pushed right away;
 * the email digest picks them up on the next alerts run.
 */
import { inArray } from "drizzle-orm"
import { getDb } from "@/lib/db/client"
import { newId, notifications, userSettings } from "@/lib/db/schema"
import { isLocale, type Locale } from "@/lib/i18n/config"
import { pushToUser } from "@/lib/alerts/push"

export async function notifyUsers(
  userIds: string[],
  href: string,
  render: (locale: Locale) => { kind: string; title: string; body: string },
): Promise<void> {
  if (userIds.length === 0) return
  const db = getDb()
  const settings = await db
    .select({ userId: userSettings.userId, locale: userSettings.locale })
    .from(userSettings)
    .where(inArray(userSettings.userId, userIds))
  const locale = new Map(settings.map((s) => [s.userId, isLocale(s.locale) ? s.locale : "es"] as const))
  for (const userId of userIds) {
    const n = render(locale.get(userId) ?? "es")
    await db.insert(notifications).values({ id: newId(), userId, href, ...n })
    // Push is best-effort and must never fail the request that caused it.
    void pushToUser(userId, { title: n.title, body: n.body, href }).catch(() => {})
  }
}
