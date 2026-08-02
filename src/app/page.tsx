import { existsSync } from "node:fs"
import { join } from "node:path"
import type { Metadata } from "next"
import { Reveal } from "@/components/animations/reveal"
import { ScrollFilm } from "@/components/marketing/scroll-film"
import { LiveShowcase } from "@/components/marketing/live-showcase"
import { Marquee } from "@/components/marketing/marquee"
import { JsonLd } from "@/components/marketing/json-ld"
import { DataProvenance } from "@/components/marketing/data-provenance"
import { Testimonials } from "@/components/marketing/testimonials"
import { EmailSubscribe } from "@/components/marketing/email-subscribe"
import { Faq } from "@/components/marketing/faq"
import { getFaqData } from "@/components/marketing/faq-data"
// NOTE: PricingCta commented out until subscriptions are re-enabled.
// import { PricingCta } from "@/components/marketing/pricing-cta"
import { Eyebrow } from "@/components/ui/eyebrow"
import { SectionHeading } from "@/components/ui/section-heading"
import { ButtonLink } from "@/components/ui/button"
import { SITE } from "@/lib/site"
import { getLocale, getT } from "@/lib/i18n/server"
import { getDictionary } from "@/lib/i18n/dictionaries"
import { getGlobalLeagueCounts, listLeagueOverviews } from "@/lib/data/leagues"
import { getLatestSyncTime } from "@/lib/data/sync"
import { formatRelativeAgo } from "@/lib/format-time"

const TICKER_LEFT = [
  { name: "Shai Gilgeous-Alexander", team: "OKC · NBA", stat: "31.4 PPG" },
  { name: "Lorenzo Brown", team: "MCO · EuroLeague", stat: "8.1 APG" },
  { name: "Victor Wembanyama", team: "SAS · NBA", stat: "3.6 BPG" },
  { name: "Edy Tavares", team: "RMB · EuroLeague", stat: "6.9 RPG" },
  { name: "Trae Young", team: "ATL · NBA", stat: "11.6 APG" },
  { name: "Markus Howard", team: "BAS · EuroLeague", stat: "19.2 PPG" },
  { name: "Giannis Antetokounmpo", team: "MIL · NBA", stat: "30.8 PPG" },
  { name: "Dzanan Musa", team: "RMB · EuroLeague", stat: "14.7 PPG" },
]

const TICKER_RIGHT = [
  { name: "SGA", stat: "31.4 / 5.8 / 6.7" },
  { name: "Wembanyama", stat: "23.5 / 10.8 / 3.6" },
  { name: "Giannis", stat: "30.8 / 12.1 / 6.5" },
  { name: "L. Brown", stat: "13.2 / 3.1 / 8.1" },
  { name: "Howard", stat: "19.2 / 2.4 / 3.1" },
  { name: "Trae Young", stat: "26.4 / 3.2 / 11.6" },
  { name: "Musa", stat: "14.7 / 3.4 / 2.8" },
  { name: "Tavares", stat: "10.8 / 6.9 / 1.9" },
]

// Frame count of each extracted hero film sequence (dark/light), full 24fps.
const FILM_FRAMES = 240

// Product-demo scenes whose recorded clip already exists on disk. Resolved at
// render time so a card in <LiveShowcase> flips from placeholder to live video
// automatically the moment its capture lands in public/media/previews — no code
// change needed (the auth-gated ai-advisor/trade clips are captured separately).
const SHOWCASE_KEYS = ["player", "compare", "ai-advisor", "trade", "playbook"] as const
function readyShowcaseKeys(): string[] {
  return SHOWCASE_KEYS.filter((k) =>
    existsSync(
      join(process.cwd(), "public", "media", "previews", `${k}-dark.mp4`),
    ),
  )
}

