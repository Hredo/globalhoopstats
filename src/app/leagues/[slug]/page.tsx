import Link from "next/link"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { FadeIn } from "@/components/animations/fade-in"
import { LeagueOverview } from "@/components/leagues/league-overview"
import { TeamCardElegant } from "@/components/teams/team-card-elegant"
import { DirectoryHero } from "@/components/ui/directory-hero"
import { JsonLd } from "@/components/marketing/json-ld"
import { listLeagueOverviews, listLeagueTopScorers } from "@/lib/data/leagues"
import { getSyncTimesBySource } from "@/lib/data/sync"
import { listTeams } from "@/lib/data/teams"
import { getT } from "@/lib/i18n/server"
import { pageSeo } from "@/lib/seo/metadata"
import { breadcrumbJsonLd, leagueJsonLd } from "@/lib/seo/structured-data"

/**
 * One landing page per league — the page that can rank for "estadísticas Liga
 * ACB" or "máximos anotadores Primera FEB". Before it existed the only league
 * URL was /leagues, and the filtered directories (/players?league=acb) all
 * canonicalise to their unfiltered index, so no URL on the site was about a
 * single competition.
 */

export const revalidate = 600

type Params = { slug: string }

/**
 * The name people type into Google is often not the one we display: the ACB
 * shows under its sponsor name (Liga Endesa), and FEB renamed its leagues in
 * 2025 while everyone still searches "LEB Oro". Both go in the title; only a
 * `former` name is called "formerly" in the prose.
 */
const ALSO_KNOWN_AS: Record<string, { name: string; former: boolean }> = {
  acb: { name: "Liga ACB", former: false },
  "leb-oro": { name: "LEB Oro", former: true },
  "leb-plata": { name: "LEB Plata", former: true },
  eba: { name: "Liga EBA", former: true },
}

function formerName(slug: string): string | null {
  const aka = ALSO_KNOWN_AS[slug]
  return aka?.former ? aka.name : null
}

async function findLeague(slug: string) {
  const overviews = await listLeagueOverviews()
  return overviews.find((l) => l.slug === slug) ?? null
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>
}): Promise<Metadata> {
  const { slug } = await params
  const { t, locale } = await getT()
  const league = await findLeague(slug)
  if (!league) return { title: t("leaguePage.notFound") }
  const legacy = formerName(slug)
  const aka = ALSO_KNOWN_AS[slug]
  const vars = {
    league: league.name,
    season: league.seasonLabel ?? "",
    teams: league.teamCount,
    players: league.playerCount,
    legacy: legacy ? t("leaguePage.legacySuffix", { legacy }) : "",
  }
  return pageSeo({
    path: `/leagues/${slug}`,
    title: t("leaguePage.metaTitle", {
      ...vars,
      league: aka ? `${league.name} (${aka.name})` : league.name,
    }),
    description: t("leaguePage.metaDescription", vars),
    locale,
  })
}

