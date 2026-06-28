import Image from "next/image"
import Link from "next/link"
import { getLeagueTheme } from "@/lib/league-styles"
import type { LeagueOverview as LeagueOverviewData } from "@/lib/data/leagues"
import { CountUp } from "@/components/marketing/count-up"
import { SmartImage } from "@/components/ui/smart-image"
import { UpdatedStamp } from "@/components/ui/updated-stamp"
import { getT } from "@/lib/i18n/server"

type Props = {
  data: LeagueOverviewData
  index: number
  lastSyncAt?: Date | null
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase()
}

export async function LeagueOverview({ data, index, lastSyncAt = null }: Props) {
  const theme = getLeagueTheme(data.slug)
  const accentBarStyle = { background: theme.glowVar }
  const { t, locale } = await getT()

  return (
    <article
      className={`group relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/15 bg-surface-1 p-5 ring-1 ring-inset ring-white/10 transition hover:border-white/25 sm:p-6 ${theme.ring}`}
      style={{ ["--tw-shadow" as string]: theme.glowVar }}
    >
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-0.5"
        style={accentBarStyle}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full opacity-25 blur-3xl"
        style={{ background: theme.glowVar }}
      />

      <header className="relative flex items-start gap-3">
        {data.logoUrl ? (
          <Image
            src={data.logoUrl}
            alt={`${data.name} logo`}
            width={48}
            height={48}
            className="h-12 w-12 shrink-0 rounded-lg border border-white/10 bg-white/95 object-contain p-1.5"
            unoptimized
          />
        ) : (
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-white/10 font-display text-sm font-bold ${theme.chip}`}
          >
            {theme.label}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-300 sm:text-[11px]">
            {data.region}
            {data.seasonLabel ? (
              <>
                <span className="mx-1.5 text-ink-500">·</span>
                {locale === "es" ? (
                  <>
                    {t("directory.leagues.seasonWord")}{" "}
                    <span className={theme.accentText}>{data.seasonLabel}</span>
                  </>
                ) : (
                  <>
                    <span className={theme.accentText}>{data.seasonLabel}</span>{" "}
                    {t("directory.leagues.seasonWord")}
                  </>
                )}
              </>
            ) : null}
          </p>
          <h2 className="mt-1 font-display text-2xl font-bold leading-tight text-ink-50 sm:text-[1.7rem]">
            {data.name}
          </h2>
        </div>
        <span
          className={`hidden shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest sm:inline-flex ${theme.chip}`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {t("directory.leagues.live")}
        </span>
      </header>

      <UpdatedStamp date={lastSyncAt} className="relative mt-3" />

      <dl className="relative mt-5 grid grid-cols-3 gap-3 sm:gap-4">
        {[
          { value: data.teamCount, labelKey: "directory.leagues.teams" },
          { value: data.playerCount, labelKey: "directory.leagues.players" },
          { value: data.coachCount, labelKey: "directory.leagues.coaches" },
        ].map((s) => (
          <div
            key={s.labelKey}
            className="rounded-lg border border-white/10 bg-surface-0/80 px-2.5 py-2 sm:px-3 sm:py-2.5"
          >
            <dt className="font-display text-xl font-bold tabular-nums text-ink-50 sm:text-2xl">
              <CountUp to={s.value} duration={900 + index * 120} />
            </dt>
            <dd className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-ink-400 sm:text-[10px]">
              {t(s.labelKey)}
            </dd>
          </div>
        ))}
      </dl>

      {data.teams.length > 0 ? (
        <div className="relative mt-4">
          <div className="flex flex-wrap gap-2">
            {data.teams.map((team) => (
              <Link
                key={team.slug}
                href={`/teams/${data.slug}/${team.slug}`}
                title={team.name}
                aria-label={team.name}
                className="group/team relative rounded-full outline-none transition duration-200 hover:z-10 hover:scale-110 focus-visible:ring-2 focus-visible:ring-white/40"
              >
                {team.logoUrl ? (
                  <div className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-surface-0/80 transition group-hover/team:border-white/30 sm:h-8 sm:w-8">
                    <SmartImage
                      src={team.logoUrl}
                      alt={team.name}
                      fit="contain"
                      fallbackClassName="text-[8px] font-bold text-ink-400"
                      fallback={initials(team.name)}
                    />
                  </div>
                ) : (
                  <div className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-surface-0/80 font-display text-[8px] font-bold text-ink-400 transition group-hover/team:border-white/30 sm:h-8 sm:w-8">
                    {initials(team.name)}
                  </div>
                )}
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      <div
        aria-hidden
        className={`my-4 h-px bg-gradient-to-r from-transparent ${theme.divider} to-transparent`}
      />

      <div className="relative grid grid-cols-2 gap-2.5 sm:gap-3">
        {[
          {
            label: "PPG",
            value: data.topScorers[0]?.ppg ?? null,
            playerName: data.topScorers[0]?.fullName ?? null,
            playerSlug: data.topScorers[0]?.slug ?? null,
            playerImage: data.topScorers[0]?.imageUrl ?? null,
            teamName: data.topScorers[0]?.team?.name ?? null,
          },
          {
            label: "APG",
            value: data.topAssists?.value ?? null,
            playerName: data.topAssists?.fullName ?? null,
            playerSlug: data.topAssists?.slug ?? null,
            playerImage: data.topAssists?.imageUrl ?? null,
            teamName: data.topAssists?.teamName ?? null,
          },
          {
            label: "RPG",
            value: data.topRebounds?.value ?? null,
            playerName: data.topRebounds?.fullName ?? null,
            playerSlug: data.topRebounds?.slug ?? null,
            playerImage: data.topRebounds?.imageUrl ?? null,
            teamName: data.topRebounds?.teamName ?? null,
          },
          {
            label: "3P%",
            value: data.topThreePtPct?.value ?? null,
            playerName: data.topThreePtPct?.fullName ?? null,
            playerSlug: data.topThreePtPct?.slug ?? null,
            playerImage: data.topThreePtPct?.imageUrl ?? null,
            teamName: data.topThreePtPct?.teamName ?? null,
          },
        ]
          .filter((s) => s.value != null && s.playerName && s.playerSlug)
          .map((s) => (
            <StatHighlightCard key={s.label} {...s} theme={theme} />
          ))}
      </div>

      <div className="mt-auto pt-5" />

      <footer className="relative grid grid-cols-2 gap-2">
        <Link
          href={`/players?league=${data.slug}`}
          className="group/btn inline-flex items-center justify-center gap-1.5 rounded-md border border-white/10 bg-surface-0/80 px-3 py-2 text-xs font-semibold text-ink-50 transition hover:border-white/25 hover:bg-surface-0 sm:text-sm"
        >
          {t("directory.leagues.browsePlayers")}
          <svg
            className="h-3.5 w-3.5 transition group-hover/btn:translate-x-0.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M5 12h14M13 5l7 7-7 7" />
          </svg>
        </Link>
        <Link
          href={`/teams?league=${data.slug}`}
          className={`group/btn inline-flex items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-xs font-semibold transition sm:text-sm ${theme.accentBorder} ${theme.accentText} hover:bg-white/[0.06]`}
          style={{
            background: `color-mix(in oklab, var(--shadow-league-${theme.key}) 12%, transparent)`,
          }}
        >
          {t("directory.leagues.browseTeams")}
          <svg
            className="h-3.5 w-3.5 transition group-hover/btn:translate-x-0.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M5 12h14M13 5l7 7-7 7" />
          </svg>
        </Link>
      </footer>
    </article>
  )
}

function StatHighlightCard({
  label,
  value,
  playerName,
  playerSlug,
  playerImage,
  teamName,
  theme,
}: {
  label: string
  value: number | null
  playerName: string | null
  playerSlug: string | null
  playerImage: string | null
  teamName: string | null
  theme: ReturnType<typeof getLeagueTheme>
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-surface-0/80 px-2.5 py-2 sm:px-3 sm:py-2.5">
      <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-ink-500 sm:text-[10px]">
        {label}
      </p>
      {playerName && playerSlug ? (
        <Link
          href={`/players/${playerSlug}`}
          className="group/stat mt-0.5 flex items-center gap-1.5"
        >
          {playerImage ? (
            <Image
              src={playerImage}
              alt={playerName}
              width={18}
              height={18}
              className="h-4 w-4 shrink-0 rounded-full border border-white/10 object-cover sm:h-[18px] sm:w-[18px]"
              unoptimized
            />
          ) : (
            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-white/10 font-display text-[6px] font-bold text-ink-400 sm:h-[18px] sm:w-[18px]">
              {initials(playerName)}
            </span>
          )}
          <span className="min-w-0 truncate text-xs font-medium text-ink-100 transition group-hover/stat:text-white sm:text-sm">
            {playerName}
          </span>
        </Link>
      ) : (
        <p className="mt-0.5 text-xs text-ink-500 sm:text-sm">—</p>
      )}
      {value != null ? (
        <p className={`mt-0.5 font-display text-lg font-bold tabular-nums sm:text-xl ${theme.accentText}`}>
          {value.toFixed(1)}
        </p>
      ) : null}
      {teamName ? (
        <p className="truncate font-mono text-[8px] uppercase tracking-wider text-ink-500 sm:text-[9px]">
          {teamName}
        </p>
      ) : null}
    </div>
  )
}
