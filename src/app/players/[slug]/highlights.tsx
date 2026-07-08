import { getPlayerVideo } from "@/lib/data/videos"
import { getT } from "@/lib/i18n/server"
import { youtubeWatchUrl } from "@/lib/highlights/youtube"

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

  const query = [playerName, teamName ?? "", "highlights"]
    .filter(Boolean)
    .join(" ")
  const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`
  const href = video ? youtubeWatchUrl(video.youtubeId) : searchUrl

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      aria-label={t("highlights.searchHeading", { name: playerName })}
      className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3.5 py-2 text-xs font-semibold text-ink-200 transition hover:border-brand-500/40 hover:bg-brand-500/10 hover:text-brand-200"
    >
      <svg
        viewBox="0 0 24 24"
        className="h-3.5 w-3.5"
        fill="currentColor"
        aria-hidden
      >
        <path d="M8 5v14l11-7z" />
      </svg>
      {t("highlights.label")}
      <span aria-hidden className="text-ink-400">↗</span>
    </a>
  )
}
