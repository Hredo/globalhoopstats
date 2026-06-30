"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { useT } from "@/lib/i18n/provider"

type Panel = {
  index: string
  titleKey: string
  bodyKey: string
  visual: ReactNode
  accent?: string
}

const PANELS: Panel[] = [
  {
    index: "01",
    titleKey: "home.gallery.p1Title",
    bodyKey: "home.gallery.p1Body",
    accent: "var(--color-brand-500)",
    visual: <LeaguesVisual />,
  },
  {
    index: "02",
    titleKey: "home.gallery.p2Title",
    bodyKey: "home.gallery.p2Body",
    accent: "var(--color-league-euro-500)",
    visual: <NormalizeVisual />,
  },
  {
    index: "03",
    titleKey: "home.gallery.p3Title",
    bodyKey: "home.gallery.p3Body",
    accent: "var(--color-accent-cyan)",
    visual: <CompareVisual />,
  },
  {
    index: "04",
    titleKey: "home.gallery.pValTitle",
    bodyKey: "home.gallery.pValBody",
    accent: "var(--color-brand-400)",
    visual: <ValueVisual />,
  },
]

export function ScrollGallery() {
  const t = useT()
  const [desktop, setDesktop] = useState(false)
  const [scrollLeft, setScrollLeft] = useState(0)
  const [scrollWidth, setScrollWidth] = useState(0)
  const [clientWidth, setClientWidth] = useState(0)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)")
    const update = () => setDesktop(mq.matches)
    update()
    mq.addEventListener("change", update)
    return () => mq.removeEventListener("change", update)
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const measure = () => {
      setScrollLeft(el.scrollLeft)
      setScrollWidth(el.scrollWidth)
      setClientWidth(el.clientWidth)
    }
    measure()
    const onScroll = () => {
      setScrollLeft(el.scrollLeft)
      setScrollWidth(el.scrollWidth)
      setClientWidth(el.clientWidth)
    }
    el.addEventListener("scroll", onScroll, { passive: true })
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => {
      el.removeEventListener("scroll", onScroll)
      ro.disconnect()
    }
  }, [])

  // Desktop: translate a vertical mouse-wheel gesture into horizontal scroll
  // while the pointer is over the gallery, so PC users can move the cards
  // without a trackpad. We yield back to the page once an edge is reached, and
  // leave genuine horizontal (trackpad) gestures untouched.
  useEffect(() => {
    const el = scrollRef.current
    if (!el || !desktop) return
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return
      const max = el.scrollWidth - el.clientWidth
      if (max <= 0) return
      const atStart = el.scrollLeft <= 0
      const atEnd = el.scrollLeft >= max - 1
      if ((e.deltaY > 0 && atEnd) || (e.deltaY < 0 && atStart)) return
      el.scrollLeft = Math.max(0, Math.min(max, el.scrollLeft + e.deltaY))
      e.preventDefault()
    }
    el.addEventListener("wheel", onWheel, { passive: false })
    return () => el.removeEventListener("wheel", onWheel)
  }, [desktop])

  const scrollPct =
    scrollWidth > clientWidth ? scrollLeft / (scrollWidth - clientWidth) : 0

  const heading = (
    <div>
      <span className="gh-eyebrow">{t("home.gallery.eyebrow")}</span>
      <h2 className="mt-3 font-display text-4xl font-bold leading-[0.9] tracking-[-0.04em] text-ink-50 sm:text-5xl md:text-6xl">
        {t("home.gallery.titleA")}{" "}
        <span className="text-gradient-brand">{t("home.gallery.titleB")}</span>
      </h2>
    </div>
  )

  return (
    <div className="py-16">
      {heading}
      <div
        ref={scrollRef}
        className={`mask-fade-x mt-10 flex ${
          desktop
            ? "gap-5 overflow-x-hidden hover:overflow-x-auto"
            : "snap-x snap-mandatory gap-4 overflow-x-auto"
        } pb-4 scrollbar-none`}
      >
        {PANELS.map((p) => (
          <div
            key={p.index}
            className="w-[78vw] shrink-0 snap-center sm:w-[440px] lg:w-[500px]"
          >
            <PanelCard panel={p} />
          </div>
        ))}
        <div aria-hidden className="w-[8vw] shrink-0" />
      </div>

      <div className="mx-auto mt-6 max-w-md px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <svg
            aria-hidden
            className="h-3 w-3 shrink-0 text-ink-500"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
          </svg>
          <div className="h-px flex-1 overflow-hidden rounded-full bg-hairline">
            <div
              className="h-full w-full origin-left rounded-full bg-gradient-to-r from-brand-500 to-brand-400"
              style={{ transform: `scaleX(${scrollPct || 0})` }}
            />
          </div>
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">
            {scrollPct < 0.95 ? "Scroll →" : "Done"}
          </span>
        </div>
      </div>
    </div>
  )
}

