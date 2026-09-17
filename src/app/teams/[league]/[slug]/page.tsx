import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { FadeIn } from "@/components/animations/fade-in"
import { BackLink } from "@/components/ui/back-link"
import { TeamDetailView } from "@/components/teams/team-detail-view"
import { getTeamBySlug, listTeamOptions } from "@/lib/data/teams"
import { ALL_SEASONS, parseSeasonParam } from "@/lib/seasons"
import { JsonLd } from "@/components/marketing/json-ld"
import { breadcrumbJsonLd, teamJsonLd } from "@/lib/seo/structured-data"
import { pageSeo } from "@/lib/seo/metadata"
import { getT } from "@/lib/i18n/server"

type Params = { league: string; slug: string }

export const dynamicParams = true

export async function generateStaticParams(): Promise<
  Array<{ league: string; slug: string }>
> {
  // Pre-rendering is an optimisation, not a requirement: `dynamicParams` above
  // means anything not listed here is simply rendered on first request. So a
  // database that is unreachable at build time must not fail the build — it
  // did once, when DATABASE_URL still pointed at the remote MySQL hostname
  // that the build server is not allowed to reach.
  try {
    // Every season, not just the newest: a club that has left the competition
    // still has a page worth pre-rendering, and `dynamicParams` would render
    // it on demand anyway.
    const options = await listTeamOptions(2000, ALL_SEASONS)
    return options.map((t) => ({ league: t.leagueSlug, slug: t.slug }))
  } catch (err) {
    console.warn(
      "[teams] could not pre-render team pages; they will render on demand:",
      err,
    )
    return []
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>
}): Promise<Metadata> {
  const { league, slug } = await params
  const { t, locale } = await getT()
  const team = await getTeamBySlug(league, slug)
  if (!team) return { title: t("teamProfile.notFound") }
  const vars = {
    name: team.name,
    league: team.league.name,
    season: team.season,
    players: team.roster.length,
  }
  // Head coach first: "<club> entrenador" is a query this snippet can answer.
  const staffNames = [...team.staff]
    .sort(
      (a, b) =>
        Number(b.role === "head_coach") - Number(a.role === "head_coach"),
    )
    .slice(0, 3)
    .map((c) => c.fullName)
    .join(", ")
  const description = [
    t("teamProfile.metaDescription", vars),
    staffNames ? t("teamProfile.metaStaff", { staff: staffNames }) : null,
  ]
    .filter(Boolean)
    .join(" ")
  return pageSeo({
    path: `/teams/${league}/${slug}`,
    title: t("teamProfile.metaTitle", vars),
    description,
    locale,
  })
}

export default async function TeamDetailPage({
  params,
  searchParams,
}: {
  params: Promise<Params>
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { league, slug } = await params
  const sp = searchParams ? await searchParams : {}
  const { t } = await getT()
  // Newest season by default; `?season=` shows that season's squad and staff.
  const season = parseSeasonParam(
    typeof sp.season === "string" ? sp.season : null,
  )
  const team = await getTeamBySlug(league, slug, season)
  if (!team) notFound()

  const structuredData = [
    teamJsonLd({
      name: team.name,
      slug: team.slug,
      leagueSlug: team.league.slug,
      leagueName: team.league.name,
      logoUrl: team.logoUrl,
      city: team.city,
    }),
    breadcrumbJsonLd([
      { name: t("nav.teams"), path: "/teams" },
      { name: team.name, path: `/teams/${team.league.slug}/${team.slug}` },
    ]),
  ]

  return (
    <div className="relative pt-6 sm:pt-8">
      <JsonLd data={structuredData} />
      <FadeIn>
        <BackLink
          fallbackHref="/teams"
          label={t("common.back")}
          className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-300 transition hover:text-brand-300"
        />
      </FadeIn>
      <TeamDetailView team={team} />
    </div>
  )
}
