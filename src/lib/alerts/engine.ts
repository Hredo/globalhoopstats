/**
 * The alerts run: after every data sync, compare each followed player/team with
 * the snapshot stored on the follow, write notifications for what changed, and
 * deliver them (in-app always, web push and an email digest when enabled).
 *
 * One snapshot per target per run, however many users follow it.
 */
import { and, eq, inArray, isNull } from "drizzle-orm"
import { getDb } from "@/lib/db/client"
import {
  follows,
  newId,
  notifications,
  users,
  userSettings,
  type FollowSnapshot,
} from "@/lib/db/schema"
import { diffPlayer, diffTeam, type AlertEvent } from "@/lib/alerts/diff"
import { playerNames, playerSnapshot, teamSnapshot } from "@/lib/alerts/snapshot"
import { renderAlert, digestSubject } from "@/lib/alerts/messages"
import { targetById, type FollowKind } from "@/lib/alerts/targets"
import { pushToUser } from "@/lib/alerts/push"
import { sendEmail } from "@/lib/email/send"
import { button, escapeHtml, h1, muted, p, renderEmail } from "@/lib/email/layout"
import { SITE } from "@/lib/site"
import { isLocale, type Locale } from "@/lib/i18n/config"

export type AlertsResult = { follows: number; notifications: number; pushed: number; emailed: number }

/** A notification body never lists more than this many names. */
const MAX_NAMES = 6

export async function runAlerts(): Promise<AlertsResult> {
  const db = getDb()
  const rows = await db.select().from(follows)
  const result: AlertsResult = { follows: rows.length, notifications: 0, pushed: 0, emailed: 0 }
  if (rows.length === 0) return result

  const locales = new Map(
    (
      await db
        .select({ userId: userSettings.userId, locale: userSettings.locale })
        .from(userSettings)
        .where(inArray(userSettings.userId, [...new Set(rows.map((r) => r.userId))]))
    ).map((r) => [r.userId, isLocale(r.locale) ? r.locale : "es"] as const),
  )

  const snapshots = new Map<string, FollowSnapshot | null>()
  const snap = async (kind: FollowKind, id: string) => {
    const key = `${kind}:${id}`
    if (!snapshots.has(key)) {
      snapshots.set(key, kind === "player" ? await playerSnapshot(id) : await teamSnapshot(id))
    }
    return snapshots.get(key) ?? null
  }

  const created = new Map<string, Array<{ title: string; body: string; href: string }>>()

  for (const f of rows) {
    const kind = f.kind as FollowKind
    const next = await snap(kind, f.targetId)
    if (!next) continue
    const prev = f.snapshot ?? null

    let events: AlertEvent[] = []
    if (next.kind === "player") {
      events = diffPlayer(prev?.kind === "player" ? prev : null, next, f.thresholds ?? null)
    } else {
      events = diffTeam(prev?.kind === "team" ? prev : null, next)
    }

    if (events.length) {
      const target = await targetById(kind, f.targetId)
      if (target) {
        const ids = events.flatMap((e) =>
          e.type === "roster_in" || e.type === "roster_out" ? e.playerIds : [],
        )
        const names = await playerNames(ids)
        const nameList = (list: string[]) => {
          const shown = list.map((id) => names.get(id) ?? "—").slice(0, MAX_NAMES)
          const more = list.length - shown.length
          return more > 0 ? `${shown.join(", ")} +${more}` : shown.join(", ")
        }
        const locale: Locale = locales.get(f.userId) ?? "es"
        for (const e of events) {
          const r = renderAlert(e, target.name, locale, nameList)
          await db.insert(notifications).values({
            id: newId(),
            userId: f.userId,
            kind: r.kind,
            title: r.title,
            body: r.body,
            href: target.href,
          })
          result.notifications++
          const list = created.get(f.userId) ?? []
          list.push({ title: r.title, body: r.body, href: target.href })
          created.set(f.userId, list)
        }
      }
    }

    // Always store the fresh snapshot: the next run diffs against tonight.
    await db.update(follows).set({ snapshot: next }).where(eq(follows.id, f.id))
  }

  for (const [userId, list] of created) {
    for (const n of list) {
      result.pushed += await pushToUser(userId, n)
    }
  }
  result.emailed = await sendDigests(locales)
  return result
}

/** One email per user with everything not yet emailed, if they want email. */
async function sendDigests(locales: Map<string, Locale>): Promise<number> {
  const db = getDb()
  const pending = await db
    .select({
      id: notifications.id,
      userId: notifications.userId,
      title: notifications.title,
      body: notifications.body,
      href: notifications.href,
      email: users.email,
      wantsEmail: userSettings.emailAlerts,
    })
    .from(notifications)
    .innerJoin(users, eq(notifications.userId, users.id))
    .leftJoin(userSettings, eq(userSettings.userId, users.id))
    .where(and(isNull(notifications.emailedAt), isNull(notifications.readAt)))

  const byUser = new Map<string, typeof pending>()
  for (const n of pending) {
    // No settings row means the default, which is "email me".
    if (n.wantsEmail === false) continue
    const list = byUser.get(n.userId) ?? []
    list.push(n)
    byUser.set(n.userId, list)
  }

  let sent = 0
  for (const [userId, list] of byUser) {
    const locale = locales.get(userId) ?? "es"
    const items = list.slice(0, 20)
    const html = renderEmail({
      preview: digestSubject(list.length, locale),
      locale,
      content: [
        h1(escapeHtml(digestSubject(list.length, locale))),
        ...items.map(
          (n) =>
            `${p(`<strong>${escapeHtml(n.title)}</strong>${n.body ? `<br>${escapeHtml(n.body)}` : ""}`)}`,
        ),
        button(locale === "es" ? "Ver todo" : "See everything", `${SITE.url}/following`),
        muted(
          locale === "es"
            ? "Puedes desactivar estos correos en Siguiendo → Avisos."
            : "You can turn these emails off in Following → Alerts.",
        ),
      ].join("\n"),
    })
    const text = items
      .map((n) => `• ${n.title}${n.body ? ` — ${n.body}` : ""}\n  ${SITE.url}${n.href ?? ""}`)
      .join("\n")
    const ok = await sendEmail({
      to: list[0]!.email,
      subject: digestSubject(list.length, locale),
      html,
      text: `${text}\n\n${SITE.url}/following`,
    })
    if (ok) {
      await db
        .update(notifications)
        .set({ emailedAt: new Date() })
        .where(inArray(notifications.id, list.map((n) => n.id)))
      sent++
    }
  }
  return sent
}

/** Snapshot taken when a follow is created, so the first run has a baseline. */
export async function initialSnapshot(kind: FollowKind, id: string): Promise<FollowSnapshot | null> {
  return kind === "player" ? playerSnapshot(id) : teamSnapshot(id)
}
