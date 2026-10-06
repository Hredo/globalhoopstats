"use client"

import Image from "next/image"
import { useEffect, useRef, useState } from "react"
import {
  motion,
  useMotionValueEvent,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "motion/react"
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
// Synced to the footage, not picked by feel: the ball recoils from the lens
// around frame 210 of 240 and flies back at it over frames 220–239, so the
// throw is the last ~8% of the film. The flash used to start at 0.9, which
// whited out the throw before the ball had even left.
const RECOIL = 0.875 // ball pulls back — the camera starts pushing in
const THROW = 0.925 // ball flies at the lens — smear and warm bloom
const IMPACT_IN = 0.955 // it reaches the lens → white impact ramps up
const HOLD = 0.24 // fraction of each line's window spent easing in/out (rest is held)

const smoothstep = (v: number) => v * v * (3 - 2 * v)

/**
 * Scroll → displayed progress. Over-damped on purpose (damping ratio ≈ 1.3):
 * chunky wheel and trackpad input glide into one continuous camera move, and
 * the move settles without ever overshooting — no bounce at the end of a
 * flick, which on a camera reads as the footage wobbling.
 */
const FILM_SPRING = { stiffness: 140, damping: 24, mass: 0.6, restDelta: 0.0002 }

/**
 * Full-bleed scroll film. One sticky viewport driven by a single scroll
 * progress value:
 *   1. hold on the ball with the headline
 *   2. the camera pushes in while punchy marketing lines fly in from the
 *      sides (added here in code, never baked into the footage)
 *   3. near the end the ball is thrown straight at the lens — it smears with
 *      speed, warms the frame and slams into the camera; a white impact flash
 *      hands off to the rest of the page
 *
 * The footage set (poster + frame sequence) is chosen from the live theme: a
 * dark low-lit court in dark mode, a bright seaside street court in light
 * mode. Frames are painted on a canvas, and the two frames either side of the
 * exact scroll position are cross-faded, so 240 stills read as continuous
 * motion instead of stepping. Everything per-scroll lives in Motion values —
 * no React re-render happens while scrolling. Reduced-motion / data-saver
 * visitors get a static hero.
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
   * useReducedMotion() reports `true` during hydration (its server snapshot is
   * the content-safe guess). A latch set from the first effect pass used to
   * keep the static hero for every visitor once the real `false` arrived, and
   * the film was dead in production.
   */
  const compact = reduce || saveData

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
          <FilmCtas primary={ctaPrimary} secondary={ctaSecondary} />
        </div>
      </section>
    )
  }

  return (
    <Film
      reel={reel}
      isLight={isLight}
      introAlt={introAlt}
      texts={texts}
      headline={headline}
      ctaPrimary={ctaPrimary}
      ctaSecondary={ctaSecondary}
      scrollHint={scrollHint}
    />
  )
}

function FilmCtas({ primary, secondary }: { primary: FilmCta; secondary: FilmCta }) {
  return (
    <div className="mt-8 flex flex-wrap gap-3">
      <ButtonLink href={primary.href} size="lg" arrow>
        {primary.label}
      </ButtonLink>
      <ButtonLink href={secondary.href} size="lg" variant="secondary">
        {secondary.label}
      </ButtonLink>
    </div>
  )
}

/**
 * The animated film. Split from ScrollFilm so its scroll hooks only ever run
 * when the section they measure is actually mounted.
 */
