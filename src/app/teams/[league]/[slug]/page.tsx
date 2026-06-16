import Link from "next/link"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { FadeIn } from "@/components/animations/fade-in"
import { TeamDetailView } from "@/components/teams/team-detail-view"
import { getTeamBySlug, listTeamOptions } from "@/lib/data/teams"
import { JsonLd } from "@/components/marketing/json-ld"
import { breadcrumbJsonLd, teamJsonLd } from "@/lib/seo/structured-data"
import { SITE } from "@/lib/site"
import { getT } from "@/lib/i18n/server"

type Params = { league: string; slug: string }

export const dynamicParams = true

export async function generateStaticParams(): Promise<
  Array<{ league: string; slug: string }>
> {
  const options = await listTeamOptions(2000)
  return options.map((t) => ({ league: t.leagueSlug, slug: t.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>
}): Promise<Metadata> {
  const { league, slug } = await params
  const { t } = await getT()
  const team = await getTeamBySlug(league, slug)
  if (!team) return { title: t("teamProfile.notFound") }
  const description = t("teamProfile.metaDescription", {
    name: team.name,
    league: team.league.name,
    players: team.roster.length,
    staff: team.staff.length,
  })
  return {
    title: team.name,
    description,
    alternates: { canonical: `${SITE.url}/teams/${league}/${slug}` },
  }
}

export default async function TeamDetailPage({
  params,
}: {
  params: Promise<Params>
}) {
  const { league, slug } = await params
  const { t } = await getT()
  const team = await getTeamBySlug(league, slug)
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
      { name: "Teams", path: "/teams" },
      { name: team.name, path: `/teams/${team.league.slug}/${team.slug}` },
    ]),
  ]

  return (
    <div className="full-bleed relative pt-6 sm:pt-8">
      <JsonLd data={structuredData} />
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
      <FadeIn>
        <Link
          href="/teams"
          className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-300 transition hover:text-brand-300"
        >
          <span aria-hidden>←</span> {t("teamProfile.backToTeams")}
        </Link>
      </FadeIn>
      <TeamDetailView team={team} />
      </div>
    </div>
  )
}
