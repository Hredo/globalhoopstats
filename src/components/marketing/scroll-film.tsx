"use client"

import Image from "next/image"
import { useEffect, useRef, useState } from "react"
import { useReducedMotion } from "@/hooks/use-reduced-motion"
import { useTheme } from "@/lib/theme/provider"
import { ButtonLink } from "@/components/ui/button"

export type FilmCta = { href: string; label: string }
/** A scroll-timed marketing line shown to one side of the ball. */
export type FilmText = { hook: string; sub?: string }
/** One themed footage set: poster frame + extracted frame sequence. */
export type FilmReel = { intro: string; framePath: string; frames: number }

/* Timeline windows (fractions of total scroll progress). */
const HEAD_OUT = 0.09 // opening headline has faded by here
const TEXT_IN = 0.1 // first side line starts entering
const TEXT_OUT = 0.86 // last side line has left by here
const IMPACT_IN = 0.9 // ball is hurled at the lens → white impact ramps up
const SMOOTH = 0.3 // per-frame lerp toward the scroll target (higher = tighter, less floaty)
const HOLD = 0.24 // fraction of each line's window spent easing in/out (rest is held)

const clamp01 = (v: number) => Math.min(Math.max(v, 0), 1)
const ease = (v: number) => v * v * (3 - 2 * v) // smoothstep

/**
 * Full-bleed scroll film. One sticky viewport driven by a single scroll
 * progress value:
 *   1. hold on the ball with the headline
 *   2. the camera pushes in while punchy marketing lines fly in from the
 *      sides (added here in code, never baked into the footage)
 *   3. near the end the ball is thrown straight at the lens and slams into
 *      the camera — a white impact flash hands off to the rest of the page
 * The footage set (poster + frame sequence) is chosen from the live theme:
 * a dark low-lit court in dark mode, a bright seaside street court in light
 * mode. Frames are scrubbed on a canvas (smoother than scrubbing a <video>);
 * all per-scroll writes are imperative (refs + style) so nothing depends on
 * React re-renders. Reduced-motion / data-saver visitors get a static hero.
 */
