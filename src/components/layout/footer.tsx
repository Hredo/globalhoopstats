import Link from "next/link"
import { Logo } from "@/components/svg/logo"
import { SITE } from "@/lib/site"
import { getLatestSyncTime } from "@/lib/data/sync"
import { formatRelativeAgo } from "@/lib/format-time"
import { getT } from "@/lib/i18n/server"

const EXPLORE = [
  { href: "/players", labelKey: "nav.players" },
  { href: "/teams", labelKey: "nav.teams" },
  { href: "/coaches", labelKey: "nav.coaches" },
]

const TOOLS = [
  { href: "/compare", labelKey: "nav.compare" },
  { href: "/leagues", labelKey: "nav.leagues" },
  { href: "/ai-advisor", labelKey: "nav.aiAdvisor" },
  { href: "/market/trade", labelKey: "nav.trade" },
  { href: "/install", labelKey: "footer.installApp" },
]

const LEGAL = [
  { href: "/contact", labelKey: "footer.contact" },
  { href: "/methodology", labelKey: "footer.methodology" },
  { href: "/terms", labelKey: "footer.terms" },
  { href: "/privacy", labelKey: "footer.privacy" },
]

export async function Footer() {
  const lastSync = await getLatestSyncTime()
  const { t } = await getT()
  const localize = (arr: { href: string; labelKey: string }[]) =>
    arr.map((l) => ({ href: l.href, label: t(l.labelKey) }))

  return (
    <footer className="relative mt-20 border-t-2 border-hairline-strong bg-surface-1/80 sm:mt-28">
      {/* measurement ticks hanging from the top rule — the closing baseline */}
      <div aria-hidden className="gh-ticks h-1.5 w-full -scale-y-100" />
      <div className="mx-auto max-w-7xl px-4 pb-8 pt-10 sm:px-6 sm:pt-14">
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
                className={`relative inline-flex h-1.5 w-1.5 ${
                  lastSync ? "bg-positive" : "bg-ink-600"
                }`}
              >
                {lastSync ? (
                  <span className="absolute inline-flex h-full w-full animate-ping bg-positive opacity-60" />
                ) : null}
              </span>
              {lastSync
                ? t("footer.synced", { ago: formatRelativeAgo(lastSync, t) })
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
              {t("footer.version", { version: "1.0.0" })}
            </span>
          </p>
          <p className="font-mono uppercase tracking-[0.16em]">
            NBA · EuroLeague · ACB · Primera FEB · Segunda FEB · Tercera FEB
          </p>
        </div>

        <p className="mt-6 max-w-4xl text-[11px] leading-relaxed text-ink-500">
          {t("footer.disclaimer")}
        </p>
      </div>

      {/* jersey-letter watermark — the nameplate, set like arena flooring */}
      <div
        aria-hidden
        className="pointer-events-none select-none overflow-hidden"
      >
        <svg
          className="mx-auto -mb-[0.16em] block w-full opacity-[0.14]"
          viewBox="0 -74 964 78"
          preserveAspectRatio="xMidYMid meet"
          role="presentation"
        >
          <text
            x="0"
            y="0"
            fontSize="100"
            className="font-display font-bold"
            style={{
              fill: "transparent",
              stroke: "var(--color-ink-300)",
              strokeWidth: 1.5,
              letterSpacing: "-0.02em",
              vectorEffect: "non-scaling-stroke",
            }}
          >
            GLOBALHOOPSTATS
          </text>
        </svg>
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
      <p className="text-condensed text-[10px] tracking-[0.18em] text-ink-500">
        {title}
      </p>
      <nav className="flex flex-col gap-2.5 text-sm text-ink-200" aria-label={title}>
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="w-fit transition-colors duration-200 hover:text-brand-400"
          >
            {l.label}
          </Link>
        ))}
      </nav>
    </div>
  )
}
