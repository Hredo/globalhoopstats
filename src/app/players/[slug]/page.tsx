import { Suspense } from "react"
import Link from "next/link"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { and, eq, sql } from "drizzle-orm"
import { getDb } from "@/lib/db/client"
import { players, playerSeasonStats, seasons } from "@/lib/db/schema"
import { getPlayerBySlug, pickPlayerLeague } from "@/lib/data/players"
import { getMarketPlayerBySlug } from "@/lib/market/pool"
import { PctBar } from "@/components/ui/pct-bar"
import { FadeIn } from "@/components/animations/fade-in"
import { LeagueTransition } from "@/components/players/league-transition"
import { SmartImage } from "@/components/ui/smart-image"
import { BackLink } from "@/components/ui/back-link"
import { Eyebrow } from "@/components/ui/eyebrow"
import { leagueAccent } from "@/components/ui/league-badge"
import { MarketValueCard } from "@/components/market/market-value-card"
import { PlayerLeagueSwitcher } from "@/components/ui/league-switcher"
import { JsonLd } from "@/components/marketing/json-ld"
import { breadcrumbJsonLd, playerJsonLd } from "@/lib/seo/structured-data"
import { SITE } from "@/lib/site"
import { HighlightsSection } from "./highlights"
import { PlayerAi } from "@/components/players/player-ai"
import { getT } from "@/lib/i18n/server"

type Props = {
  params: Promise<{ slug: string }>
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const { t } = await getT()
  const profile = await getPlayerBySlug(slug)
  if (!profile) return { title: t("playerProfile.notFound") }
  const season0 = profile.seasons[0]
  const ppg =
    season0 && season0.pointsTotal != null && season0.gamesPlayed > 0
      ? season0.pointsTotal / season0.gamesPlayed
      : null
  const base = t("playerProfile.metaDescription", {
    name: profile.fullName,
    position: profile.position ?? t("playerProfile.playerFallback"),
    team: profile.team?.name ?? t("playerProfile.metaFreeAgent"),
    league: profile.league.name,
  })
  const description = ppg
    ? `${base} ${t("playerProfile.averaging", { ppg: ppg.toFixed(1) })}`
    : base
  return {
    title: profile.fullName,
    description,
    alternates: { canonical: `${SITE.url}/players/${slug}` },
  }
}

function formatHeight(cm: number | null): string {
  if (cm == null) return "—"
  const totalIn = cm / 2.54
  const ft = Math.floor(totalIn / 12)
  const inches = Math.round(totalIn - ft * 12)
  return `${ft}'${inches}" (${cm} cm)`
}

function perGame(total: number | null, gp: number): number | null {
  if (total == null || gp === 0) return null
  return total / gp
}

function formatWeight(kg: number | null): string {
  if (kg == null) return "—"
  return `${kg} kg (${Math.round(kg * 2.20462)} lb)`
}