function PanelCard({ panel }: { panel: Panel }) {
  const t = useT()
  return (
    <article
      className="gh-card group relative flex h-full min-h-[300px] flex-col overflow-hidden p-6 sm:p-7"
      style={{ ["--lg" as string]: panel.accent ?? "var(--color-brand-500)" }}
    >
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-[3px] opacity-70"
        style={{ background: "var(--lg)" }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full opacity-20 blur-3xl transition-opacity duration-500 group-hover:opacity-40"
        style={{ background: "var(--lg)" }}
      />
      <span
        className="text-outline font-display text-5xl font-bold leading-none"
        style={{ WebkitTextStrokeColor: "var(--lg)" }}
      >
        {panel.index}
      </span>
      <h3 className="mt-6 font-display text-2xl font-bold tracking-[-0.02em] text-ink-50 sm:text-[1.7rem]">
        {t(panel.titleKey)}
      </h3>
      <p className="mt-2 text-pretty text-sm leading-relaxed text-ink-200">
        {t(panel.bodyKey)}
      </p>
      <div className="mt-auto pt-6">{panel.visual}</div>
    </article>
  )
}

/* ── panel mini-visuals ───────────────────────────────────────── */
function LeaguesVisual() {
  const leagues = ["NBA", "EuroLeague", "ACB", "Primera FEB", "Segunda FEB", "Tercera FEB"]
  return (
    <div className="flex flex-wrap gap-2">
      {leagues.map((l) => (
        <span
          key={l}
          className="rounded-full border border-hairline bg-white/[0.03] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-300"
        >
          {l}
        </span>
      ))}
    </div>
  )
}

function NormalizeVisual() {
  const t = useT()
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
      <div className="rounded-xl border border-hairline bg-white/[0.02] p-3 font-mono text-[11px] text-ink-400">
        <p>34 MIN</p>
        <p>72 POSS</p>
        <p className="text-ink-500">{t("home.gallery.raw")}</p>
      </div>
      <span className="font-display text-lg text-brand-400">→</span>
      <div className="rounded-xl border border-brand-500/30 bg-brand-500/[0.06] p-3 font-mono text-[11px] text-brand-200">
        <p>per-40</p>
        <p>per-100</p>
        <p className="text-brand-300/70">{t("home.gallery.oneScale")}</p>
      </div>
    </div>
  )
}

function ValueVisual() {
  const rows = [
    { name: "Wembanyama", value: "€120M", pct: 100, accent: "bg-brand-500/80" },
    { name: "SGA", value: "€85M", pct: 72, accent: "bg-accent-cyan/70" },
    { name: "Campazzo", value: "€4.2M", pct: 26, accent: "bg-league-euro-500/70" },
  ]
  return (
    <div className="grid gap-2.5">
      {rows.map((r) => (
        <div key={r.name} className="flex items-center gap-3">
          <span className="w-16 shrink-0 truncate font-mono text-[10px] uppercase tracking-[0.14em] text-ink-400">
            {r.name}
          </span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.05]">
            <span
              className={`block h-full rounded-full ${r.accent}`}
              style={{ width: `${r.pct}%` }}
            />
          </div>
          <span className="w-12 shrink-0 text-right font-mono text-[10px] font-semibold text-ink-200">
            {r.value}
          </span>
        </div>
      ))}
    </div>
  )
}

function CompareVisual() {
  const rows = [
    { l: "PTS", a: 92, b: 54 },
    { l: "AST", a: 46, b: 88 },
    { l: "REB", a: 64, b: 80 },
    { l: "BLK", a: 28, b: 96 },
  ]
  return (
    <div className="grid gap-2.5">
      {rows.map((r) => (
        <div key={r.l} className="flex items-center gap-3">
          <span className="w-8 shrink-0 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">
            {r.l}
          </span>
          <div className="flex h-2 flex-1 overflow-hidden rounded-full bg-white/[0.05]">
            <span className="h-full rounded-l-full bg-brand-500/80" style={{ width: `${r.a / 2}%` }} />
            <span className="h-full rounded-r-full bg-accent-cyan/70" style={{ width: `${r.b / 2}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function AskVisual() {
  const t = useT()
  return (
    <div className="space-y-2">
      <div className="ml-auto w-fit max-w-[80%] rounded-2xl rounded-br-sm border border-hairline bg-white/[0.04] px-3 py-2 text-[11px] text-ink-200">
        {t("home.gallery.askQuestion")}
      </div>
      <div className="w-fit max-w-[85%] rounded-2xl rounded-bl-sm border border-accent-violet/30 bg-accent-violet/[0.08] px-3 py-2 text-[11px] text-ink-200">
        {t("home.gallery.askAnswer")}
      </div>
    </div>
  )
}

function ExportVisual() {
  return (
    <div className="flex gap-2">
      {["PDF", "XLSX", "DOCX"].map((f) => (
        <span
          key={f}
          className="flex-1 rounded-xl border border-hairline bg-white/[0.02] px-3 py-3 text-center font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-300"
        >
          {f}
        </span>
      ))}
    </div>
  )
}

// Unused after gallery reduction but kept for reference
/*
function AskVisual() {
  const t = useT()
  return (
    <div className="space-y-2">
      <div className="ml-auto w-fit max-w-[80%] rounded-2xl rounded-br-sm border border-hairline bg-white/[0.04] px-3 py-2 text-[11px] text-ink-200">
        {t("home.gallery.askQuestion")}
      </div>
      <div className="w-fit max-w-[85%] rounded-2xl rounded-bl-sm border border-accent-violet/30 bg-accent-violet/[0.08] px-3 py-2 text-[11px] text-ink-200">
        {t("home.gallery.askAnswer")}
      </div>
    </div>
  )
}

function ExportVisual() {
  return (
    <div className="flex gap-2">
      {["PDF", "XLSX", "DOCX"].map((f) => (
        <span
          key={f}
          className="flex-1 rounded-xl border border-hairline bg-white/[0.02] px-3 py-3 text-center font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-300"
        >
          {f}
        </span>
      ))}
    </div>
  )
}
*/