export const revalidate = 3600

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  const dict = getDictionary(locale)
  return {
    // Absolute title (skips the "· globalhoopstats" template) so the homepage —
    // the page that ranks for the brand query — leads with the brand name.
    title: {
      absolute: dict.home.metaTitle,
    },
    description: dict.metadata.description,
    alternates: { canonical: "/" },
    openGraph: {
      title: `${SITE.name} — ${dict.metadata.tagline}`,
      description: dict.metadata.description,
      url: SITE.url,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${SITE.name} — ${dict.metadata.tagline}`,
      description: dict.metadata.description,
    },
  }
}

export default async function Home() {
  const { t, locale } = await getT()
  const dict = getDictionary(locale)
  const [globalCounts, leagues, lastSync] = await Promise.all([
    getGlobalLeagueCounts(),
    listLeagueOverviews(),
    getLatestSyncTime(),
  ])
  const updated = lastSync ? formatRelativeAgo(lastSync, t) : ""
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: getFaqData(locale).map((q) => ({
      "@type": "Question",
      name: q.question,
      acceptedAnswer: { "@type": "Answer", text: q.answer },
    })),
  }

  const softwareJsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: SITE.name,
    url: SITE.url,
    applicationCategory: "SportsApplication",
    applicationSubCategory: "Basketball Analytics",
    operatingSystem: "Web",
    description: SITE.description,
    offers: [
      {
        "@type": "Offer",
        name: "Public beta",
        price: "0",
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
      },
    ],
    featureList: [
      "Cross-league player comparison",
      "Pace and possession normalization",
      "Advanced metrics (PER, ORtg, DRtg, NetRtg, TS%)",
      "Player market valuations (transparent heuristic)",
      "Trade simulator with balanced scenarios",
      "League hubs with leaders",
      "AI advisor for scouting queries",
      "Exports to PDF, Excel and Word",
    ],
  }

  return (
    <div className="relative">
      <JsonLd data={[faqJsonLd, softwareJsonLd]} />

      {/* ── HERO — full-bleed scroll film: the camera pushes in on a ball
             (dark low-lit court in dark mode, bright seaside street court in
             light mode) while marketing lines fly in from the sides, then the
             ball is thrown at the lens and the impact hands off to the page.
             Frames extracted from the two Veo clips (dark court / seaside
             street court) live in /media/film/{dark,light}. */}
      <ScrollFilm
        dark={{
          intro: "/media/film/dark/f000.webp",
          framePath: "/media/film/dark",
          frames: FILM_FRAMES,
        }}
        light={{
          intro: "/media/film/light/f000.webp",
          framePath: "/media/film/light",
          frames: FILM_FRAMES,
        }}
        introAlt={t("home.film.introAlt")}
        texts={dict.home.film.side}
        headline={{
          kicker: t("home.film.kicker"),
          title: t("home.film.title"),
          accent: t("home.film.accent"),
        }}
        ctaPrimary={{ href: "/ai-advisor", label: t("home.hero.aiAdvisor") }}
        ctaSecondary={{
          href: "/compare",
          label: t("home.hero.comparePlayers"),
        }}
        scrollHint={t("home.film.scrollHint")}
      />

      {/* ── TICKER — first beat after the impact; borderless so it reads as
             part of the film's landing, not a separate block. Stats are
             illustrative (frozen sample of real cross-league data) — the live
             counters are in the showcase below. */}
      <section
        aria-label={t("home.ticker.topPerformers")}
        className="full-bleed relative py-3.5"
      >
        <p
          aria-hidden
          className="absolute left-4 top-1 z-10 font-mono text-[9px] uppercase tracking-[0.16em] text-ink-600 sm:left-6"
        >
          {t("home.ticker.illustrative")}
        </p>
        <Marquee duration={55} className="text-sm">
          {TICKER_LEFT.map((t) => (
            <div
              key={t.name}
              className="flex items-center gap-3 whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.12em] text-ink-300 sm:text-xs"
            >
              <span className="h-1 w-1 rounded-full bg-brand-400" />
              <span className="text-ink-100">{t.name}</span>
              <span className="text-ink-500">{t.team}</span>
              <span className="text-brand-300">{t.stat}</span>
            </div>
          ))}
        </Marquee>
        <Marquee duration={70} reverse className="mt-2.5 text-sm">
          {TICKER_RIGHT.map((t) => (
            <div
              key={t.name}
              className="flex items-center gap-3 whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.12em] text-ink-300 sm:text-xs"
            >
              <span className="h-1 w-1 rounded-full bg-ink-400" />
              <span className="text-ink-100">{t.name}</span>
              <span className="text-ink-500">PTS · REB · AST</span>
              <span className="text-ink-200">{t.stat}</span>
            </div>
          ))}
        </Marquee>
      </section>

      {/* ── LIVE SHOWCASE — real screen recordings of the product ── */}
      <LiveShowcase
        ready={readyShowcaseKeys()}
        counts={{
          leagues: globalCounts.leagues,
          players: globalCounts.players,
          coaches: globalCounts.coaches,
        }}
        updated={updated}
        leagues={leagues.map((l) => ({ name: l.name, slug: l.slug }))}
      />

      <DataProvenance />

      <Testimonials />

      <section
        aria-labelledby="faq-heading"
        className="full-bleed relative py-14 sm:py-20"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <Reveal>
            <SectionHeading
              align="center"
              eyebrow={t("home.faq.eyebrow")}
              title={t("home.faq.title")}
              description={t("home.faq.description")}
            />
          </Reveal>
          <div id="faq-heading" className="mt-12">
            <Faq />
          </div>
        </div>
      </section>

      {/* ── EMAIL + CTA (merged block) ───────────────────────── */}
      <section className="full-bleed relative overflow-hidden py-20 sm:py-28">
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-gradient-to-b from-court-900/30 via-transparent to-surface-0"
        />
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <EmailSubscribe compact />

          <div className="mt-8 border-t border-hairline pt-10 sm:mt-12 sm:pt-14">
            <Reveal>
              <div className="gh-bezel gh-sheen overflow-hidden">
                <div className="gh-bezel-inner relative overflow-hidden bg-gradient-to-br from-court-800/70 via-surface-1 to-surface-0 p-7 sm:p-12 md:p-16">
                  <div aria-hidden className="absolute inset-0 bg-hatch opacity-50" />
                  <div className="relative grid items-center gap-8 md:grid-cols-[1.1fr_1fr]">
                    <div>
                      <Eyebrow>{t("home.cta.eyebrow")}</Eyebrow>
                      <h2 className="mt-5 font-display text-3xl font-bold leading-[0.96] tracking-[-0.03em] text-balance sm:text-4xl md:text-[3.25rem]">
                        {t("home.cta.titleA")}{" "}
                        <span className="text-gradient-brand">
                          {t("home.cta.titleB")}
                        </span>
                      </h2>
                      <p className="mt-4 max-w-md text-pretty text-base text-ink-200 sm:text-lg">
                        {t("home.cta.description")}
                      </p>
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row md:justify-end">
                      <ButtonLink href="/compare" size="lg" arrow>
                        {t("home.hero.comparePlayers")}
                      </ButtonLink>
                      <ButtonLink href="/players" size="lg" variant="secondary">
                        {t("home.hero.browseDatabase")}
                      </ButtonLink>
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>
    </div>
  )
}

