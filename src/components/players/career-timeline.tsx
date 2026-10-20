import Link from "next/link"
import type { PlayerCareerLine } from "@/lib/data/players"
import { buildCareerTimeline, type CareerMove } from "@/lib/scouting/career"
import { leagueAccent } from "@/components/ui/league-badge"
import { getT } from "@/lib/i18n/server"

const ROW_PX = 40
const COL_MIN_PX = 64

/**
 * The whole career on one ladder: one column per season, one row per league
 * (strongest at the top), and the path the player took through them. Below
 * it, every run with a club, oldest first, with how the player got there.
 *
 * Reads `allSeasons`, so it is the same across the league switcher.
 */
export async function CareerTimeline({
  career,
}: {
  career: PlayerCareerLine[]
}) {
  const tl = buildCareerTimeline(career)
  if (tl.seasons.length < 2) return null
  const { t } = await getT()

  const cols = tl.seasons.length
  const rows = tl.leagues.length
  const showLadder = rows >= 2
  const xPct = (x: number) => ((x + 0.5) / cols) * 100
  const yPct = (y: number) => ((y + 0.5) / rows) * 100
  const path = tl.points
    .filter((p) => p.main)
    .map((p) => `${xPct(p.x)},${yPct(p.y)}`)
    .join(" ")

  const moveLabel: Record<CareerMove, string> = {
    up: t("playerProfile.career.moveUp"),
    down: t("playerProfile.career.moveDown"),
    transfer: t("playerProfile.career.moveTransfer"),
  }

  return (
    <section aria-labelledby="career-title">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <h2 id="career-title" className="gh-eyebrow">
          {t("playerProfile.career.title")}
        </h2>
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-500">
          {t("playerProfile.career.summary", {
            seasons: cols,
            leagues: rows,
          })}
        </p>
      </div>

      {showLadder ? (
        <figure
          className="gh-card overflow-x-auto p-4 sm:p-5"
          aria-label={t("playerProfile.career.ladderLabel")}
        >
          <div
            className="grid grid-cols-[minmax(84px,auto)_1fr] gap-x-3"
            style={{ minWidth: 96 + cols * COL_MIN_PX }}
          >
            <ul aria-hidden className="flex flex-col">
              {tl.leagues.map((l) => (
                <li
                  key={l.slug}
                  className="flex items-center gap-2 truncate text-[12px] font-semibold text-ink-300"
                  style={{ height: ROW_PX }}
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: leagueAccent(l.slug).color }}
                  />
                  {l.name}
                </li>
              ))}
            </ul>

            <div className="relative" style={{ height: rows * ROW_PX }}>
              {tl.leagues.map((l, i) => (
                <span
                  key={l.slug}
                  aria-hidden
                  className="absolute inset-x-0 border-t border-dashed border-hairline"
                  style={{ top: `${yPct(i)}%` }}
                />
              ))}
              <svg
                aria-hidden
                className="absolute inset-0 h-full w-full overflow-visible"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
              >
                <polyline
                  points={path}
                  fill="none"
                  stroke="var(--color-ink-500)"
                  strokeWidth={2}
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
              {tl.points.map((p) => {
                const league = tl.leagues[p.y]
                return (
                  <span
                    key={`${p.season}-${league.slug}-${p.main}`}
                    title={`${p.season} · ${league.name} · ${t("playerProfile.career.games", { n: p.games })}`}
                    className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full"
                    style={{
                      left: `${xPct(p.x)}%`,
                      top: `${yPct(p.y)}%`,
                      background: leagueAccent(league.slug).color,
                      opacity: p.main ? 1 : 0.55,
                    }}
                  />
                )
              })}
            </div>

            <span aria-hidden />
            <ol aria-hidden className="mt-2 flex">
              {tl.seasons.map((s) => (
                <li
                  key={s}
                  className="flex-1 text-center font-mono text-[10px] tabular-nums text-ink-500"
                >
                  {s}
                </li>
              ))}
            </ol>
          </div>
        </figure>
      ) : null}

      <ol className={showLadder ? "mt-3 space-y-1.5" : "space-y-1.5"}>
        {tl.stints.map((s) => (
          <li
            key={`${s.from}-${s.league.slug}-${s.team?.slug ?? ""}`}
            className="grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-0.5 rounded-xl border border-hairline px-3 py-2.5 text-sm sm:px-4"
          >
            <span className="font-mono text-[11px] tabular-nums text-ink-400">
              {s.from === s.to ? s.from : `${s.from} – ${s.to}`}
            </span>
            <span className="flex min-w-0 items-center gap-2">
              <span
                aria-hidden
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: leagueAccent(s.league.slug).color }}
              />
              <span className="truncate">
                {s.team ? (
                  <Link
                    href={`/teams/${s.league.slug}/${s.team.slug}`}
                    className="font-semibold text-ink-100 transition hover:text-brand-300"
                  >
                    {s.team.name}
                  </Link>
                ) : (
                  <span className="font-semibold text-ink-100">
                    {t("playerProfile.freeAgent")}
                  </span>
                )}
                <span className="text-ink-400"> · {s.league.name}</span>
              </span>
              {s.move ? (
                <span
                  className={
                    s.move === "up"
                      ? "shrink-0 rounded-md bg-positive/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-positive"
                      : "shrink-0 rounded-md border border-hairline px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-400"
                  }
                >
                  {moveLabel[s.move]}
                </span>
              ) : null}
            </span>
            <span className="text-right font-mono text-[11px] tabular-nums text-ink-400">
              {t("playerProfile.career.games", { n: s.games })}
              {s.ppg != null ? (
                <span className="ml-2 text-ink-200">
                  {s.ppg.toFixed(1)} PPG
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}
