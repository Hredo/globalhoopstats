import { getPlayerVideo } from "@/lib/data/videos"
import { HighlightsPlayer } from "./highlights-player"
import { getT } from "@/lib/i18n/server"

type Props = {
  playerId: string
  playerName: string
  teamName?: string | null
  leagueName?: string | null
}

export async function HighlightsSection({
  playerId,
  playerName,
  teamName,
  leagueName,
}: Props) {
  const video = await getPlayerVideo(playerId, {
    playerName,
    teamName,
    leagueName,
  })
  const { t } = await getT()

  if (video) {
    return <HighlightsPlayer video={video} playerName={playerName} />
  }

  // No specific reel could be auto-matched — never dead-end. Fall back to a
  // styled link that opens a YouTube search for this player's highlights.
  const query = [playerName, teamName ?? "", "highlights"]
    .filter(Boolean)
    .join(" ")
  const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`

  return (
    <a
      href={searchUrl}
      target="_blank"
      rel="noreferrer noopener"
      aria-label={t("highlights.searchHeading", { name: playerName })}
      className="gh-card gh-card-interactive group flex items-center gap-4 p-4 sm:p-5"
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-500 text-ink-950 shadow-[var(--shadow-brand-glow)] transition duration-200 group-hover:scale-105 sm:h-14 sm:w-14">
        <PlayIcon />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-brand-300">
          {t("highlights.label")}
        </p>
        <p className="mt-0.5 text-sm font-semibold text-ink-50 sm:text-base">
          {t("highlights.searchHeading", { name: playerName })}
        </p>
        <p className="mt-0.5 truncate text-xs text-ink-400">
          {t("highlights.noReel")}
        </p>
      </div>
      <span
        aria-hidden
        className="shrink-0 font-mono text-xs font-semibold text-ink-300 transition group-hover:text-brand-200"
      >
        {t("highlights.open")}
      </span>
    </a>
  )
}

function PlayIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-6 w-6 sm:h-7 sm:w-7"
      fill="currentColor"
      aria-hidden
    >
      <path d="M8 5v14l11-7z" />
    </svg>
  )
}
