"use client"

import { useEffect, useRef, useState, type RefObject } from "react"
import { useReducedMotion } from "@/hooks/use-reduced-motion"

export function useScrollProgress(ref: RefObject<HTMLElement | null>): number {
  const [progress, setProgress] = useState(0)
  const rafRef = useRef<number | null>(null)
  const latestProgress = useRef(0)

  const reduce = useReducedMotion()

  useEffect(() => {
    if (reduce) {
      setProgress(1) // eslint-disable-line react-hooks/set-state-in-effect
      return
    }

    function update() {
      rafRef.current = null
      const el = ref.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const vh = window.innerHeight || 1
      const start = vh
      const end = -rect.height
      const span = start - end
      const p = Math.max(0, Math.min(1, (start - rect.top) / span))
      if (Math.abs(p - latestProgress.current) > 0.005) {
        latestProgress.current = p
        setProgress(p)
      }
    }

    function onScroll() {
      if (rafRef.current !== null) return
      rafRef.current = requestAnimationFrame(update)
    }

    update()
    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onScroll)
    return () => {
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onScroll)
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [ref, reduce])

  return progress
}
