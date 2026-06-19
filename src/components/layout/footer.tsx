import Link from "next/link"
import { Logo } from "@/components/svg/logo"
import { SITE } from "@/lib/site"
import { getLatestSyncTime } from "@/lib/data/sync"
import { getT, type ServerTranslator } from "@/lib/i18n/server"

function formatRelative(d: Date, t: ServerTranslator["t"]): string {
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

const EXPLORE = [
  { href: "/players", labelKey: "nav.players" },
  { href: "/teams", labelKey: "nav.teams" },
  { href: "/coaches", labelKey: "nav.coaches" },
]

const TOOLS = [
  { href: "/compare", labelKey: "nav.compare" },
  { href: "/leagues", labelKey: "nav.leagues" },
  { href: "/ai-advisor", labelKey: "nav.aiAdvisor" },
]

const LEGAL = [
  { href: "/contact", labelKey: "footer.contact" },
  { href: "/terms", labelKey: "footer.terms" },
  { href: "/privacy", labelKey: "footer.privacy" },
]

export async function Footer() {
  const lastSync = await getLatestSyncTime()
  const { t } = await getT()
  const localize = (arr: { href: string; labelKey: string }[]) =>
    arr.map((l) => ({ href: l.href, label: t(l.labelKey) }))

  return (
    <footer className="relative mt-20 bg-surface-1/80 sm:mt-28">
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-500/40 to-transparent"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-grid-fade opacity-30"
      />
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="flex flex-col gap-4">
            <Link
              href="/"
              className="flex items-center gap-2.5 text-ink-50"
              aria-label={`${SITE.name} — ${t("common.home")}`}
            >
              <Logo className="h-8 w-8" />
              <span className="font-display text-lg font-bold tracking-[-0.02em]">
                globalhoopstats<span className="text-brand-500">.</span>
              </span>
            </Link>
            <p className="max-w-xs text-sm leading-relaxed text-ink-300">
              {t("footer.tagline")}
            </p>
            <p className="mt-1 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-400">
              <span
                aria-hidden
                className={`relative inline-flex h-1.5 w-1.5 rounded-full ${
                  lastSync ? "bg-positive" : "bg-ink-600"
                }`}
              >
                {lastSync ? (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-positive opacity-60" />
                ) : null}
              </span>
              {lastSync
                ? t("footer.synced", { ago: formatRelative(lastSync, t) })
                : t("footer.syncPending")}
            </p>
          </div>

          <FooterColumn title={t("footer.explore")} links={localize(EXPLORE)} />
          <FooterColumn title={t("footer.tools")} links={localize(TOOLS)} />
          <FooterColumn title={t("footer.company")} links={localize(LEGAL)} />
        </div>

        <div className="mt-12 flex flex-col gap-3 hairline-t pt-6 text-xs text-ink-400 sm:flex-row sm:items-center sm:justify-between">
          <p>
            {t("footer.rights", { year: new Date().getFullYear(), name: SITE.name })}
            <span className="ml-3 font-mono text-[10px] tracking-[0.12em] text-ink-500">
              {t("footer.version", { version: "0.1.0" })}
            </span>
          </p>
          <p className="font-mono uppercase tracking-[0.16em]">
            NBA · EuroLeague · ACB · LEB Oro · LEB Plata · EBA
          </p>
        </div>
      </div>
    </footer>
  )
}

function FooterColumn({
  title,
  links,
}: {
  title: string
  links: { href: string; label: string }[]
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-400">
        {title}
      </p>
      <nav className="flex flex-col gap-2.5 text-sm text-ink-200" aria-label={title}>
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="w-fit transition-colors duration-200 hover:text-brand-300"
          >
            {l.label}
          </Link>
        ))}
      </nav>
    </div>
  )
}
