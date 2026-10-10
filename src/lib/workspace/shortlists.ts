/**
 * Collaborative shortlists: who may do what, and the detail read every view of
 * a list needs (items with the player's current line, members, comments).
 */
import { and, asc, desc, eq, inArray, or } from "drizzle-orm"
import { getDb } from "@/lib/db/client"
import {
  leagues,
  players,
  playerSeasonStats,
  seasons,
  shortlistComments,
  shortlistItems,
  shortlistMembers,
  shortlists,
  teams,
  users,
} from "@/lib/db/schema"
import { canonicalSeasonLabel, seasonStartYear } from "@/lib/seasons"

export const SHORTLIST_STATUSES = ["watch", "target", "contact", "discard"] as const
export type ShortlistStatus = (typeof SHORTLIST_STATUSES)[number]
export const isStatus = (v: unknown): v is ShortlistStatus =>
  typeof v === "string" && (SHORTLIST_STATUSES as readonly string[]).includes(v)

export type Access = "owner" | "editor" | "viewer"
export const MAX_LISTS_PER_USER = 50
export const MAX_ITEMS_PER_LIST = 200
export const MAX_MEMBERS_PER_LIST = 25

export async function shortlistAccess(userId: string, listId: string): Promise<Access | null> {
  const db = getDb()
  const list = (
    await db.select({ ownerId: shortlists.ownerId }).from(shortlists).where(eq(shortlists.id, listId)).limit(1)
  )[0]
  if (!list) return null
  if (list.ownerId === userId) return "owner"
  const m = (
    await db
      .select({ role: shortlistMembers.role })
      .from(shortlistMembers)
      .where(and(eq(shortlistMembers.shortlistId, listId), eq(shortlistMembers.userId, userId)))
      .limit(1)
  )[0]
  if (!m) return null
  return m.role === "viewer" ? "viewer" : "editor"
}

export const canEdit = (a: Access | null) => a === "owner" || a === "editor"

export async function listShortlistsFor(userId: string) {
  const db = getDb()
  const memberOf = db
    .select({ id: shortlistMembers.shortlistId })
    .from(shortlistMembers)
    .where(eq(shortlistMembers.userId, userId))
  const rows = await db
    .select({
      id: shortlists.id,
      name: shortlists.name,
      description: shortlists.description,
      ownerId: shortlists.ownerId,
      ownerName: users.name,
      updatedAt: shortlists.updatedAt,
    })
    .from(shortlists)
    .innerJoin(users, eq(shortlists.ownerId, users.id))
    .where(or(eq(shortlists.ownerId, userId), inArray(shortlists.id, memberOf)))
    .orderBy(desc(shortlists.updatedAt))
  if (rows.length === 0) return []
  const counts = await db
    .select({ id: shortlistItems.shortlistId, status: shortlistItems.status })
    .from(shortlistItems)
    .where(inArray(shortlistItems.shortlistId, rows.map((r) => r.id)))
  return rows.map((r) => {
    const mine = counts.filter((c) => c.id === r.id)
    return {
      ...r,
      updatedAt: r.updatedAt.toISOString(),
      shared: r.ownerId !== userId,
      items: mine.length,
      targets: mine.filter((c) => c.status === "target" || c.status === "contact").length,
    }
  })
}

export type ShortlistItemView = {
  id: string
  status: ShortlistStatus
  note: string | null
  addedBy: string | null
  updatedAt: string
  player: {
    id: string
    slug: string
    fullName: string
    position: string | null
    imageUrl: string | null
    age: string | null
    nationality: string | null
    heightCm: number | null
  }
  line: {
    league: string
    leagueSlug: string
    team: string | null
    season: string
    gamesPlayed: number
    ppg: number | null
    rpg: number | null
    apg: number | null
    per: number | null
  } | null
}

