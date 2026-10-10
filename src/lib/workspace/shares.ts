/**
 * Read-only public links to a player report, a shortlist or a play.
 *
 * The token is the whole credential: 32 random bytes, base64url. Links always
 * expire, can be revoked, and the page they open is noindex and shows only what
 * the owner chose to share — never emails, members or private notes beyond the
 * note written for the link itself.
 */
import { randomBytes } from "node:crypto"
import { and, eq, gt, isNull, sql } from "drizzle-orm"
import { getDb } from "@/lib/db/client"
import { newId, playbookPlays, players, sharedLinks, shortlists } from "@/lib/db/schema"
import { SITE } from "@/lib/site"

export const SHARE_KINDS = ["player", "shortlist", "play"] as const
export type ShareKind = (typeof SHARE_KINDS)[number]
export const isShareKind = (v: unknown): v is ShareKind =>
  typeof v === "string" && (SHARE_KINDS as readonly string[]).includes(v)

export const SHARE_DAYS = [7, 30, 90] as const
export const MAX_ACTIVE_SHARES = 100

const TOKEN = /^[A-Za-z0-9_-]{43}$/
export const isShareToken = (v: unknown): v is string => typeof v === "string" && TOKEN.test(v)

export const shareUrl = (token: string) => `${SITE.url}/s/${token}`

export async function createShare(input: {
  userId: string
  kind: ShareKind
  targetId: string
  note: string | null
  days: number
}): Promise<{ id: string; token: string; url: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url")
  const expiresAt = new Date(Date.now() + input.days * 86_400_000)
  const id = newId()
  await getDb().insert(sharedLinks).values({
    id,
    token,
    userId: input.userId,
    kind: input.kind,
    targetId: input.targetId,
    note: input.note,
    expiresAt,
  })
  return { id, token, url: shareUrl(token), expiresAt }
}

/** Resolve what a user is allowed to share into a target id. */
export async function resolveShareTarget(
  userId: string,
  kind: ShareKind,
  ref: string,
): Promise<string | null> {
  const db = getDb()
  if (kind === "player") {
    const p = (await db.select({ id: players.id }).from(players).where(eq(players.slug, ref)).limit(1))[0]
    return p?.id ?? null
  }
  if (kind === "play") {
    const p = (
      await db
        .select({ id: playbookPlays.id })
        .from(playbookPlays)
        .where(and(eq(playbookPlays.id, ref), eq(playbookPlays.userId, userId)))
        .limit(1)
    )[0]
    return p?.id ?? null
  }
  // A shortlist can be shared by anyone who can see it; the share shows the
  // list, never its members.
  const { shortlistAccess } = await import("@/lib/workspace/shortlists")
  const access = await shortlistAccess(userId, ref)
  if (!access || access === "viewer") return null
  const s = (await db.select({ id: shortlists.id }).from(shortlists).where(eq(shortlists.id, ref)).limit(1))[0]
  return s?.id ?? null
}

export type OpenedShare =
  | { state: "ok"; kind: ShareKind; targetId: string; note: string | null; expiresAt: Date; ownerId: string }
  | { state: "expired" | "revoked" | "missing" }

export async function openShare(token: string, countView = true): Promise<OpenedShare> {
  if (!isShareToken(token)) return { state: "missing" }
  const db = getDb()
  const row = (await db.select().from(sharedLinks).where(eq(sharedLinks.token, token)).limit(1))[0]
  if (!row) return { state: "missing" }
  if (row.revokedAt) return { state: "revoked" }
  if (row.expiresAt.getTime() < Date.now()) return { state: "expired" }
  if (countView) {
    await db
      .update(sharedLinks)
      .set({ viewCount: sql`${sharedLinks.viewCount} + 1` })
      .where(eq(sharedLinks.id, row.id))
  }
  return {
    state: "ok",
    kind: isShareKind(row.kind) ? row.kind : "player",
    targetId: row.targetId,
    note: row.note,
    expiresAt: row.expiresAt,
    ownerId: row.userId,
  }
}

export async function activeShareCount(userId: string): Promise<number> {
  const [{ n }] = await getDb()
    .select({ n: sql<number>`count(*)` })
    .from(sharedLinks)
    .where(
      and(
        eq(sharedLinks.userId, userId),
        isNull(sharedLinks.revokedAt),
        gt(sharedLinks.expiresAt, new Date()),
      ),
    )
  return Number(n)
}
