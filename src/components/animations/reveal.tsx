"use client"

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react"
import { useReducedMotion } from "@/hooks/use-reduced-motion"

type Direction = "up" | "down" | "left" | "right" | "none"

const OFFSET: Record<Direction, { x: number; y: number }> = {
  up: { x: 0, y: 28 },
  down: { x: 0, y: -28 },
  left: { x: 36, y: 0 },
  right: { x: -36, y: 0 },
  none: { x: 0, y: 0 },
}

export function Reveal({
  children,
  delay = 0,
  direction = "up",
  blur = true,
  once = true,
  amount = 0.25,
  className,
}: {
  children: ReactNode
  delay?: number
  direction?: Direction
  blur?: boolean
  once?: boolean
  amount?: number
  className?: string
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [shown, setShown] = useState(false)
  const reduce = useReducedMotion()

  useEffect(() => {
    if (reduce) return
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      setShown(true)
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true)
            if (once) io.unobserve(entry.target)
          } else if (!once) {
            setShown(false)
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: amount },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [reduce, once, amount])

  if (reduce) return <div className={className}>{children}</div>

  const { x, y } = OFFSET[direction]
  const style: CSSProperties = {
    opacity: shown ? 1 : 0,
    transform: shown
      ? "translate3d(0,0,0)"
      : `translate3d(${x}px,${y}px,0)`,
    filter: blur ? (shown ? "blur(0px)" : "blur(10px)") : undefined,
    transition: `opacity 0.85s cubic-bezier(0.19,1,0.22,1) ${delay}s, transform 0.85s cubic-bezier(0.19,1,0.22,1) ${delay}s, filter 0.85s cubic-bezier(0.19,1,0.22,1) ${delay}s`,
  }

  return <div ref={ref} className={className} style={style}>{children}</div>
}

export function Stagger({
  children,
  className,
  amount = 0.2,
  once = true,
}: {
  children: ReactNode
  className?: string
  amount?: number
  once?: boolean
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [shown, setShown] = useState(false)
  const reduce = useReducedMotion()

  useEffect(() => {
    if (reduce) return
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true)
            if (once) io.unobserve(entry.target)
          } else if (!once) {
            setShown(false)
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: amount },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [reduce, once, amount])

  if (reduce) return <div className={className}>{children}</div>

  return (
    <div
      ref={ref}
      className={className}
      data-stagger-shown={shown ? "true" : "false"}
    >
      {children}
    </div>
  )
}

export function StaggerItem({
  children,
  className,
  delay,
}: {
  children: ReactNode
  className?: string
  delay?: number
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [shown, setShown] = useState(false)
  const reduce = useReducedMotion()

  useEffect(() => {
    if (reduce) return
    const el = ref.current
    if (!el) return
    const parent = el.closest("[data-stagger-shown]")
    const parentShown = parent?.getAttribute("data-stagger-shown") === "true"

    if (parentShown) {
      setShown(true)
      return
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true)
            io.unobserve(entry.target)
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.1 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [reduce])

  if (reduce) return <div className={className}>{children}</div>

  const style: CSSProperties = {
    opacity: shown ? 1 : 0,
    transform: shown ? "translate3d(0,0,0)" : "translate3d(0,26px,0)",
    filter: shown ? "blur(0px)" : "blur(10px)",
    transition: `opacity 0.8s cubic-bezier(0.19,1,0.22,1) ${delay ?? 0}s, transform 0.8s cubic-bezier(0.19,1,0.22,1) ${delay ?? 0}s, filter 0.8s cubic-bezier(0.19,1,0.22,1) ${delay ?? 0}s`,
  }

  return <div ref={ref} className={className} style={style}>{children}</div>
}
