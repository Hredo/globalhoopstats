import Link from "next/link"
import type { Metadata } from "next"
import { SITE } from "@/lib/site"
import { getLocale } from "@/lib/i18n/server"
import { getDictionary } from "@/lib/i18n/dictionaries"
import { HoopGame } from "@/components/hoop-game"

export const metadata: Metadata = {
  title: "Página no encontrada · Page not found",
  description: "That page does not exist (yet).",
  robots: { index: false, follow: false },
}

/** Half-court shot chart with one long miss: the 404, drawn as a box score. */
function MissedShotChart({ label }: { label: string }) {
  return (
    <svg
      viewBox="0 0 300 200"
      role="img"
      aria-label={label}
      className="h-auto w-full text-ink-500"
    >
      <g fill="none" stroke="currentColor" strokeWidth="1.25">
        <rect x="10" y="10" width="280" height="180" />
        <path d="M120 10 A30 30 0 0 0 180 10" />
        <path d="M30 190 V140 A123.7 123.7 0 0 1 270 140 V190" />
        <rect x="110" y="110" width="80" height="80" />
        <path d="M120 110 A30 30 0 0 1 180 110" />
        <line x1="135" y1="180" x2="165" y2="180" strokeWidth="2" />
      </g>
      <g className="text-brand-500" stroke="currentColor" fill="none">
        <circle cx="150" cy="171" r="6" strokeWidth="2" />
        <circle cx="236" cy="44" r="4" fill="currentColor" stroke="none" />
        <path
          d="M236 44 Q 150 40 108 188"
          strokeWidth="1.5"
          strokeDasharray="4 4"
        />
        <path d="M101 181 l12 12 M113 181 l-12 12" strokeWidth="2.25" />
      </g>
    </svg>
  )
}

export default async function NotFound() {
  const t = getDictionary(await getLocale()).notFoundPage

  return (
    <div className="px-4 py-16 sm:py-24">
      <div className="mx-auto grid max-w-5xl items-center gap-12 md:grid-cols-[1.1fr_1fr]">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-brand-500 sm:text-sm">
            {t.eyebrow}
          </p>
          <h1 className="mt-4 font-display text-5xl font-semibold leading-[1.02] tracking-tight text-ink-50 sm:text-6xl md:text-7xl">
            {t.title}
          </h1>
          <p className="mt-5 max-w-prose text-base text-ink-300 sm:text-lg">
            {t.body}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link
              href="/players"
              className="inline-flex items-center justify-center rounded-md bg-brand-500 px-5 py-3 text-sm font-semibold text-ink-950 transition hover:bg-brand-400 sm:text-base"
            >
              {t.players}
            </Link>
            <Link
              href="/compare"
              className="inline-flex items-center justify-center rounded-md border border-white/15 px-5 py-3 text-sm font-semibold text-ink-50 transition hover:border-brand-500 hover:text-brand-500 sm:text-base"
            >
              {t.compare}
            </Link>
            <Link
              href="/"
              className="inline-flex items-center justify-center px-2 py-3 text-sm font-semibold text-ink-300 underline underline-offset-4 transition hover:text-brand-500 sm:text-base"
            >
              {t.home}
            </Link>
          </div>
        </div>

        <figure className="mx-auto w-full max-w-md">
          <MissedShotChart label={t.shotAlt} />
          <figcaption className="mt-3 flex justify-between border-t border-white/10 pt-3 font-mono text-xs uppercase tracking-[0.15em] text-ink-400">
            <span>{t.shotLine}</span>
            <span>{SITE.shortName}</span>
          </figcaption>
        </figure>
      </div>

      <section className="mx-auto mt-20 max-w-5xl border-t border-white/10 pt-8">
        <h2 className="font-display text-2xl font-semibold tracking-tight text-ink-50 sm:text-3xl">
          {t.gameTitle}
        </h2>
        <p className="mt-2 max-w-prose text-sm text-ink-300 sm:text-base">
          {t.gameBody}
        </p>
        <HoopGame className="mt-6 block h-[220px] w-full cursor-pointer border-y border-white/10 text-ink-50 outline-none [--hoop-accent:var(--color-brand-500)] [--hoop-line:var(--color-ink-700)] [--hoop-muted:var(--color-ink-500)] focus-visible:ring-2 focus-visible:ring-brand-500" />
      </section>
    </div>
  )
}
