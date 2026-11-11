import type { Metadata } from "next"
import { listTeams, type ListTeamsInput } from "@/lib/data/teams"
import { listSeasons, resolveSeasonName } from "@/lib/data/seasons"
import { DirectoryControls } from "@/components/ui/directory-controls"
import { TeamsInfiniteView } from "@/components/teams/teams-infinite-view"
import { DirectoryHero } from "@/components/ui/directory-hero"
import { StickyFilterBar } from "@/components/ui/sticky-filter-bar"
import { PageTransition } from "@/components/ui/page-transition"
import { getT } from "@/lib/i18n/server"
import { resolveGender } from "@/lib/gender-server"
import { leagueSlugsForGender } from "@/lib/gender"
import {
  LEAGUE_FILTER_VALUES as LEAGUE_VALUES,
  genderForFilter,
  scopeLeague,
} from "@/lib/league-groups"
import { pageSeo } from "@/lib/seo/metadata"

type SearchParams = Partial<
  Record<keyof ListTeamsInput | "q" | "page" | "season" | "gender", string>
>

export const revalidate = 300

export async function generateMetadata(props: {
  searchParams: Promise<SearchParams>
}): Promise<Metadata> {
  const { t, locale } = await getT()
  const sp = await props.searchParams
  const league =
    sp.league && LEAGUE_VALUES.has(sp.league) ? sp.league : undefined
  const gender = league
    ? genderForFilter(league)
    : await resolveGender(sp.gender)
  // The women's directory is a page of its own, not a duplicate of the men's:
  // its own title, description and canonical, so it can be indexed.
  const women = gender === "women"
  return pageSeo({
    locale,
    path: women ? "/teams?gender=women" : "/teams",
    title: t(
      women ? "directory.teams.metaTitleWomen" : "directory.teams.metaTitle",
    ),
    description: t(
      women
        ? "directory.teams.metaDescriptionWomen"
        : "directory.teams.metaDescription",
    ),
  })
}

const SORT_VALUES = new Set(["name", "players"])
const ORDER_VALUES = new Set(["asc", "desc"])
const PAGE_SIZE = 24

function parseInput(sp: SearchParams): ListTeamsInput {
  const sort = sp.sort
  const order = sp.order
  const league = sp.league
  const q = sp.q?.trim()
  const page = Number(sp.page ?? 1)
  return {
    query: q || undefined,
    league: league && LEAGUE_VALUES.has(league) ? league : undefined,
    sort:
      sort && SORT_VALUES.has(sort) ? (sort as ListTeamsInput["sort"]) : "name",
    order:
      order && ORDER_VALUES.has(order)
        ? (order as ListTeamsInput["order"])
        : "asc",
    page: Number.isFinite(page) && page > 0 ? Math.floor(page) : 1,
    pageSize: PAGE_SIZE,
  }
}

export default async function TeamsPage(props: {
  searchParams: Promise<SearchParams>
}) {
  const sp = await props.searchParams
  const input = parseInput(sp)
  const gender = input.league
    ? genderForFilter(input.league)
    : await resolveGender(sp.gender)
  const scope = scopeLeague(input.league, gender)
  const [season, seasons] = await Promise.all([
    resolveSeasonName(sp.season, scope),
    listSeasons(scope),
  ])
  const result = await listTeams({ ...input, league: scope, season })
  const { t, locale } = await getT()

  return (
    <div className="full-bleed relative pb-10 sm:pb-14">
      <DirectoryHero
        eyebrow={t("directory.teams.eyebrow")}
        title={t("directory.teams.title")}
        description={t(
          gender === "women"
            ? "directory.teams.descriptionWomen"
            : "directory.teams.description",
        )}
        league={input.league}
        stats={[
          {
            value: result.total.toLocaleString(locale === "es" ? "es-ES" : "en-US"),
            label: t("directory.teams.statLabel"),
          },
          {
            value: String(leagueSlugsForGender(gender).length),
            label: t("directory.leaguesLabel"),
          },
        ]}
      />

      <div className="mx-auto max-w-7xl px-4 sm:px-6">
      <StickyFilterBar>
        <DirectoryControls
          basePath="/teams"
          kind="teams"
          total={result.total}
          showing={result.items.length}
          seasons={seasons.map((s) => s.name)}
          season={season}
          gender={gender}
        />
      </StickyFilterBar>

      <PageTransition
        league={scope}
        query={input.query ?? ""}
        sort={input.sort ?? "name"}
        order={input.order ?? "asc"}
      >
        <TeamsInfiniteView
          key={`${season}|${input.query ?? ""}|${scope}|${input.sort ?? "name"}|${input.order ?? "asc"}`}
          initial={result}
          query={input.query ?? ""}
          league={scope}
          sort={input.sort ?? "name"}
          order={input.order ?? "asc"}
          season={season}
        />
      </PageTransition>
      </div>
    </div>
  )
}
