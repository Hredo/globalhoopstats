"use client"

import dynamic from "next/dynamic"
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react"

/** Neutral, on-brand placeholder shown only while the three.js chunk loads.
 *  Deliberately NOT the marketing mockup, so capable devices go straight from
 *  a subtle skeleton to the live 3D model (never "image, then model"). */
function SceneSkeleton() {
  return (
    <div className="relative h-full w-full overflow-hidden rounded-3xl">
      <div className="gh-hero-skeleton absolute inset-0" />
      <div className="absolute inset-0 grid place-items-center">
        <span className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-400">
          <span className="h-1.5 w-1.5 animate-ping rounded-full bg-brand-400" />
          3D
        </span>
      </div>
    </div>
  )
}

// Heavy (three.js + postprocessing). Kept out of the initial bundle and off the
// server. While the chunk loads we show the neutral skeleton above.
const Scene = dynamic(() => import("./duel-scene"), {
  ssr: false,
  loading: () => <SceneSkeleton />,
})

/**
 * Gated loader for the hero "duel" 3D piece. On capable devices it mounts the
 * WebGL canvas immediately on load (the hero is above the fold, so `inView`
 * starts true) and shows only a light skeleton while three.js streams in — no
 * marketing-image flash first. Low-power / mobile / reduced-motion / data-saver
 * devices (and crawlers / no-JS via SSR) get the static `fallback` instead.
 */
export function HeroDuel({
  fallback,
  caption,
  prefer3d,
}: {
  fallback: ReactNode
  caption?: string
  prefer3d?: boolean
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [ok, setOk] = useState(!!prefer3d)
  const [inView, setInView] = useState(true)

  useEffect(() => {
    if (prefer3d) return
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const wide = window.matchMedia("(min-width: 768px)").matches
    const fine = window.matchMedia("(pointer: fine)").matches
    const nav = navigator as Navigator & { connection?: { saveData?: boolean } }
    const saveData = nav.connection?.saveData === true
    setOk(!reduce && wide && fine && !saveData) // eslint-disable-line react-hooks/set-state-in-effect
  }, [prefer3d])

  useEffect(() => {
    if (!ok) return
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) setInView(e.isIntersecting)
      },
      { threshold: 0.15 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [ok])

  const show3d = ok && inView

  return (
    <div ref={ref} className="relative">
      {show3d ? (
        <figure className="relative m-0 mx-auto max-w-[540px] lg:max-w-none">
          <div className="relative aspect-square w-full cursor-grab active:cursor-grabbing">
            <Scene />
          </div>
          {caption ? (
            <figcaption className="mt-3 text-center font-mono text-[11px] uppercase tracking-[0.18em] text-ink-400">
              {caption}
            </figcaption>
          ) : null}
        </figure>
      ) : (
        fallback
      )}
    </div>
  )
}