export default async function LeaguePage({
  params,
}: {
  params: Promise<Params>
}) {
  const { slug } = await params
  const league = await findLeague(slug)
  if (!league) notFound()

  const [scorers, teams, syncTimes, { t, locale }] = await Promise.all([
    listLeagueTopScorers(league.id, 10),
    listTeams({ league: slug, sort: "name", order: "asc", pageSize: 200 }),
    getSyncTimesBySource(),
    getT(),
  ])
  const legacy = formerName(slug)
  const season = league.seasonLabel ?? ""
  const number = (n: number) =>
    n.toLocaleString(locale === "es" ? "es-ES" : "en-US")
  const leader = scorers[0]

  // The intro is the page's own prose — what a searcher's query is matched
  // against — so it names the league, the season, the counts and the leader.
  const intro = [
    t("leaguePage.intro", {
      league: league.name,
      season,
      teams: number(league.teamCount),
      players: number(league.playerCount),
    }),
    legacy
      ? t("leaguePage.introLegacy", { league: league.name, legacy })
      : null,
    leader
      ? t("leaguePage.introLeader", {
          name: leader.fullName,
          team: leader.team?.name ?? "—",
          ppg: leader.ppg.toFixed(1),
        })
      : null,
  ]
    .filter(Boolean)
    .join(" ")

  const structuredData = [
    leagueJsonLd({
      name: league.name,
      slug: league.slug,
      alternateName: ALSO_KNOWN_AS[slug]?.name ?? null,
      logoUrl: league.logoUrl,
    }),
    breadcrumbJsonLd([
      { name: t("nav.leagues"), path: "/leagues" },
      { name: league.name, path: `/leagues/${league.slug}` },
    ]),
  ]

  return (
    <div className="full-bleed relative pb-10 sm:pb-14">
      <JsonLd data={structuredData} />
      <DirectoryHero
        eyebrow={t("leaguePage.eyebrow", { season })}
        title={league.name}
        description={intro}
        league={slug}
        stats={[
          { value: number(league.teamCount), label: t("leaguePage.statTeams") },
          {
            value: number(league.playerCount),
            label: t("leaguePage.statPlayers"),
          },
        ]}
      />

      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <nav className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-300">
          <Link href="/leagues" className="transition hover:text-brand-300">
            ← {t("leaguePage.allLeagues")}
          </Link>
          <Link
            href={`/players?league=${slug}`}
            className="transition hover:text-brand-300"
          >
            {t("leaguePage.allPlayers", { league: league.name })} →
          </Link>
        </nav>

        <div className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,400px)]">
          <FadeIn>
            <section className="gh-card p-5 sm:p-6">
              <h2 className="font-display text-xl font-bold text-ink-50">
                {t("leaguePage.scorersTitle", { season })}
              </h2>
              <p className="mt-1 text-xs text-ink-400">
                {t("leaguePage.scorersNote")}
              </p>
              {scorers.length > 0 ? (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-hairline text-left font-mono text-[10px] uppercase tracking-[0.14em] text-ink-400">
                        <th className="pb-2 pr-3">#</th>
                        <th className="pb-2 pr-3">{t("leaguePage.colPlayer")}</th>
                        <th className="pb-2 pr-3">{t("leaguePage.colTeam")}</th>
                        <th className="pb-2 text-right">
                          {t("leaguePage.colPpg")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {scorers.map((s, i) => (
                        <tr
                          key={s.playerId}
                          className="border-b border-hairline/50 text-ink-200"
                        >
                          <td className="py-2 pr-3 font-mono tabular-nums text-ink-400">
                            {i + 1}
                          </td>
                          <td className="py-2 pr-3">
                            <Link
                              href={`/players/${s.slug}`}
                              className="font-semibold text-ink-100 transition hover:text-brand-300"
                            >
                              {s.fullName}
                            </Link>
                          </td>
                          <td className="py-2 pr-3">
                            {s.team?.slug ? (
                              <Link
                                href={`/teams/${slug}/${s.team.slug}`}
                                className="transition hover:text-brand-300"
                              >
                                {s.team.name}
                              </Link>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="py-2 text-right font-display font-bold tabular-nums text-ink-50">
                            {s.ppg.toFixed(1)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="mt-4 text-sm text-ink-400">
                  {t("directory.leagues.noScorers")}
                </p>
              )}
            </section>
          </FadeIn>

          <FadeIn delay={0.05}>
            <LeagueOverview
              data={league}
              index={0}
              lastSyncAt={syncTimes.get(league.slug) ?? null}
            />
          </FadeIn>
        </div>

        {teams.items.length > 0 ? (
          <section className="mt-12">
            <h2 className="font-display text-xl font-bold text-ink-50">
              {t("leaguePage.teamsTitle", { league: league.name, season })}
            </h2>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {teams.items.map((team) => (
                <TeamCardElegant key={team.id} team={team} />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  )
}
