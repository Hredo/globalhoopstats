"use client"

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react"

export function Parallax({
  children,
  speed = 60,
  className,
  style,
}: {
  children: ReactNode
  speed?: number
  className?: string
  style?: CSSProperties
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [reduce, setReduce] = useState(false)
  const yOffset = useRef(0)
  const raf = useRef(0)

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    setReduce(mq.matches)
  }, [])

  useEffect(() => {
    if (reduce) return
    const el = ref.current
    if (!el) return

    const update = () => {
      raf.current = 0
      const rect = el.getBoundingClientRect()
      const viewH = window.innerHeight
      const center = (rect.top + rect.bottom) / 2
      const scrollPct = center / viewH
      yOffset.current = (scrollPct - 0.5) * 2 * speed
      el.style.transform = `translate3d(0,${yOffset.current.toFixed(1)}px,0)`
    }

    const onScroll = () => {
      if (!raf.current) raf.current = requestAnimationFrame(update)
    }

    update()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      window.removeEventListener("scroll", onScroll)
      if (raf.current) cancelAnimationFrame(raf.current)
    }
  }, [reduce, speed])

  return (
    <div
      ref={ref}
      className={className}
      style={reduce ? style : { ...style, willChange: "transform" }}
    >
      {children}
    </div>
  )
}
