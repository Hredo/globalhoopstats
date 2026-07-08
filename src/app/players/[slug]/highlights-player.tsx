import { type StoredVideo } from "@/lib/highlights/youtube"
import { youtubeWatchUrl } from "@/lib/highlights/youtube"
import { getT } from "@/lib/i18n/server"

type Props = {
  video: StoredVideo
  playerName: string
}

export async function HighlightsPlayer({ video, playerName }: Props) {
  const { t } = await getT()
  return (
    <a
      href={youtubeWatchUrl(video.youtubeId)}
      target="_blank"
      rel="noreferrer noopener"
      aria-label={t("highlights.embedTitle", { name: playerName })}
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