export async function shortlistDetail(listId: string) {
  const db = getDb()
  const list = (await db.select().from(shortlists).where(eq(shortlists.id, listId)).limit(1))[0]
  if (!list) return null

  const items = await db
    .select({
      id: shortlistItems.id,
      status: shortlistItems.status,
      note: shortlistItems.note,
      updatedAt: shortlistItems.updatedAt,
      addedBy: users.name,
      playerId: players.id,
      slug: players.slug,
      first: players.firstName,
      last: players.lastName,
      position: players.position,
      imageUrl: players.imageUrl,
      birthdate: players.birthdate,
      nationality: players.nationality,
      heightCm: players.heightCm,
    })
    .from(shortlistItems)
    .innerJoin(players, eq(shortlistItems.playerId, players.id))
    .leftJoin(users, eq(shortlistItems.addedBy, users.id))
    .where(eq(shortlistItems.shortlistId, listId))
    .orderBy(asc(shortlistItems.createdAt))

  const lines = items.length
    ? await db
        .select({
          playerId: playerSeasonStats.playerId,
          league: leagues.name,
          leagueSlug: leagues.slug,
          team: teams.name,
          season: seasons.name,
          gamesPlayed: playerSeasonStats.gamesPlayed,
          points: playerSeasonStats.pointsTotal,
          rebounds: playerSeasonStats.reboundsTotal,
          assists: playerSeasonStats.assistsTotal,
          per: playerSeasonStats.per,
        })
        .from(playerSeasonStats)
        .innerJoin(leagues, eq(playerSeasonStats.leagueId, leagues.id))
        .innerJoin(seasons, eq(playerSeasonStats.seasonId, seasons.id))
        .leftJoin(teams, eq(playerSeasonStats.teamId, teams.id))
        .where(inArray(playerSeasonStats.playerId, items.map((i) => i.playerId)))
    : []
  const latest = new Map<string, (typeof lines)[number]>()
  for (const l of lines) {
    const prev = latest.get(l.playerId)
    const y = seasonStartYear(l.season) ?? 0
    const py = prev ? (seasonStartYear(prev.season) ?? 0) : -1
    if (!prev || y > py || (y === py && (l.gamesPlayed ?? 0) > (prev.gamesPlayed ?? 0))) {
      latest.set(l.playerId, l)
    }
  }
  const pg = (t: number | null, g: number) => (t == null || g <= 0 ? null : Math.round((t / g) * 10) / 10)

  const itemViews: ShortlistItemView[] = items.map((i) => {
    const l = latest.get(i.playerId)
    const g = l?.gamesPlayed ?? 0
    return {
      id: i.id,
      status: isStatus(i.status) ? i.status : "watch",
      note: i.note,
      addedBy: i.addedBy,
      updatedAt: i.updatedAt.toISOString(),
      player: {
        id: i.playerId,
        slug: i.slug,
        fullName: `${i.first} ${i.last}`.trim(),
        position: i.position,
        imageUrl: i.imageUrl,
        age: i.birthdate,
        nationality: i.nationality,
        heightCm: i.heightCm,
      },
      line: l
        ? {
            league: l.league,
            leagueSlug: l.leagueSlug,
            team: l.team,
            season: canonicalSeasonLabel(l.season),
            gamesPlayed: g,
            ppg: pg(l.points, g),
            rpg: pg(l.rebounds, g),
            apg: pg(l.assists, g),
            per: l.per,
          }
        : null,
    }
  })

  const owner = (
    await db.select({ id: users.id, name: users.name, email: users.email }).from(users).where(eq(users.id, list.ownerId))
  )[0]
  const members = await db
    .select({ userId: users.id, name: users.name, email: users.email, role: shortlistMembers.role })
    .from(shortlistMembers)
    .innerJoin(users, eq(shortlistMembers.userId, users.id))
    .where(eq(shortlistMembers.shortlistId, listId))
    .orderBy(asc(shortlistMembers.addedAt))
  const comments = await db
    .select({
      id: shortlistComments.id,
      itemId: shortlistComments.itemId,
      body: shortlistComments.body,
      createdAt: shortlistComments.createdAt,
      author: users.name,
      authorId: users.id,
    })
    .from(shortlistComments)
    .innerJoin(users, eq(shortlistComments.userId, users.id))
    .where(eq(shortlistComments.shortlistId, listId))
    .orderBy(desc(shortlistComments.createdAt))
    .limit(200)

  return {
    id: list.id,
    name: list.name,
    description: list.description,
    updatedAt: list.updatedAt.toISOString(),
    owner: owner ?? null,
    members,
    items: itemViews,
    comments: comments.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() })),
  }
}

export type ShortlistDetail = NonNullable<Awaited<ReturnType<typeof shortlistDetail>>>

/** Everyone on a list except `exceptUserId` — the recipients of its activity. */
export async function shortlistAudience(listId: string, exceptUserId: string): Promise<string[]> {
  const db = getDb()
  const list = (await db.select({ ownerId: shortlists.ownerId }).from(shortlists).where(eq(shortlists.id, listId)))[0]
  const members = await db
    .select({ userId: shortlistMembers.userId })
    .from(shortlistMembers)
    .where(eq(shortlistMembers.shortlistId, listId))
  return [...new Set([list?.ownerId, ...members.map((m) => m.userId)])].filter(
    (id): id is string => !!id && id !== exceptUserId,
  )
}

export async function touchShortlist(listId: string) {
  await getDb().update(shortlists).set({ updatedAt: new Date() }).where(eq(shortlists.id, listId))
}
