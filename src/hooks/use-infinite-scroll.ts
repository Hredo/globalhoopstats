"use client"

import { useEffect, useRef } from "react"

type Options = {
  onIntersect: () => void
  enabled: boolean
  rootMargin?: string
}

export function useInfiniteScroll({
  onIntersect,
  enabled,
  rootMargin = "0px 0px 600px 0px",
}: Options) {
  const ref = useRef<HTMLDivElement | null>(null)
  // Latest-callback ref, updated in an effect (not during render) so the
  // observer always calls the current handler without re-subscribing.
  const cbRef = useRef(onIntersect)
  useEffect(() => {
    cbRef.current = onIntersect
  }, [onIntersect])

  useEffect(() => {
    if (!enabled) return
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === "undefined") return
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            cbRef.current()
            return
          }
        }
      },
      { rootMargin },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [enabled, rootMargin])

  return ref
}
