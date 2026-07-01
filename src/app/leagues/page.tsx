import type { Metadata } from "next"
import { FadeIn } from "@/components/animations/fade-in"
import { getGlobalLeagueCounts, listLeagueOverviews } from "@/lib/data/leagues"
import { getSyncTimesBySource } from "@/lib/data/sync"
import { GlobalStatsBand } from "@/components/leagues/global-stats-band"
import { LeagueOverview } from "@/components/leagues/league-overview"
import { DirectoryHero } from "@/components/ui/directory-hero"
import { leagueAccent } from "@/components/ui/league-badge"
import { getT } from "@/lib/i18n/server"

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT()
  return {
    title: t("directory.leagues.metaTitle"),
    description: t("directory.leagues.metaDescription"),
  }
}

export const revalidate = 600

export default async function LeaguesPage() {
  const [leagues, counts, syncTimes] = await Promise.all([
    listLeagueOverviews(),
    getGlobalLeagueCounts(),
    getSyncTimesBySource(),
  ])
  const { t } = await getT()
  const accents = leagues.map((lg) => leagueAccent(lg.slug).color)

  return (
    <div className="full-bleed relative pb-8 sm:pb-12">
      <DirectoryHero
        eyebrow={t("directory.leagues.eyebrow")}
        title={
          <>
            {t("directory.leagues.titleA")}{" "}
            <span className="text-gradient-brand">
              {t("directory.leagues.titleB")}
            </span>
          </>
        }
        description={t("directory.leagues.description")}
        accents={accents}
      />

      <div className="mx-auto max-w-7xl px-4 sm:px-6">
      <FadeIn delay={0.1} className="mt-8">
        <GlobalStatsBand counts={counts} />
      </FadeIn>

      <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5 xl:grid-cols-3">
        {leagues.map((lg, i) => (
          <FadeIn key={lg.id} delay={0.05 * (i + 1)} y={20}>
            <LeagueOverview
              data={lg}
              index={i}
              lastSyncAt={syncTimes.get(lg.slug) ?? null}
            />
          </FadeIn>
        ))}
      </div>
      </div>
    </div>
  )
}
