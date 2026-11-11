import type { Metadata } from "next"
import { DirectoryControls } from "@/components/ui/directory-controls"
import { CoachesInfiniteView } from "@/components/staff/coaches-infinite-view"
import { DirectoryHero } from "@/components/ui/directory-hero"
import { StickyFilterBar } from "@/components/ui/sticky-filter-bar"
import { listCoaches, type ListCoachesInput } from "@/lib/data/staff"
import { listSeasons, resolveSeasonName } from "@/lib/data/seasons"
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
  Record<keyof ListCoachesInput | "q" | "page" | "season" | "gender", string>
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
    path: women ? "/coaches?gender=women" : "/coaches",
    title: t(
      women ? "directory.coaches.metaTitleWomen" : "directory.coaches.metaTitle",
    ),
    description: t(
      women
        ? "directory.coaches.metaDescriptionWomen"
        : "directory.coaches.metaDescription",
    ),
  })
}

const ROLE_VALUES = new Set(["head_coach", "assistant_coach", "staff"])
const PAGE_SIZE = 48

function parseInput(sp: SearchParams): ListCoachesInput {
  const league = sp.league
  const team = sp.team?.trim()
  const role = sp.role
  const query = sp.q?.trim()
  const page = Number(sp.page ?? 1)
  return {
    league: league && LEAGUE_VALUES.has(league) ? league : undefined,
    team: team || undefined,
    role:
      role && ROLE_VALUES.has(role)
        ? (role as ListCoachesInput["role"])
        : undefined,
    query: query || undefined,
    page: Number.isFinite(page) && page > 0 ? Math.floor(page) : 1,
    pageSize: PAGE_SIZE,
  }
}

export default async function CoachesPage(props: {
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
  const result = await listCoaches({ ...input, league: scope, season })
  const { t, locale } = await getT()

  return (
    <div className="full-bleed relative pb-10 sm:pb-14">
      <DirectoryHero
        eyebrow={t("directory.coaches.eyebrow")}
        title={t("directory.coaches.title")}
        description={t(
          gender === "women"
            ? "directory.coaches.descriptionWomen"
            : "directory.coaches.description",
        )}
        stats={[
          {
            value: result.total.toLocaleString(locale === "es" ? "es-ES" : "en-US"),
            label: t("directory.coaches.statLabel"),
          },
          {
            value: String(gender === "women" ? leagueSlugsForGender(gender).length : 3),
            label: t("directory.leaguesLabel"),
          },
        ]}
      />

      <div className="mx-auto max-w-7xl px-4 sm:px-6">
      <StickyFilterBar>
        <DirectoryControls
          basePath="/coaches"
          kind="coaches"
          total={result.total}
          showing={result.items.length}
          seasons={seasons.map((s) => s.name)}
          season={season}
          gender={gender}
        />
      </StickyFilterBar>

      <CoachesInfiniteView
        key={`${season}|${input.query ?? ""}|${scope}|${input.role ?? ""}`}
        initial={result}
        query={input.query ?? ""}
        league={scope}
        role={input.role ?? ""}
        season={season}
      />
      </div>
    </div>
  )
}