function formatBirth(bd: string | null): string {
  if (!bd) return "—"
  const d = new Date(bd)
  if (Number.isNaN(d.getTime())) return bd
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

function ageFrom(bd: string | null): number | null {
  if (!bd) return null
  const d = new Date(bd)
  if (Number.isNaN(d.getTime())) return null
  const ms = Date.now() - d.getTime()
  return Math.floor(ms / (365.25 * 24 * 3600 * 1000))
}

async function findComparisonCandidates(
  leagueId: string,
  excludePlayerId: string,
): Promise<
  Array<{ id: string; slug: string; fullName: string; points: number | null }>
> {
  const db = getDb()
  const rows = await db
    .select({
      id: players.id,
      slug: players.slug,
      fullName:
        sql<string>`${players.firstName} || ' ' || ${players.lastName}`,
      points:
        sql<number | null>`(coalesce(sum(${playerSeasonStats.pointsTotal}), 0) / nullif(sum(${playerSeasonStats.gamesPlayed}), 0))::float8`,
    })
    .from(players)
    .innerJoin(playerSeasonStats, eq(playerSeasonStats.playerId, players.id))
    .innerJoin(seasons, eq(playerSeasonStats.seasonId, seasons.id))
    .where(
      and(
        eq(playerSeasonStats.leagueId, leagueId),
        eq(seasons.isCurrent, true),
        sql`${players.id} <> ${excludePlayerId}`,
      ),
    )
    .groupBy(players.id)
    .orderBy(
      sql`(coalesce(sum(${playerSeasonStats.pointsTotal}), 0) / nullif(sum(${playerSeasonStats.gamesPlayed}), 0))::float8 desc`,
    )
    .limit(6)
  return rows as Array<{
    id: string
    slug: string
    fullName: string
    points: number | null
  }>
}

export default async function PlayerPage({ params, searchParams }: Props) {
  const { slug } = await params
  const sp = searchParams ? await searchParams : {}
  const leagueParam = typeof sp.league === "string" ? sp.league : null
  const { t } = await getT()
  const profile = await getPlayerBySlug(slug)
  if (!profile) notFound()

  // The player may have stats in several leagues; show the requested one (from
  // the switcher) or the primary, and read every per-league field off it.
  const selected = pickPlayerLeague(profile, leagueParam)
  const selLeague = selected.league
  const selTeam = selected.team

  const candidates = await findComparisonCandidates(
    selLeague.id,
    profile.id,
  )
  const initials = profile.fullName
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")

  const season = selected.seasons[0]
  const accent = leagueAccent(selLeague.slug)

  const marketPlayer = await getMarketPlayerBySlug(slug)

  const structuredData = [
    playerJsonLd({
      fullName: profile.fullName,
      slug: profile.slug,
      position: profile.position,
      nationality: profile.nationality,
      heightCm: profile.heightCm,
      weightKg: profile.weightKg,
      photoUrl: profile.imageUrl,
      teamName: selTeam?.name ?? null,
      leagueName: selLeague.name,
    }),
    breadcrumbJsonLd([
      { name: "Players", path: "/players" },
      { name: profile.fullName, path: `/players/${profile.slug}` },
    ]),
  ]

  return (
    <div
      className="relative pb-6 pt-6 transition-lg sm:pb-10 sm:pt-10"
      style={{ ["--lg" as string]: accent.color }}
    >
      <JsonLd data={structuredData} />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 left-1/2 -z-10 h-80 w-[820px] -translate-x-1/2 rounded-[50%] opacity-25 blur-3xl transition-colors duration-500"
        style={{ background: "var(--lg)" }}
      />
      <FadeIn>
        <BackLink
          fallbackHref="/players"
          label={t("common.back")}
          className="mb-5 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-300 transition hover:text-brand-300 sm:mb-6"
        />
      </FadeIn>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_1fr] lg:gap-8">
        <FadeIn>
          <aside className="space-y-4">
            <div className="relative mx-auto aspect-square w-44 overflow-hidden rounded-2xl bg-court-800 ring-1 ring-hairline sm:w-56 lg:w-full">
              <span
                aria-hidden
                className="absolute inset-x-0 top-0 z-10 h-[3px] transition-colors duration-500"
                style={{ background: "var(--lg)" }}
              />
              <SmartImage
                src={profile.imageUrl}
                alt={profile.fullName}
                fit="cover"
                eager
                fallbackClassName="text-4xl font-bold text-ink-300 sm:text-5xl"
                fallback={initials}
              />
            </div>
            <div className="gh-card p-4 text-sm">
              <h3 className="gh-eyebrow">{t("playerProfile.bio")}</h3>
              <dl className="mt-3 space-y-2">
                <Row k={t("playerProfile.position")} v={profile.position ?? "—"} />
                <Row
                  k={t("playerProfile.nationality")}
                  v={profile.nationality ?? "—"}
                />
                <Row k={t("playerProfile.height")} v={formatHeight(profile.heightCm)} />
                <Row k={t("playerProfile.weight")} v={formatWeight(profile.weightKg)} />
                <Row
                  k={t("playerProfile.league")}
                  v={
                    <span className="font-semibold text-ink-100">
                      {selLeague.name}
                    </span>
                  }
                />
                <Row
                  k={t("playerProfile.team")}
                  v={
                    selTeam ? (
                      <span className="font-semibold text-ink-100">
                        {selTeam.name}
                      </span>
                    ) : (
                      t("playerProfile.freeAgent")
                    )
                  }
                />
              </dl>
            </div>
            {marketPlayer?.valuation.eur ? (
              <MarketValueCard valuation={marketPlayer.valuation} />
            ) : null}
          </aside>
        </FadeIn>

        <div className="min-w-0 space-y-6 sm:space-y-8">
          <FadeIn>
            <header>
              <Eyebrow>
                <span
                  aria-hidden
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: "var(--lg)" }}
                />
                {selLeague.name} ·{" "}
                {selTeam?.name ?? t("playerProfile.freeAgent")}
              </Eyebrow>
              <h1 className="mt-3 break-words font-display text-4xl font-bold leading-[0.9] tracking-[-0.04em] text-ink-50 sm:text-5xl md:text-6xl">
                {profile.fullName}
              </h1>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <PlayerLeagueSwitcher
                  leagues={profile.leagues.map((l) => l.league)}
                  activeSlug={selLeague.slug}
                  ariaLabel={t("playerProfile.switchLeague")}
                />
                {season ? (
                  <p className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-400">
                    <span className="h-1.5 w-1.5 animate-ticker rounded-full bg-positive" />
                    {t("playerProfile.seasonGames", {
                      season: season.seasonName,
                      games: season.gamesPlayed,
                    })}
                  </p>
                ) : null}
              </div>
            </header>
          </FadeIn>

          <LeagueTransition>
            {season ? (
              <section>
                <h2 className="gh-eyebrow mb-4">
                  {t("playerProfile.production")}
                </h2>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3">
                  <StatTile
                    label={t("playerProfile.points")}
                    value={perGame(season.pointsTotal, season.gamesPlayed)}
                    unit="PPG"
                    highlight
                  />
                  <StatTile
                    label={t("playerProfile.rebounds")}
                    value={perGame(season.reboundsTotal, season.gamesPlayed)}
                    unit="RPG"
                  />
                  <StatTile label={t("playerProfile.assists")} value={perGame(season.assistsTotal, season.gamesPlayed)} unit="APG" />
                  <StatTile label={t("playerProfile.steals")} value={perGame(season.stealsTotal, season.gamesPlayed)} unit="SPG" />
                  <StatTile label={t("playerProfile.blocks")} value={perGame(season.blocksTotal, season.gamesPlayed)} unit="BPG" />
                  <StatTile
                    label={t("playerProfile.per")}
                    value={season.per}
                    unit="PER"
                  />
                </div>

                <h3 className="gh-eyebrow mb-3 mt-5 sm:mt-6">
                  {t("playerProfile.shooting")}
                </h3>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3 sm:gap-3">
                  <ShootingTile label={t("playerProfile.fieldGoal")} value={season.fgPct} />
                  <ShootingTile label={t("playerProfile.threePoint")} value={season.threePct} />
                  <ShootingTile label={t("playerProfile.freeThrow")} value={season.ftPct} />
                </div>
              </section>
            ) : (
              <div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-ink-300">
                {t("playerProfile.noSeasonStats")}
              </div>
            )}
          </LeagueTransition>

          {candidates.length > 0 ? (
            <LeagueTransition>
              <section>
                <h2 className="gh-eyebrow mb-4">
                  {t("playerProfile.compareWith")}
                </h2>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3">
                  {candidates.map((c) => (
                    <Link
                      key={c.id}
                      href={`/compare?a=${profile.slug}&b=${c.slug}`}
                      className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2.5 text-sm transition hover:border-brand-500/40 hover:bg-white/[0.05] sm:px-4 sm:py-3"
                    >
                      <span className="truncate font-semibold text-ink-100">
                        {c.fullName}
                      </span>
                      <span className="shrink-0 font-mono text-xs text-brand-300">
                        {c.points != null ? `${c.points.toFixed(1)} PPG` : "—"}
                      </span>
                    </Link>
                  ))}
                </div>
              </section>
            </LeagueTransition>
          ) : null}

          <FadeIn>
            <section>
              <h2 className="gh-eyebrow mb-4">
                {t("playerProfile.highlights")}
              </h2>
              <Suspense fallback={<HighlightsSkeleton />}>
                <HighlightsSection
                  playerId={profile.id}
                  playerName={profile.fullName}
                  teamName={selTeam?.name ?? null}
                  leagueName={selLeague.name}
                />
              </Suspense>
            </section>
          </FadeIn>

          <PlayerAi slug={profile.slug} name={profile.fullName} />
        </div>
      </div>
    </div>
  )
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-ink-400">{k}</dt>
      <dd className="text-right text-ink-100">{v}</dd>
    </div>
  )
}

