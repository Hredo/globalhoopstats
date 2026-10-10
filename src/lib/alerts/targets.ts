/** Display name and URL of a followable thing, resolved from its id or slug. */
import { desc, eq } from "drizzle-orm"
import { getDb } from "@/lib/db/client"
import { leagues, players, playerSeasonStats, seasons, teams } from "@/lib/db/schema"
import { seasonStartYear } from "@/lib/seasons"

export type FollowKind = "player" | "team"
export const isFollowKind = (v: unknown): v is FollowKind => v === "player" || v === "team"

export type TargetInfo = { id: string; kind: FollowKind; name: string; href: string; imageUrl: string | null }

async function teamLeagueSlug(teamId: string): Promise<string | null> {
  const rows = await getDb()
    .select({ slug: leagues.slug, season: seasons.name })
    .from(playerSeasonStats)
    .innerJoin(leagues, eq(playerSeasonStats.leagueId, leagues.id))
    .innerJoin(seasons, eq(playerSeasonStats.seasonId, seasons.id))
    .where(eq(playerSeasonStats.teamId, teamId))
    .orderBy(desc(seasons.name))
    .limit(50)
  const best = rows.sort((a, b) => (seasonStartYear(b.season) ?? 0) - (seasonStartYear(a.season) ?? 0))[0]
  return best?.slug ?? null
}

export async function targetById(kind: FollowKind, id: string): Promise<TargetInfo | null> {
  const db = getDb()
  if (kind === "player") {
    const r = (
      await db
        .select({ slug: players.slug, first: players.firstName, last: players.lastName, img: players.imageUrl })
        .from(players)
        .where(eq(players.id, id))
        .limit(1)
    )[0]
    return r
      ? { id, kind, name: `${r.first} ${r.last}`.trim(), href: `/players/${r.slug}`, imageUrl: r.img }
      : null
  }
  const t = (
    await db
      .select({ slug: teams.slug, name: teams.name, logo: teams.logoUrl })
      .from(teams)
      .where(eq(teams.id, id))
      .limit(1)
  )[0]
  if (!t) return null
  const league = await teamLeagueSlug(id)
  return {
    id,
    kind,
    name: t.name,
    href: league ? `/teams/${league}/${t.slug}` : "/teams",
    imageUrl: t.logo,
  }
}

export async function targetBySlug(kind: FollowKind, slug: string): Promise<TargetInfo | null> {
  const db = getDb()
  const row =
    kind === "player"
      ? (await db.select({ id: players.id }).from(players).where(eq(players.slug, slug)).limit(1))[0]
      : (await db.select({ id: teams.id }).from(teams).where(eq(teams.slug, slug)).limit(1))[0]
  return row ? targetById(kind, row.id) : null
}
