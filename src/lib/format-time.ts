type Translate = (
  path: string,
  vars?: Record<string, string | number>,
) => string

/**
 * Relative "time ago" built from the shared `footer.time.*` translation keys,
 * so the footer freshness line and the per-page "data updated" stamps read
 * identically in both locales.
 */
export function formatRelativeAgo(d: Date, t: Translate): string {
  const diff = Date.now() - d.getTime()
  if (diff < 0) return t("footer.time.justNow")
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return t("footer.time.seconds", { n: sec })
  const min = Math.floor(sec / 60)
  if (min < 60) return t("footer.time.minutes", { n: min })
  const hr = Math.floor(min / 60)
  if (hr < 48) return t("footer.time.hours", { n: hr })
  const day = Math.floor(hr / 24)
  return t("footer.time.days", { n: day })
}