export function ScrollFilm({
  dark,
  light,
  introAlt,
  texts,
  headline,
  ctaPrimary,
  ctaSecondary,
  scrollHint,
}: {
  dark: FilmReel
  light: FilmReel
  introAlt: string
  texts: readonly FilmText[]
  headline: { kicker: string; title: string; accent?: string }
  ctaPrimary: FilmCta
  ctaSecondary: FilmCta
  scrollHint: string
}) {
  const { theme } = useTheme()
  const isLight = theme === "light"
  const reel = isLight ? light : dark
  // Dark footage in dark mode wants white text + a dark scrim + shadows;
  // bright footage in light mode wants dark text + a light scrim + NO shadows
  // (dark-on-dark shadows just muddy it). The side lines' small subline also
  // needs a solid colour in light mode or it disappears.
  const hookShadow = isLight
    ? undefined
    : "0 1px 2px rgba(0,0,0,0.9), 0 2px 12px rgba(0,0,0,0.7), 0 0 40px rgba(0,0,0,0.55)"
  const subColor = isLight ? "#0b0b0d" : "rgba(255,255,255,0.94)"
  const subShadow = isLight
    ? undefined
    : "0 1px 2px rgba(0,0,0,0.95), 0 0 20px rgba(0,0,0,0.7)"
  const scrim = isLight
    ? "linear-gradient(90deg, rgba(255,255,255,0.72) 0%, rgba(255,255,255,0.14) 34%, rgba(255,255,255,0.14) 66%, rgba(255,255,255,0.72) 100%)"
    : "linear-gradient(90deg, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.2) 36%, rgba(0,0,0,0.2) 64%, rgba(0,0,0,0.8) 100%)"

  const rootRef = useRef<HTMLElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const headlineRef = useRef<HTMLDivElement | null>(null)
  const textRefs = useRef<(HTMLDivElement | null)[]>([])
  const hintRef = useRef<HTMLParagraphElement | null>(null)
  const flashRef = useRef<HTMLDivElement | null>(null)
  const settleRef = useRef<HTMLDivElement | null>(null)
  const reduce = useReducedMotion()

  const [saveData, setSaveData] = useState(false)
  useEffect(() => {
    const nav = navigator as Navigator & { connection?: { saveData?: boolean } }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSaveData(nav.connection?.saveData === true)
  }, [])

  /**
   * Derived, never latched.
   *
   * This used to be a `compact` state that the effect below only ever set to
   * `true`. useReducedMotion() reports `true` during hydration (its server
   * snapshot is the content-safe guess), so the first effect pass flipped the
   * latch on for *every* visitor; when the real preference came back `false`
   * nothing switched it off, the component kept returning the static hero, the
   * canvas never mounted and the scroll film was dead in production.
   */
  const compact = reduce || saveData

  useEffect(() => {
    if (compact) return

    const root = rootRef.current
    const canvas = canvasRef.current
    if (!root || !canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const { framePath, frames } = reel
    const src = (i: number) =>
      `${framePath}/f${String(i).padStart(3, "0")}.webp`

    const images: (HTMLImageElement | null)[] = Array.from(
      { length: frames },
      () => null,
    )
    let currentIdx = -1
    let disposed = false
    let desiredIdx = 0

    const nearestLoaded = (idx: number) => {
      if (images[idx]) return idx
      for (let d = 1; d < frames; d++) {
        if (idx - d >= 0 && images[idx - d]) return idx - d
        if (idx + d < frames && images[idx + d]) return idx + d
      }
      return -1
    }

    /** object-fit: cover mapping from the frame into the viewport canvas. */
    const drawCover = (img: HTMLImageElement) => {
      const cw = canvas.width
      const ch = canvas.height
      const ir = img.naturalWidth / img.naturalHeight
      const cr = cw / ch
      let sw = img.naturalWidth
      let sh = img.naturalHeight
      let sx = 0
      let sy = 0
      if (ir > cr) {
        sw = img.naturalHeight * cr
        sx = (img.naturalWidth - sw) / 2
      } else {
        sh = img.naturalWidth / cr
        sy = (img.naturalHeight - sh) / 2
      }
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, cw, ch)
    }

    const draw = (idx: number) => {
      const use = nearestLoaded(idx)
      if (use < 0 || use === currentIdx) return
      const img = images[use]
      if (!img) return
      currentIdx = use
      drawCover(img)
    }

    const size = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = Math.round(window.innerWidth * dpr)
      const h = Math.round(window.innerHeight * dpr)
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
        currentIdx = -1
        draw(desiredIdx)
      }
    }

    const n = texts.length
    const seg = n > 0 ? (TEXT_OUT - TEXT_IN) / n : 1

    let targetP = 0
    let smoothP = 0
    let running = false
    let rafId = 0

    /* paint everything for a given (eased) progress value */
    const render = (p: number) => {
      desiredIdx = Math.round(p * (frames - 1))
      draw(desiredIdx)

      const h = headlineRef.current
      if (h) {
        const on = p < HEAD_OUT
        h.style.opacity = on ? "1" : "0"
        h.style.transform = `translateY(${on ? 0 : -24}px)`
      }

      /* side lines — each flies in from its side, holds, leaves */
      for (let i = 0; i < n; i++) {
        const el = textRefs.current[i]
        if (!el) continue
        const a = TEXT_IN + i * seg
        const b = a + seg
        const T = seg * HOLD
        const enter = ease(clamp01((p - a) / T))
        const exit = ease(clamp01((p - (b - T)) / T))
        const vis = enter * (1 - exit)
        const center = i === n - 1
        const sign = center ? 0 : i % 2 === 0 ? -1 : 1
        const dx = sign * 64 * (1 - enter) + sign * 44 * exit
        const s = 0.92 + 0.08 * enter - 0.05 * exit
        const base = center ? "translate(-50%, -50%)" : "translateY(-50%)"
        el.style.opacity = String(vis)
        el.style.transform = `${base} translateX(${dx}px) scale(${s})`
      }

      /* thrown-ball impact → white flash, then the viewport settles to the
         page background so the section below scrolls in with no visible seam */
      if (flashRef.current)
        flashRef.current.style.opacity = String(
          ease(clamp01((p - IMPACT_IN) / (0.96 - IMPACT_IN))) * 0.92,
        )
      if (settleRef.current)
        settleRef.current.style.opacity = String(
          ease(clamp01((p - 0.955) / 0.045)),
        )

      if (hintRef.current) hintRef.current.style.opacity = p < 0.04 ? "1" : "0"
    }

    const measure = () => {
      const rect = root.getBoundingClientRect()
      const total = rect.height - window.innerHeight
      targetP = total > 0 ? clamp01(-rect.top / total) : 0
    }

    /* rAF easing loop — the displayed progress glides toward the scroll
       target instead of snapping to it, so chunky wheel/trackpad input still
       reads as one fluid, continuous camera move */
    const tick = () => {
      const d = targetP - smoothP
      if (Math.abs(d) < 0.0004) {
        smoothP = targetP
        render(smoothP)
        running = false
        return
      }
      smoothP += d * SMOOTH
      render(smoothP)
      rafId = requestAnimationFrame(tick)
    }

    const onScroll = () => {
      measure()
      // Hidden tabs never fire rAF — jump straight to the target and paint
      // synchronously, else the eased loop would never start and scrolling
      // would look frozen when the tab is throttled/offscreen.
      if (document.hidden) {
        smoothP = targetP
        render(smoothP)
        return
      }
      if (!running) {
        running = true
        rafId = requestAnimationFrame(tick)
      }
    }
    const onResize = () => {
      size()
      onScroll()
    }

    const load = (i: number) =>
      new Promise<void>((resolve) => {
        if (images[i]) return resolve()
        const img = new window.Image()
        img.onload = () => {
          if (!disposed) {
            images[i] = img
            if (i === nearestLoaded(desiredIdx)) draw(desiredIdx)
          }
          resolve()
        }
        img.onerror = () => resolve()
        img.src = src(i)
      })
    /* Load in two passes: (1) a coarse whole-range sweep so a jump-scroll
       always lands near a decoded frame, then (2) a DENSE front-to-back fill
       so a normal top→bottom scroll always has contiguous frames — this is
       what kills the "random jumps" while the sequence streams in. */
    void (async () => {
      const pass = async (step: number) => {
        const batch: Promise<void>[] = []
        for (let i = 0; i < frames; i += step) {
          batch.push(load(i))
          if (batch.length >= 8) {
            await Promise.all(batch.splice(0))
            if (disposed) return true
          }
        }
        await Promise.all(batch)
        return disposed
      }
      if (await pass(10)) return
      if (await pass(1)) return
    })()

    size()
    measure()
    smoothP = targetP
    render(smoothP)
    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onResize)
    return () => {
      disposed = true
      cancelAnimationFrame(rafId)
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onResize)
    }
    // `compact` is in the deps on purpose: when it flips false the film markup
    // mounts, and this effect has to run again to pick up the now-real canvas.
  }, [reel, texts, compact])

  /* Compact static hero for reduced-motion / data-saver visitors. */
  if (compact) {
    return (
      <section className="full-bleed relative isolate overflow-hidden">
        <Image
          src={reel.intro}
          alt={introAlt}
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/10" />
        <div className="relative mx-auto flex min-h-[82svh] max-w-7xl flex-col justify-end px-4 pb-16 pt-40 sm:px-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/70">
            {headline.kicker}
          </p>
          <h1 className="mt-4 max-w-3xl font-display text-[2.6rem] font-semibold leading-[0.98] tracking-[-0.012em] text-balance text-white sm:text-6xl">
            {headline.title}
            {headline.accent ? (
              <>
                {" "}
                <em className="italic text-white/90">{headline.accent}</em>
              </>
            ) : null}
          </h1>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href={ctaPrimary.href} size="lg" arrow>
              {ctaPrimary.label}
            </ButtonLink>
            <ButtonLink href={ctaSecondary.href} size="lg" variant="secondary">
              {ctaSecondary.label}
            </ButtonLink>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section ref={rootRef} className="full-bleed relative" style={{ height: "620vh" }}>
      <div className="sticky top-0 h-svh w-full overflow-hidden bg-black">
        {/* L0 — poster (first frame) until the canvas has decoded; also the
            SSR/pre-JS paint. Swaps with the theme. */}
        <Image
          key={reel.intro}
          src={reel.intro}
          alt={introAlt}
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />

        {/* L1 — scrubbed frame sequence */}
        <canvas
          ref={canvasRef}
          aria-hidden
          className="absolute inset-0 h-full w-full"
          style={{ transformOrigin: "50% 55%" }}
        />

        {/* readability scrim — keeps big type legible over bright or dark
            footage without hiding the ball at center */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-[5]"
          style={{ background: scrim }}
        />

        {/* opening headline */}
        <div
          ref={headlineRef}
          className="absolute inset-x-0 top-[15svh] z-10 mx-auto max-w-7xl px-4 sm:px-6"
        >
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/70">
            {headline.kicker}
          </p>
          <h1 className="mt-4 max-w-3xl font-display text-[2.6rem] font-semibold leading-[0.96] tracking-[-0.012em] text-balance text-white sm:text-6xl lg:text-7xl">
            {headline.title}
            {headline.accent ? (
              <>
                <br />
                <em className="italic text-white/90">{headline.accent}</em>
              </>
            ) : null}
          </h1>
        </div>

        {/* side marketing lines */}
        {texts.map((tx, i) => {
          const center = i === texts.length - 1
          const rightSide = !center && i % 2 === 1
          return (
            <div
              key={tx.hook}
              ref={(el) => {
                textRefs.current[i] = el
              }}
              aria-hidden
              className={[
                "pointer-events-none absolute top-1/2 z-10 max-w-[min(92vw,36rem)]",
                center
                  ? "left-1/2 text-center"
                  : rightSide
                    ? "right-5 text-right sm:right-10 lg:right-16"
                    : "left-5 text-left sm:left-10 lg:left-16",
              ].join(" ")}
              style={{
                opacity: 0,
                transform: "translateY(-50%)",
                // The final line sits dead-centre over the close-up ball where
                // the side scrim is weakest — give it its own soft dark halo so
                // white text reads over the orange leather in BOTH themes.
                ...(center
                  ? {
                      padding: "2.25rem 2.75rem",
                      background:
                        "radial-gradient(65% 125% at 50% 50%, rgba(0,0,0,0.66) 0%, rgba(0,0,0,0.36) 46%, rgba(0,0,0,0) 78%)",
                    }
                  : null),
              }}
            >
              <p
                className={[
                  "font-display font-semibold leading-[0.98] tracking-[-0.015em] text-balance",
                  center
                    ? "text-5xl text-white sm:text-6xl lg:text-7xl"
                    : "text-4xl text-white sm:text-6xl lg:text-7xl",
                ].join(" ")}
                style={{
                  color: center ? "#fff" : undefined,
                  textShadow: center
                    ? "0 2px 24px rgba(0,0,0,0.7), 0 1px 3px rgba(0,0,0,0.9)"
                    : hookShadow,
                }}
              >
                {tx.hook}
              </p>
              {tx.sub ? (
                <p
                  className="mt-4 text-pretty text-base font-semibold sm:text-lg"
                  style={{ color: subColor, textShadow: subShadow }}
                >
                  {tx.sub}
                </p>
              ) : null}
            </div>
          )
        })}

        {/* impact flash — the thrown ball hitting the lens. Explicit #fff:
            the `white` token is remapped to a dark slate in light mode, and
            the burst must stay a light overexposure in both themes. */}
        <div
          ref={flashRef}
          aria-hidden
          className="pointer-events-none absolute inset-0 z-20"
          style={{ opacity: 0, background: "#fff" }}
        />

        {/* post-impact settle — fades to the page background over the last
            frames so the handoff to the content below has no hard cut */}
        <div
          ref={settleRef}
          aria-hidden
          className="pointer-events-none absolute inset-0 z-30"
          style={{
            opacity: 0,
            background: isLight ? "oklch(0.965 0.008 82)" : "oklch(0.19 0.015 54)",
          }}
        />

        {/* scroll hint */}
        <p
          ref={hintRef}
          aria-hidden
          className="absolute bottom-5 left-1/2 z-10 -translate-x-1/2 font-mono text-[10px] uppercase tracking-[0.22em] text-white/60 transition-opacity duration-500"
        >
          {scrollHint}
          <span className="ml-2 inline-block animate-bounce">↓</span>
        </p>
      </div>
    </section>
  )
}
