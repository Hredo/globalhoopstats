import type { Metadata } from "next"
import { listPlayers, type ListPlayersInput } from "@/lib/data/players"
import { listSeasons, resolveSeasonName } from "@/lib/data/seasons"
import { DirectoryControls } from "@/components/ui/directory-controls"
import { ExportLinks } from "@/components/workspace/export-links"
import { PlayersInfiniteView } from "@/components/players/players-infinite-view"
import { DirectoryHero } from "@/components/ui/directory-hero"
import { StickyFilterBar } from "@/components/ui/sticky-filter-bar"
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
  Record<keyof ListPlayersInput | "q" | "page" | "season" | "gender", string>
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
    path: women ? "/players?gender=women" : "/players",
    title: t(
      women ? "directory.players.metaTitleWomen" : "directory.players.metaTitle",
    ),
    description: t(
      women
        ? "directory.players.metaDescriptionWomen"
        : "directory.players.metaDescription",
    ),
  })
}

const SORT_VALUES = new Set(["points", "rebounds", "assists", "name"])
const ORDER_VALUES = new Set(["asc", "desc"])
const PAGE_SIZE = 30

function parseInput(sp: SearchParams): ListPlayersInput {
  const sort = sp.sort
  const order = sp.order
  const league = sp.league
  const team = sp.team?.trim()
  const q = sp.q?.trim()
  const page = Number(sp.page ?? 1)
  return {
    query: q || undefined,
    league: league && LEAGUE_VALUES.has(league) ? league : undefined,
    team: team || undefined,
    sort:
      sort && SORT_VALUES.has(sort)
        ? (sort as ListPlayersInput["sort"])
        : "points",
    order:
      order && ORDER_VALUES.has(order)
        ? (order as ListPlayersInput["order"])
        : "desc",
    page: Number.isFinite(page) && page > 0 ? Math.floor(page) : 1,
    pageSize: PAGE_SIZE,
  }
}

export default async function PlayersPage(props: {
  searchParams: Promise<SearchParams>
}) {
  const sp = await props.searchParams
  const input = parseInput(sp)
  // Resolved server-side so an unknown or stale `?season=` silently falls back
  // to the newest one instead of rendering an empty directory.
  // A picked league already says which side is meant; otherwise the switch
  // (URL, then cookie) decides. `scope` is never empty, so men's and women's
  // rows cannot share a listing.
  const gender = input.league
    ? genderForFilter(input.league)
    : await resolveGender(sp.gender)
  const scope = scopeLeague(input.league, gender)
  const [season, seasons] = await Promise.all([
    resolveSeasonName(sp.season, scope),
    listSeasons(scope),
  ])
  const result = await listPlayers({ ...input, league: scope, season })
  const { t, locale } = await getT()

  return (
    <div className="full-bleed relative pb-10 sm:pb-14">
      <DirectoryHero
        eyebrow={t("directory.players.eyebrow")}
        title={t("directory.players.title")}
        description={t(
          gender === "women"
            ? "directory.players.descriptionWomen"
            : "directory.players.description",
        )}
        stats={[
          {
            value: result.total.toLocaleString(locale === "es" ? "es-ES" : "en-US"),
            label: t("directory.players.statLabel"),
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
          basePath="/players"
          kind="players"
          total={result.total}
          showing={result.items.length}
          seasons={seasons.map((s) => s.name)}
          season={season}
          gender={gender}
        />
      </StickyFilterBar>
      <div className="mt-3 flex justify-end">
        <ExportLinks league={scope} season={season} />
      </div>

      <PlayersInfiniteView
        key={`${season}|${input.query ?? ""}|${scope}|${input.sort ?? "points"}|${input.order ?? "desc"}`}
        initial={result}
        query={input.query ?? ""}
        league={scope}
        sort={input.sort ?? "points"}
        order={input.order ?? "desc"}
        season={season}
      />
      </div>
    </div>
  )
}
