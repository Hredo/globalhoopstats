"use client"

import Image from "next/image"
import { useEffect, useRef, useState } from "react"
import { Reveal } from "@/components/animations/reveal"
import { StatCounter } from "@/components/ui/stat-counter"
import { ButtonLink } from "@/components/ui/button"
import { leagueAccent } from "@/components/ui/league-badge"
import { useT } from "@/lib/i18n/provider"
import { useTheme } from "@/lib/theme/provider"

export type ShowcaseCounts = { leagues: number; players: number; coaches: number }
export type ShowcaseLeague = { name: string; slug: string }

/** One recorded product scene. Footage lives in /media/previews as
 *  `{key}-{dark|light}.mp4` + a matching `.webp` poster, captured from the
 *  real running app in BOTH themes so the reel always matches the page. */
type Scene = {
  key: "player" | "compare" | "ai-advisor" | "trade"
  href: string
  /** shown in the fake browser chrome on the card */
  path: string
  accent: string
}

const SCENES: readonly Scene[] = [
  { key: "player", href: "/players/nba-luka-doncic", path: "/players/luka-doncic", accent: "oklch(0.72 0.205 50)" },
  { key: "compare", href: "/compare", path: "/compare", accent: "oklch(0.78 0.13 220)" },
  { key: "ai-advisor", href: "/ai-advisor", path: "/ai-advisor", accent: "oklch(0.68 0.16 290)" },
  { key: "trade", href: "/market/trade", path: "/market/trade", accent: "oklch(0.78 0.17 38)" },
]

const media = (key: Scene["key"], theme: "dark" | "light") => ({
  video: `/media/previews/${key}-${theme}.mp4`,
  poster: `/media/previews/${key}-${theme}.webp`,
})

/**
 * The product reel — real screen recordings of the app, laid out as an
 * editorial zigzag: explanatory copy on one side, a slightly tilted "captura"
 * card on the other, alternating each row. Cards settle from a steeper tilt
 * as they scroll into view, follow the pointer in 3D once there (TiltCard),
 * and only play their clip while on screen. Footage swaps with the theme.
 */
export function LiveShowcase({
  ready = [],
  counts,
  updated,
  leagues,
}: {
  /** scene keys whose recorded clip exists — resolved on the server so a card
   *  lights up automatically the moment its footage lands in public/. */
  ready?: readonly string[]
  /** live, real database counts for the social-proof strip */
  counts: ShowcaseCounts
  /** relative "last synced" label, e.g. "hace 6 días" */
  updated: string
  /** leagues covered, for the coverage chips (folded in from the old band) */
  leagues: readonly ShowcaseLeague[]
}) {
  const t = useT()
  const readySet = new Set(ready)

  return (
    <section
      aria-label={t("home.showcase.eyebrow")}
      className="full-bleed relative pb-24 pt-12 sm:pb-32 sm:pt-16"
    >
      {/* afterglow — receives the film's impact so the page below feels like
          a continuation of the hero rather than a new document */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-24 h-72 bg-[radial-gradient(60%_100%_at_50%_0%,oklch(0.72_0.205_50_/_0.1),transparent_70%)]"
      />

      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <Reveal>
          <div className="mx-auto max-w-3xl text-center">
            <span className="gh-eyebrow justify-center">
              {t("home.showcase.eyebrow")}
            </span>
            <h2 className="mt-4 font-display text-4xl font-bold leading-[0.94] tracking-[-0.03em] text-ink-50 sm:text-5xl md:text-6xl">
              {t("home.showcase.titleA")}{" "}
              <span className="text-gradient-brand">
                {t("home.showcase.titleB")}
              </span>
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-pretty text-base text-ink-200 sm:text-lg">
              {t("home.showcase.description")}
            </p>
          </div>
        </Reveal>

        {/* ── proof band: free-beta badge · before→after · live counters ·
               coverage (folded in from the old standalone section) ───────── */}
        <Reveal delay={0.05}>
          <div className="mx-auto mt-10 flex max-w-4xl flex-col items-center gap-7">
            <span className="inline-flex items-center gap-2 rounded-full border border-positive/40 bg-positive/10 px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-positive">
              <span aria-hidden className="h-1.5 w-1.5 animate-ticker rounded-full bg-positive" />
              {t("home.showcase.freeBeta")}
            </span>

            <p className="text-balance text-center font-display text-lg leading-snug text-ink-300 sm:text-2xl">
              <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-500">
                {t("home.showcase.before")}
              </span>{" "}
              <span className="text-ink-400 line-through decoration-ink-600/50">
                {t("home.showcase.beforeText")}
              </span>
              <span className="mx-2 text-brand-400">→</span>
              <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-brand-300">
                {t("home.showcase.after")}
              </span>{" "}
              <span className="font-semibold text-ink-50">
                {t("home.showcase.afterText")}
              </span>
            </p>

            <div className="grid w-full max-w-2xl grid-cols-3 divide-x divide-hairline rounded-2xl border border-hairline bg-surface-1/50 py-5">
              <Counter to={counts.leagues} label={t("home.showcase.counts.leagues")} />
              <Counter to={counts.players} label={t("home.showcase.counts.players")} />
              <Counter to={counts.coaches} label={t("home.showcase.counts.coaches")} />
            </div>
            <p className="-mt-3 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">
              <span className="mr-1.5 inline-block h-1.5 w-1.5 animate-ticker rounded-full bg-positive align-middle" />
              {t("home.showcase.counts.updated")} · {updated}
            </p>

            <ul className="flex flex-wrap justify-center gap-2">
              {leagues.map((l) => {
                const a = leagueAccent(l.slug)
                return (
                  <li
                    key={l.slug}
                    className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-white/[0.02] px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-300"
                  >
                    <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: a.color }} />
                    {l.name}
                  </li>
                )
              })}
            </ul>
          </div>
        </Reveal>

        <div className="mt-20 space-y-24 sm:mt-28 sm:space-y-36">
          {SCENES.map((s, i) => (
            <SceneRow key={s.key} scene={s} index={i} ready={readySet.has(s.key)} />
          ))}
        </div>
      </div>
    </section>
  )
}

