"use client"

import {
  createElement,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react"

export function ScaleIn({
  children,
  delay = 0,
  from = 0.92,
  once = true,
  amount = 0.2,
  className,
  style,
}: {
  children: ReactNode
  delay?: number
  from?: number
  once?: boolean
  amount?: number
  className?: string
  style?: React.CSSProperties
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [shown, setShown] = useState(false)
  const [reduce, setReduce] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    setReduce(mq.matches)
  }, [])

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
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: amount },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [reduce, once, amount])

  if (reduce) return <div className={className} style={style}>{children}</div>

  const cssStyle: CSSProperties = {
    opacity: shown ? 1 : 0,
    transform: shown ? "scale(1)" : `scale(${from})`,
    transition: `opacity 0.7s cubic-bezier(0.19,1,0.22,1) ${delay}s, transform 0.7s cubic-bezier(0.19,1,0.22,1) ${delay}s`,
    ...style,
  }

  return createElement("div", { ref, className, style: cssStyle }, children)
}