function Film({
  reel,
  isLight,
  introAlt,
  texts,
  headline,
  ctaPrimary,
  ctaSecondary,
  scrollHint,
}: {
  reel: FilmReel
  isLight: boolean
  introAlt: string
  texts: readonly FilmText[]
  headline: { kicker: string; title: string; accent?: string }
  ctaPrimary: FilmCta
  ctaSecondary: FilmCta
  scrollHint: string
}) {
  const rootRef = useRef<HTMLElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  /** Paints the frame for a progress value; installed by the loader effect. */
  const paintRef = useRef<(p: number) => void>(() => {})

  const { scrollYProgress } = useScroll({
    target: rootRef,
    offset: ["start start", "end end"],
  })
  const progress = useSpring(scrollYProgress, FILM_SPRING)

  useMotionValueEvent(progress, "change", (p) => paintRef.current(p))

  /* ── camera ───────────────────────────────────────────────────────────
     A slow dolly-in across the whole film, then a hard push as the ball
     comes at the lens. The smear is a blur that only exists while the ball
     is in flight; at rest the footage is pin-sharp. */
  const cameraScale = useTransform(progress, [0, RECOIL, 0.99], [1, 1.045, 1.16], {
    ease: smoothstep,
  })
  const smear = useTransform(progress, [THROW, 0.965, 0.99], [0, 2.5, 6])
  // "none" at rest rather than blur(0px): a filter of any value keeps a
  // full-viewport offscreen layer alive for the whole film.
  const cameraFilter = useTransform(smear, (s) => (s < 0.05 ? "none" : `blur(${s.toFixed(2)}px)`))

  /* ── light ────────────────────────────────────────────────────────────
     The vignette closes in as the shot tightens on the ball; just before the
     hit a warm leather-orange bloom builds up, then the white flash, then the
     frame settles to the page background so the next section has no seam. */
  const vignette = useTransform(progress, [0.05, 0.8, 0.95], [0, 0.45, 0.75])
  const bloom = useTransform(progress, [THROW + 0.005, 0.965, 0.985], [0, 0.55, 0])
  const flash = useTransform(progress, [IMPACT_IN, 0.985], [0, 0.92], {
    ease: smoothstep,
  })
  const settle = useTransform(progress, [0.98, 1], [0, 1], { ease: smoothstep })

  /* ── type ─────────────────────────────────────────────────────────────── */
  const headOpacity = useTransform(progress, [0, HEAD_OUT * 0.55, HEAD_OUT], [1, 1, 0])
  const headY = useTransform(progress, [0, HEAD_OUT], [0, -28])
  const headEvents = useTransform(headOpacity, (o) => (o > 0.4 ? "auto" : "none"))
  const hintOpacity = useTransform(progress, [0, 0.025, 0.045], [1, 1, 0])
  const railScale = useTransform(progress, [0, 1], [0, 1])

  /* ── footage ──────────────────────────────────────────────────────────
     Loaded in two passes — a coarse sweep so a jump-scroll always lands near
     a decoded frame, then a dense front-to-back fill so a normal scroll has
     contiguous frames — and painted with the two neighbouring frames
     cross-faded by the fractional position between them. */
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d", { alpha: false })
    if (!ctx) return

    const { framePath, frames } = reel
    const src = (i: number) => `${framePath}/f${String(i).padStart(3, "0")}.webp`
    const images: (HTMLImageElement | null)[] = Array.from({ length: frames }, () => null)
    let disposed = false
    let lastKey = ""

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

    const paint = (p: number) => {
      const exact = Math.min(Math.max(p, 0), 1) * (frames - 1)
      const lo = Math.floor(exact)
      const hi = Math.min(lo + 1, frames - 1)
      // Quantised so a spring settling in sub-pixel steps does not repaint.
      const t = Math.round((exact - lo) * 24) / 24
      const base = nearestLoaded(lo)
      if (base < 0) return
      const blend = base === lo && t > 0 && images[hi] ? t : 0
      const key = `${base}:${blend}:${canvas.width}`
      if (key === lastKey) return
      lastKey = key
      ctx.globalAlpha = 1
      drawCover(images[base]!)
      if (blend > 0) {
        ctx.globalAlpha = blend
        drawCover(images[hi]!)
        ctx.globalAlpha = 1
      }
    }
    paintRef.current = paint

    const size = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = Math.round(window.innerWidth * dpr)
      const h = Math.round(window.innerHeight * dpr)
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
        lastKey = ""
        paint(progress.get())
      }
    }

    const load = (i: number) =>
      new Promise<void>((resolve) => {
        if (images[i]) return resolve()
        const img = new window.Image()
        img.decoding = "async"
        img.onload = () => {
          if (!disposed) {
            images[i] = img
            lastKey = ""
            paint(progress.get())
          }
          resolve()
        }
        img.onerror = () => resolve()
        img.src = src(i)
      })

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
      await pass(1)
    })()

    // Hidden tabs never run animation frames, so the spring would sit still
    // while the page scrolls underneath it; paint straight from the scroll
    // position there instead.
    const onScroll = () => {
      if (document.hidden) {
        progress.jump(scrollYProgress.get())
        paint(scrollYProgress.get())
      }
    }

    size()
    window.addEventListener("resize", size)
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      disposed = true
      paintRef.current = () => {}
      window.removeEventListener("resize", size)
      window.removeEventListener("scroll", onScroll)
    }
  }, [reel, progress, scrollYProgress])

  // Dark footage in dark mode wants white text + a dark scrim + shadows;
  // bright footage in light mode wants dark text + a light scrim + NO shadows
  // (dark-on-dark shadows just muddy it). The side lines' small subline also
  // needs a solid colour in light mode or it disappears.
  const hookShadow = isLight
    ? undefined
    : "0 1px 2px rgba(0,0,0,0.9), 0 2px 12px rgba(0,0,0,0.7), 0 0 40px rgba(0,0,0,0.55)"
  const subColor = isLight ? "#0b0b0d" : "rgba(255,255,255,0.94)"
  const subShadow = isLight ? undefined : "0 1px 2px rgba(0,0,0,0.95), 0 0 20px rgba(0,0,0,0.7)"
  const scrim = isLight
    ? "linear-gradient(90deg, rgba(255,255,255,0.72) 0%, rgba(255,255,255,0.14) 34%, rgba(255,255,255,0.14) 66%, rgba(255,255,255,0.72) 100%)"
    : "linear-gradient(90deg, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.2) 36%, rgba(0,0,0,0.2) 64%, rgba(0,0,0,0.8) 100%)"

  const seg = texts.length > 0 ? (TEXT_OUT - TEXT_IN) / texts.length : 1

  return (
    <section ref={rootRef} className="full-bleed relative" style={{ height: "620vh" }}>
      <div className="sticky top-0 h-svh w-full overflow-hidden bg-black">
        {/* L0 + L1 — poster (also the SSR/pre-JS paint) under the scrubbed
            canvas, moved together as one camera. */}
        <motion.div
          aria-hidden
          className="absolute inset-0 will-change-transform"
          style={{ scale: cameraScale, filter: cameraFilter, transformOrigin: "50% 55%" }}
        >
          <Image
            key={reel.intro}
            src={reel.intro}
            alt={introAlt}
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
          <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
        </motion.div>

        {/* readability scrim — keeps big type legible over bright or dark
            footage without hiding the ball at center */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-[5]"
          style={{ background: scrim }}
        />
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-[6]"
          style={{
            opacity: vignette,
            background:
              "radial-gradient(ellipse 70% 62% at 50% 55%, transparent 40%, rgba(0,0,0,0.85) 100%)",
          }}
        />

        {/* opening headline */}
        <motion.div
          className="absolute inset-x-0 top-[15svh] z-10 mx-auto max-w-7xl px-4 sm:px-6"
          style={{ opacity: headOpacity, y: headY, pointerEvents: headEvents }}
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
          <FilmCtas primary={ctaPrimary} secondary={ctaSecondary} />
        </motion.div>

        {/* side marketing lines */}
        {texts.map((tx, i) => (
          <FilmLine
            key={tx.hook}
            text={tx}
            progress={progress}
            start={TEXT_IN + i * seg}
            end={TEXT_IN + (i + 1) * seg}
            side={i === texts.length - 1 ? "center" : i % 2 === 0 ? "left" : "right"}
            hookShadow={hookShadow}
            subColor={subColor}
            subShadow={subShadow}
          />
        ))}

        {/* the ball's leather warming the frame just before it hits */}
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-[15] mix-blend-screen"
          style={{
            opacity: bloom,
            background:
              "radial-gradient(circle at 50% 55%, oklch(0.78 0.17 52 / 0.9) 0%, oklch(0.62 0.19 42 / 0.35) 38%, transparent 70%)",
          }}
        />

        {/* impact flash — the thrown ball hitting the lens. Explicit #fff:
            the `white` token is remapped to a dark slate in light mode, and
            the burst must stay a light overexposure in both themes. */}
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-20"
          style={{ opacity: flash, background: "#fff" }}
        />

        {/* post-impact settle — fades to the page background over the last
            frames so the handoff to the content below has no hard cut */}
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-30"
          style={{
            opacity: settle,
            background: isLight ? "oklch(0.965 0.008 82)" : "oklch(0.19 0.015 54)",
          }}
        />

        {/* film progress rail */}
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-[2px] origin-left bg-brand-500/80"
          style={{ scaleX: railScale }}
        />

        {/* scroll hint */}
        <motion.p
          aria-hidden
          className="absolute bottom-5 left-1/2 z-10 -translate-x-1/2 font-mono text-[10px] uppercase tracking-[0.22em] text-white/60"
          style={{ opacity: hintOpacity }}
        >
          {scrollHint}
          {/* drifts down and fades, then starts over — a pointer, not a bounce */}
          <motion.span
            className="ml-2 inline-block"
            animate={{ y: [0, 7], opacity: [1, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: [0.16, 1, 0.3, 1] }}
          >
            ↓
          </motion.span>
        </motion.p>
      </div>
    </section>
  )
}

/**
 * One marketing line. Flies in from its side, holds, and leaves the way it
 * came; the last one sits dead-centre over the close-up ball.
 */
function FilmLine({
  text,
  progress,
  start,
  end,
  side,
  hookShadow,
  subColor,
  subShadow,
}: {
  text: FilmText
  progress: MotionValue<number>
  start: number
  end: number
  side: "left" | "right" | "center"
  hookShadow: string | undefined
  subColor: string
  subShadow: string | undefined
}) {
  const T = (end - start) * HOLD
  const range = [start, start + T, end - T, end]
  const sign = side === "center" ? 0 : side === "left" ? -1 : 1
  const center = side === "center"

  const opacity = useTransform(progress, range, [0, 1, 1, 0], { ease: smoothstep })
  const x = useTransform(progress, range, [sign * 64, 0, 0, sign * 44], { ease: smoothstep })
  const scale = useTransform(progress, range, [0.92, 1, 1, 0.95], { ease: smoothstep })

  return (
    <div
      aria-hidden
      className={[
        "pointer-events-none absolute top-1/2 z-10 max-w-[min(92vw,36rem)]",
        center
          ? "left-1/2 -translate-x-1/2 -translate-y-1/2 text-center"
          : side === "right"
            ? "right-5 -translate-y-1/2 text-right sm:right-10 lg:right-16"
            : "left-5 -translate-y-1/2 text-left sm:left-10 lg:left-16",
      ].join(" ")}
    >
      <motion.div
        style={{
          opacity,
          x,
          scale,
          // The final line sits dead-centre over the close-up ball where the
          // side scrim is weakest — give it its own soft dark halo so white
          // text reads over the orange leather in BOTH themes.
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
            "font-display font-semibold leading-[0.98] tracking-[-0.015em] text-balance text-white",
            center ? "text-5xl sm:text-6xl lg:text-7xl" : "text-4xl sm:text-6xl lg:text-7xl",
          ].join(" ")}
          style={{
            color: center ? "#fff" : undefined,
            textShadow: center
              ? "0 2px 24px rgba(0,0,0,0.7), 0 1px 3px rgba(0,0,0,0.9)"
              : hookShadow,
          }}
        >
          {text.hook}
        </p>
        {text.sub ? (
          <p
            className="mt-4 text-pretty text-base font-semibold sm:text-lg"
            style={{ color: subColor, textShadow: subShadow }}
          >
            {text.sub}
          </p>
        ) : null}
      </motion.div>
    </div>
  )
}