/* one live database counter — counts up (eased) when scrolled into view */
function Counter({ to, label }: { to: number; label: string }) {
  return (
    <div className="flex flex-col items-center px-2 text-center">
      <StatCounter
        to={to}
        className="font-display text-2xl font-bold leading-none text-ink-50 sm:text-4xl"
      />
      <span className="mt-2 font-mono text-[9px] uppercase tracking-[0.12em] text-ink-400 sm:text-[10px]">
        {label}
      </span>
    </div>
  )
}

/* fake browser chrome pill shown over the clip */
function ChromeBar({ path }: { path: string }) {
  return (
    <div className="pointer-events-none absolute left-4 top-4 z-10 flex items-center gap-2 rounded-full bg-black/55 py-1.5 pl-3 pr-4 backdrop-blur-sm">
      <span aria-hidden className="flex gap-1">
        <i className="h-1.5 w-1.5 rounded-full bg-white/35" />
        <i className="h-1.5 w-1.5 rounded-full bg-white/35" />
        <i className="h-1.5 w-1.5 rounded-full bg-white/35" />
      </span>
      <span className="font-mono text-[10px] tracking-[0.06em] text-white/85">
        globalhoopstats.es{path}
      </span>
    </div>
  )
}

function SceneRow({
  scene,
  index,
  ready,
}: {
  scene: Scene
  index: number
  ready: boolean
}) {
  const t = useT()
  const { theme } = useTheme()
  const { video, poster } = media(scene.key, theme)
  const base = `home.showcase.items.${scene.key}`
  const mediaRight = index % 2 === 0
  const restTilt = mediaRight ? 2.4 : -2.4

  const rowRef = useRef<HTMLDivElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [inView, setInView] = useState(false)
  const [reduce, setReduce] = useState(false)

  useEffect(() => {
    setReduce(window.matchMedia("(prefers-reduced-motion: reduce)").matches)
    const el = rowRef.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.25 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  /* footage only rolls while its row is on screen */
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    if (inView) void v.play().catch(() => {})
    else v.pause()
  }, [inView, theme])

  return (
    <div
      ref={rowRef}
      className="grid items-center gap-10 md:grid-cols-2 md:gap-14 lg:gap-20"
    >
      {/* copy — flies in from its own side */}
      <Reveal
        direction={mediaRight ? "right" : "left"}
        className={mediaRight ? "md:order-1" : "md:order-2"}
      >
        <p
          className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em]"
          style={{ color: scene.accent }}
        >
          {String(index + 1).padStart(2, "0")} · {t(`${base}.name`)}
        </p>
        <h3 className="mt-4 font-display text-3xl font-bold leading-[0.98] tracking-[-0.02em] text-balance text-ink-50 sm:text-4xl lg:text-[2.75rem]">
          {t(`${base}.title`)}
        </h3>
        <p className="mt-5 max-w-lg text-pretty text-base leading-relaxed text-ink-200 sm:text-lg">
          {t(`${base}.body`)}
        </p>
        <ButtonLink
          href={scene.href}
          size="sm"
          variant="secondary"
          arrow
          className="mt-7"
        >
          {t(`${base}.cta`)}
        </ButtonLink>
      </Reveal>

      {/* tilted capture card — settles from a steeper angle on entry, then
          follows the pointer in 3D; the clip itself is the real app */}
      <div
        className={mediaRight ? "md:order-2" : "md:order-1"}
        style={{
          transform: reduce
            ? undefined
            : inView
              ? `rotate(${restTilt}deg)`
              : `rotate(${restTilt * 3}deg) translateY(48px) scale(0.95)`,
          opacity: reduce ? 1 : inView ? 1 : 0,
          transition:
            "transform 1s var(--ease-fluid), opacity 0.8s var(--ease-fluid)",
        }}
      >
          <div className="relative overflow-hidden rounded-2xl border border-hairline bg-surface-1 shadow-[var(--shadow-elev-2)]">
            <span
              aria-hidden
              className="absolute inset-x-0 top-0 z-10 h-[3px]"
              style={{ background: scene.accent, opacity: 0.75 }}
            />
            <ChromeBar path={scene.path} />
            <div className="relative aspect-[16/10] w-full">
              {ready ? (
                <>
                  <Image
                    src={poster}
                    alt={t(`${base}.name`)}
                    fill
                    sizes="(min-width: 768px) 50vw, 100vw"
                    className="object-cover"
                  />
                  {!reduce ? (
                    <video
                      key={`${scene.key}-${theme}`}
                      ref={videoRef}
                      src={video}
                      poster={poster}
                      muted
                      loop
                      playsInline
                      preload="none"
                      aria-hidden
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  ) : null}
                </>
              ) : (
                <ScenePlaceholder accent={scene.accent} label={t(`${base}.name`)} />
              )}
            </div>
            <div className="flex items-center justify-between border-t border-hairline px-4 py-2.5">
              <span
                className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em]"
                style={{ color: scene.accent }}
              >
                {t("home.showcase.live")}
              </span>
              <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-400">
                <span
                  aria-hidden
                  className={`h-1.5 w-1.5 rounded-full ${ready ? "animate-ticker bg-positive" : "bg-ink-500"}`}
                />
                {ready ? "rec" : t("home.showcase.soon")}
              </span>
            </div>
          </div>
      </div>
    </div>
  )
}

/** Holder shown in a card whose real clip hasn't been captured yet (the
 *  auth-gated pages). On-brand, clearly intentional — a soft accent wash with
 *  a sweeping shimmer and the tool's name, never a broken image. */
function ScenePlaceholder({ accent, label }: { accent: string; label: string }) {
  return (
    <div
      className="gh-hero-skeleton absolute inset-0 flex flex-col items-center justify-center gap-3 overflow-hidden"
      style={{
        background: `radial-gradient(120% 120% at 50% 0%, color-mix(in oklch, ${accent} 18%, transparent), transparent 70%), var(--color-surface-2)`,
      }}
    >
      <span
        aria-hidden
        className="flex h-11 w-11 items-center justify-center rounded-full"
        style={{ background: `color-mix(in oklch, ${accent} 22%, transparent)` }}
      >
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke={accent}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="2.5" y="6" width="15" height="12" rx="2.5" />
          <path d="M17.5 10.5 21.5 8v8l-4-2.5" />
        </svg>
      </span>
      <span
        className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em]"
        style={{ color: accent }}
      >
        {label}
      </span>
    </div>
  )
}
