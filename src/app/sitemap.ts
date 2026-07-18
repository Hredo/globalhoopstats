import type { MetadataRoute } from "next"
import { listAllPlayerSlugs } from "@/lib/data/players"
import { listAllCoachSlugs } from "@/lib/data/staff"
import { listTeamOptions } from "@/lib/data/teams"
import { getLatestSyncTime } from "@/lib/data/sync"
import { SITE } from "@/lib/site"

/**
 * Every publicly reachable route, in rough order of how much we want it
 * crawled.
 *
 * Auth-gated routes are deliberately absent: middleware bounces /ai-advisor,
 * /market/trade and /account to /login, so listing them only feeds Googlebot a
 * redirect to a page that cannot be indexed — it burns crawl budget and reads
 * as a broken sitemap. They are marketed from the homepage instead.
 */
const STATIC_ROUTES: Array<{
  path: string
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"]
  priority: number
}> = [
  { path: "/", changeFrequency: "daily", priority: 1 },
  { path: "/leagues", changeFrequency: "daily", priority: 0.9 },
  // Index pages — the entry points Google uses to discover the long tail below
  { path: "/players", changeFrequency: "daily", priority: 0.9 },
  { path: "/teams", changeFrequency: "daily", priority: 0.8 },
  { path: "/coaches", changeFrequency: "weekly", priority: 0.7 },
  { path: "/playbook", changeFrequency: "weekly", priority: 0.7 },
  { path: "/compare", changeFrequency: "monthly", priority: 0.6 },
  { path: "/market/docs", changeFrequency: "monthly", priority: 0.5 },
  { path: "/methodology", changeFrequency: "monthly", priority: 0.4 },
  { path: "/contact", changeFrequency: "monthly", priority: 0.3 },
  { path: "/install", changeFrequency: "monthly", priority: 0.3 },
  { path: "/bot", changeFrequency: "yearly", priority: 0.2 },
  { path: "/terms", changeFrequency: "monthly", priority: 0.3 },
  { path: "/privacy", changeFrequency: "monthly", priority: 0.3 },
]

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()

  // Player, team and coach pages only change when a sync lands, so that is
  // their real lastmod. Stamping them with "now" on every request tells Google
  // the whole catalogue changed every time it looks — a signal it learns to
  // distrust, and then ignores on the pages where it is actually true.
  const lastSync = (await getLatestSyncTime().catch(() => null)) ?? now

  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((r) => ({
    url: `${SITE.url}${r.path}`,
    lastModified: r.changeFrequency === "daily" ? lastSync : now,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }))

  // Headroom, not a cap. The player list came back at exactly the old 3000
  // limit, which is the signature of a silently truncated catalogue — every
  // player past the cut simply never got submitted for indexing. A sitemap may
  // hold 50 000 URLs, so these bounds exist only to keep one runaway query from
  // producing an invalid file.
  const [playerSlugs, teamOptions, coachSlugs] = await Promise.all([
    listAllPlayerSlugs(45000).catch(() => [] as Array<{ slug: string }>),
    listTeamOptions(2000).catch(
      () =>
        [] as Array<{
          id: string
          name: string
          slug: string
          leagueSlug: string
        }>,
    ),
    listAllCoachSlugs(5000).catch(() => [] as Array<{ slug: string }>),
  ])

  const playerEntries: MetadataRoute.Sitemap = playerSlugs.map((p) => ({
    url: `${SITE.url}/players/${p.slug}`,
    lastModified: lastSync,
    changeFrequency: "daily",
    priority: 0.8,
  }))

  const teamEntries: MetadataRoute.Sitemap = teamOptions.map((t) => ({
    url: `${SITE.url}/teams/${t.leagueSlug}/${t.slug}`,
    lastModified: lastSync,
    changeFrequency: "daily",
    priority: 0.8,
  }))

  const coachEntries: MetadataRoute.Sitemap = coachSlugs.map((c) => ({
    url: `${SITE.url}/coaches/${c.slug}`,
    lastModified: lastSync,
    changeFrequency: "weekly",
    priority: 0.7,
  }))

  return [...staticEntries, ...playerEntries, ...teamEntries, ...coachEntries]
}
