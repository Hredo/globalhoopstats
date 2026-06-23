import Link from "next/link"
import type { Metadata } from "next"
import { getPlayerForCompare } from "@/lib/data/compare"
import { CompareSearch } from "@/components/players/compare-search"
import { CompareRadar } from "@/components/players/compare-radar"
import { CompareAi } from "@/components/players/compare-ai"
import { CompareStatsTable } from "@/components/players/compare-stats-table"
import { CompareMarketValue } from "@/components/players/compare-market-value"
import { CompareVsDivider } from "@/components/players/compare-vs-divider"
import { getMarketPlayerBySlug } from "@/lib/market/pool"
import { Reveal } from "@/components/animations/reveal"
import { ScaleIn } from "@/components/animations/scale-in"
import { Eyebrow } from "@/components/ui/eyebrow"
import { SmartImage } from "@/components/ui/smart-image"
import { leagueAccent } from "@/components/ui/league-badge"
import { getT } from "@/lib/i18n/server"

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT()
  return {
    title: t("compare.metaTitle"),
    description: t("compare.metaDescription"),
  }
}

type Search = { a?: string; b?: string }

export default async function ComparePage(props: {
  searchParams: Promise<Search>
}) {
  const sp = await props.searchParams
  const aSlug = (sp.a ?? "").trim() || "nba-luka-doncic"
  const bSlug = (sp.b ?? "").trim() || "nba-nikola-jokic"
  const [playerA, playerB, marketA, marketB] = await Promise.all([
    getPlayerForCompare(aSlug),
    getPlayerForCompare(bSlug),
    getMarketPlayerBySlug(aSlug).catch(() => null),
    getMarketPlayerBySlug(bSlug).catch(() => null),
  ])
  const { t } = await getT()

  const showMarketValue =
    (marketA?.valuation?.eur ?? 0) > 0 && (marketB?.valuation?.eur ?? 0) > 0

  return (
    <div className="relative pb-12 pt-10 sm:pt-14">
      <Reveal>
        <header className="mb-8">
          <Eyebrow>{t("compare.eyebrow")}</Eyebrow>
          <h1 className="mt-4 font-display text-5xl font-bold leading-[0.86] tracking-[-0.045em] text-ink-50 sm:text-6xl md:text-7xl">
            {t("compare.titleA")}{" "}
            <span className="text-gradient-brand">{t("compare.titleB")}</span>
          </h1>
          <p className="mt-5 max-w-2xl text-pretty text-sm leading-relaxed text-ink-300 sm:text-base">
            {t("compare.description")}
          </p>
        </header>
      </Reveal>

      <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2">
        <Reveal direction="right">
          <CompareSearch side="a" current={playerA} otherSlug={bSlug} />
        </Reveal>
        <Reveal direction="left">
          <CompareSearch side="b" current={playerB} otherSlug={aSlug} />
        </Reveal>
      </div>

      <div className="mt-6 grid grid-cols-1 items-stretch gap-4 sm:mt-8 sm:gap-5 md:grid-cols-[1fr_auto_1fr]">
        <Reveal direction="right" amount={0.1}>
          <ComparePlayerCard side="a" player={playerA} requested={aSlug} />
        </Reveal>
        <ScaleIn delay={0.25} amount={0.5}>
          <CompareVsDivider label={t("compare.vs")} />
        </ScaleIn>
        <Reveal direction="left" amount={0.1}>
          <ComparePlayerCard side="b" player={playerB} requested={bSlug} />
        </Reveal>
      </div>

      {playerA && playerB ? (
        <>
          <Reveal>
            <section className="mt-6 sm:mt-8">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_380px]">
                <ScaleIn amount={0.15}>
                  <div className="gh-card p-4 sm:p-5">
                    <h2 className="gh-eyebrow">{t("compare.fullStats")}</h2>
                    <div className="mt-4">
                      <CompareStatsTable a={playerA} b={playerB} />
                    </div>
                  </div>
                </ScaleIn>
                <ScaleIn amount={0.15} delay={0.12}>
                  <div className="gh-card p-4 sm:p-5">
                    <h2 className="gh-eyebrow">{t("compare.radar")}</h2>
                    <div className="mt-4 aspect-square w-full">
                      <CompareRadar a={playerA} b={playerB} />
                    </div>
                  </div>
                </ScaleIn>
              </div>
            </section>
          </Reveal>
        </>
      ) : null}

      {playerA && playerB && showMarketValue && marketA?.valuation && marketB?.valuation ? (
        <Reveal>
          <section className="mt-6 sm:mt-8">
            <CompareMarketValue
              aName={playerA.fullName}
              bName={playerB.fullName}
              a={marketA.valuation}
              b={marketB.valuation}
            />
          </section>
        </Reveal>
      ) : null}

      {playerA && playerB ? (
        <ScaleIn amount={0.15}>
          <div id="ai-analysis" className="mt-6 scroll-mt-24 sm:mt-8">
            <CompareAi
              aSlug={playerA.slug}
              bSlug={playerB.slug}
              aName={playerA.fullName}
              bName={playerB.fullName}
            />
          </div>
        </ScaleIn>
      ) : null}
    </div>
  )
}

async function ComparePlayerCard({
  side,
  player,
  requested,
}: {
  side: "a" | "b"
  player: Awaited<ReturnType<typeof getPlayerForCompare>>
  requested: string
}) {
  const { t } = await getT()
  if (!player) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-hairline-strong p-8 text-center">
        <p className="text-sm text-ink-200">
          {t("compare.noPlayerFound", { name: requested })}
        </p>
        <p className="mt-1 text-xs text-ink-400">
          {t("compare.searchAbove")}
        </p>
      </div>
    )
  }
  const initials = player.fullName
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
  const accent = leagueAccent(player.league.slug)
  return (
    <article
      className="gh-card relative overflow-hidden p-5"
      style={{ ["--lg" as string]: accent.color }}
    >
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-[3px] opacity-70"
        style={{ background: "var(--lg)" }}
      />
      <div
        className={`flex items-center gap-4 ${
          side === "b" ? "md:flex-row-reverse md:text-right" : ""
        }`}
      >
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-court-800 ring-1 ring-hairline">
          <SmartImage
            src={player.imageUrl}
            alt={player.fullName}
            fit="cover"
            eager
            fallbackClassName="text-sm font-bold text-ink-300"
            fallback={initials}
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-lg font-bold tracking-[-0.01em] text-ink-50">
            <Link
              href={`/players/${player.slug}`}
              className="transition-colors hover:text-brand-300"
            >
              {player.fullName}
            </Link>
          </p>
          <p className="mt-0.5 truncate text-xs text-ink-300">
            {player.team?.name ?? t("compare.freeAgent")} · {player.league.name}
          </p>
          <p className="mt-1 truncate font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">
            {player.position ?? "—"} · {player.nationality ?? "—"}
          </p>
        </div>
      </div>
      {player.stats ? (
        <p
          className={`mt-4 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-400 ${
            side === "b" ? "md:text-right" : ""
          }`}
        >
          {t("compare.seasonGp", {
            season: player.stats.seasonName,
            gp: player.stats.gamesPlayed,
          })}
        </p>
      ) : (
        <p className="mt-4 text-xs text-ink-400">{t("compare.noStats")}</p>
      )}
    </article>
  )
}
