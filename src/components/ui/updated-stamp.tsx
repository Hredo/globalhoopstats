import { getT } from "@/lib/i18n/server"
import { formatRelativeAgo } from "@/lib/format-time"

/**
 * "Datos actualizados hace …" freshness stamp. Drop it on any page that shows
 * scraped data (league cards, player/team headers). Pass the relevant last-sync
 * `date` (per league) or null when no successful sync is known yet.
 */
export async function UpdatedStamp({
  date,
  className = "",
}: {
  date: Date | null
  className?: string
}) {
  const { t } = await getT()
  return (
    <p
      className={`flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-400 ${className}`}
      title={date ? date.toLocaleString() : undefined}
    >
      <span
        aria-hidden
        className={`relative inline-flex h-1.5 w-1.5 rounded-full ${
          date ? "bg-positive" : "bg-ink-600"
        }`}
      >
        {date ? (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-positive opacity-60" />
        ) : null}
      </span>
      {date
        ? t("common.dataUpdated", { ago: formatRelativeAgo(date, t) })
        : t("common.updatePending")}
    </p>
  )
}
