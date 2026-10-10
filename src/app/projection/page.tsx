import Link from "next/link"
import type { Metadata } from "next"
import { DirectoryHero } from "@/components/ui/directory-hero"
import { getT } from "@/lib/i18n/server"
import { pageSeo } from "@/lib/seo/metadata"
import { projectPlayer } from "@/lib/scouting/projection"
import { PROJECTED_KEYS, type Projection } from "@/lib/scouting/projection-model"
import { isSlug } from "@/lib/workspace/http"
import { ProjectionControls } from "./controls"

export async function generateMetadata(): Promise<Metadata> {
  const { t, locale } = await getT()
  return pageSeo({
    locale,
    path: "/projection",
    title: t("scouting.projection.title"),
    description: t("scouting.projection.lede"),
  })
}

type Props = { searchParams: Promise<{ player?: string; to?: string }> }

const LABEL: Record<(typeof PROJECTED_KEYS)[number], string> = {
  pts: "PTS",
  reb: "REB",
  ast: "AST",
  stl: "STL",
  blk: "BLK",
}

function Row({ label, a, b }: { label: string; a: number | null; b: number | null }) {
  const delta = a != null && b != null ? b - a : null
  return (
    <tr className="border-t border-hairline">
      <th scope="row" className="py-2.5 text-left font-mono text-[11px] uppercase tracking-[0.14em] text-ink-400">
        {label}
      </th>
      <td className="py-2.5 text-right font-mono tabular-nums text-ink-200">{a != null ? a.toFixed(1) : "—"}</td>
      <td className="py-2.5 text-right font-display text-lg font-bold tabular-nums text-ink-50">
        {b != null ? b.toFixed(1) : "—"}
      </td>
      <td
        className={`py-2.5 pl-3 text-right font-mono text-[12px] tabular-nums ${
          delta == null ? "text-ink-600" : delta < 0 ? "text-ember-400" : "text-positive"
        }`}
      >
        {delta == null ? "" : `${delta > 0 ? "+" : ""}${delta.toFixed(1)}`}
      </td>
    </tr>
  )
}

function Table({ actual, projected, t }: { actual: Projection; projected: Projection; t: (k: string) => string }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">
          <th />
          <th className="pb-2 text-right font-medium">{t("scouting.projection.actual")}</th>
          <th className="pb-2 text-right font-medium">{t("scouting.projection.projected")}</th>
          <th />
        </tr>
      </thead>
      <tbody>
        <Row label={t("scouting.projection.minutes")} a={actual.minutesPerGame} b={projected.minutesPerGame} />
        {PROJECTED_KEYS.map((k) => (
          <Row key={k} label={LABEL[k]} a={actual.perGame[k]} b={projected.perGame[k]} />
        ))}
        <Row
          label="TS%"
          a={actual.trueShooting != null ? actual.trueShooting * 100 : null}
          b={projected.trueShooting != null ? projected.trueShooting * 100 : null}
        />
      </tbody>
    </table>
  )
}

export default async function ProjectionPage({ searchParams }: Props) {
  const { t } = await getT()
  const sp = await searchParams
  const slug = isSlug(sp.player) ? sp.player : null
  const result = slug ? await projectPlayer(slug, sp.to ?? null) : null
  const ok = result && "projected" in result ? result : null

  return (
    <div className="pb-16">
      <DirectoryHero
        eyebrow={t("scouting.projection.eyebrow")}
        title={t("scouting.projection.title")}
        description={t("scouting.projection.lede")}
      />

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="gh-card space-y-6 p-5 sm:p-6">
          <ProjectionControls
            player={slug}
            playerName={ok?.player.fullName ?? null}
            from={ok?.from.league ?? null}
            to={ok?.to.league ?? null}
          />

          {!slug ? <p className="text-sm text-ink-400">{t("scouting.projection.empty")}</p> : null}
          {result && "error" in result ? (
            <p className="text-sm text-ink-400">{t("scouting.projection.noLine")}</p>
          ) : null}

          {ok ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-display text-2xl font-bold tracking-[-0.03em] text-ink-50">
                  <Link href={`/players/${ok.player.slug}`} className="hover:text-brand-300">
                    {ok.player.fullName}
                  </Link>
                  <span className="text-ink-500"> → </span>
                  {ok.to.leagueName}
                </h2>
                <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-400">
                  {t("scouting.projection.from", { season: ok.from.season, league: ok.from.leagueName })}
                </p>
              </div>
              <Table actual={ok.actual} projected={ok.projected} t={t} />
            </div>
          ) : null}
        </div>

        <aside className="space-y-4">
          {ok ? (
            <div className="gh-card p-5">
              <p className="gh-eyebrow">{t("nav.items.methodology.label")}</p>
              <p className="mt-3 text-[13px] leading-relaxed text-ink-300">
                {ok.factors.method === "transitions"
                  ? t("scouting.projection.methodTransitions", {
                      n: ok.factors.sample,
                      from: ok.from.leagueName,
                      to: ok.to.leagueName,
                    })
                  : ok.crossesTier
                    ? t("scouting.projection.methodTier")
                    : t("scouting.projection.methodModel")}
              </p>
            </div>
          ) : null}
          <p className="px-1 text-[12px] leading-relaxed text-ink-500">{t("scouting.projection.disclaimer")}</p>
        </aside>
      </div>
    </div>
  )
}
