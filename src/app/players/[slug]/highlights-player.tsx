import { type StoredVideo } from "@/lib/highlights/youtube"
import { YouTubeEmbed } from "@/components/ui/youtube-embed"
import { getT } from "@/lib/i18n/server"

type Props = {
  video: StoredVideo
  playerName: string
}

export async function HighlightsPlayer({ video, playerName }: Props) {
  // The parent <section> already renders a "Highlights" heading, so this
  // component must NOT add a second "Highlight reel" eyebrow above the embed.
  const { t } = await getT()
  return (
    <YouTubeEmbed
      youtubeId={video.youtubeId}
      title={t("highlights.embedTitle", { name: playerName })}
    />
  )
}