function StatTile({
  label,
  value,
  unit,
  highlight = false,
}: {
  label: string
  value: number | null | undefined
  unit: string
  highlight?: boolean
}) {
  return (
    <div
      className="gh-card gh-card-interactive relative overflow-hidden p-4"
      style={
        highlight
          ? { borderColor: "color-mix(in oklch, var(--lg) 40%, transparent)" }
          : undefined
      }
    >
      {highlight ? (
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-[2px]"
          style={{ background: "var(--lg)" }}
        />
      ) : null}
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-400">
        {label}
      </p>
      <p
        className="mt-1 font-display text-3xl font-bold tabular-nums"
        style={highlight ? { color: "var(--lg)" } : { color: "var(--color-ink-50)" }}
      >
        {value != null ? value.toFixed(1) : "—"}
      </p>
      <p className="mt-1 font-mono text-xs text-ink-400">{unit}</p>
    </div>
  )
}

function ShootingTile({
  label,
  value,
}: {
  label: string
  value: number | null | undefined
}) {
  return (
    <div className="gh-card relative overflow-hidden p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-400">
        {label}
      </p>
      <p className="mt-1 font-display text-3xl font-bold tabular-nums text-ink-50">
        {value != null ? `${(value * 100).toFixed(1)}%` : "—"}
      </p>
      <div className="mt-3">
        <PctBar value={value} size="md" showLabel />
      </div>
    </div>
  )
}

function HighlightsSkeleton() {
  return (
    <div className="h-[84px] w-full animate-pulse rounded-lg border border-white/5 bg-white/[0.03]" />
  )
}
