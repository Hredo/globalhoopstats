"use client"

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react"

export function AnimatedBar({
  value,
  max = 100,
  delay = 0,
  duration = 0.6,
  color,
  className,
  style,
}: {
  value: number
  max?: number
  delay?: number
  duration?: number
  color?: string
  className?: string
  style?: React.CSSProperties
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [shown, setShown] = useState(false)
  const [reduce, setReduce] = useState(false)
  const pct = Math.min(100, (value / max) * 100)

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    setReduce(mq.matches)
  }, [])

  useEffect(() => {
    if (reduce) return
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true)
            io.unobserve(entry.target)
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.3 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [reduce])

  const actualStyle: CSSProperties = reduce
    ? { width: `${pct}%`, ...style }
    : {
        width: shown ? `${pct}%` : "0%",
        transition: `width ${duration}s cubic-bezier(0.19,1,0.22,1) ${delay}s`,
        ...style,
      }

  return (
    <div
      ref={ref}
      className={`h-full rounded-full ${color ?? "bg-brand-500"} ${className ?? ""}`}
      style={actualStyle}
    />
  )
}
