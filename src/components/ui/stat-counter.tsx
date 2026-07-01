"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "@/components/ui/cn"

type StatCounterProps = {
  to: number
  duration?: number
  decimals?: number
  prefix?: string
  suffix?: string
  className?: string
}

/**
 * Editorial stat counter. Counts up (eased) when scrolled into view, with a
 * blur-in settle and a brand accent bar that fills alongside the number — a
 * step up from the plain <CountUp>. Honors prefers-reduced-motion (snaps to the
 * final value, no motion). Numbers are tabular so columns never jitter.
 */
export function StatCounter({
  to,
  duration = 1400,
  decimals = 0,
  prefix = "",
  suffix = "",
  className,
}: StatCounterProps) {
  const ref = useRef<HTMLSpanElement | null>(null)
  const barRef = useRef<HTMLSpanElement | null>(null)
  const [value, setValue] = useState(0)
  const [settled, setSettled] = useState(false)
  const started = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (reduce) {
      setValue(to)
      setSettled(true)
      if (barRef.current) barRef.current.style.transform = "scaleX(1)"
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !started.current) {
            started.current = true
            const start = performance.now()
            const step = (now: number) => {
              const t = Math.min(1, (now - start) / duration)
              const eased = 1 - Math.pow(1 - t, 3)
              setValue(eased * to)
              if (barRef.current)
                barRef.current.style.transform = `scaleX(${eased})`
              if (t < 1) requestAnimationFrame(step)
              else setSettled(true)
            }
            requestAnimationFrame(step)
            io.disconnect()
          }
        }
      },
      { threshold: 0.4 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [to, duration])

  return (
    <span className="inline-flex flex-col">
      <span
        ref={ref}
        className={cn(
          "nums tabular-nums transition-[filter,opacity] duration-500 ease-out",
          settled ? "opacity-100 blur-0" : "opacity-90 blur-[0.5px]",
          className,
        )}
      >
        {prefix}
        {value.toFixed(decimals)}
        {suffix}
      </span>
      <span aria-hidden className="mt-1 h-[2px] w-full overflow-hidden rounded-full bg-white/[0.06]">
        <span
          ref={barRef}
          style={{ transform: "scaleX(0)" }}
          className="block h-full w-full origin-left rounded-full bg-gradient-to-r from-brand-400 to-ember-500"
        />
      </span>
    </span>
  )
}

export default StatCounter
