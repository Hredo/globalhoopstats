"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"

type Props = {
  children: ReactNode
  league: string
  query: string
  sort: string
  order: string
}

export function PageTransition({ children, league, query, sort, order }: Props) {
  const compositeKey = `${league}|${query}|${sort}|${order}`
  const prevKey = useRef(compositeKey)
  const [animating, setAnimating] = useState(false)
  const [content, setContent] = useState(children)

  useEffect(() => {
    if (compositeKey !== prevKey.current) {
      setAnimating(true)
      const t = setTimeout(() => {
        setContent(children)
        prevKey.current = compositeKey
        setAnimating(false)
      }, 150)
      return () => clearTimeout(t)
    }
    setContent(children)
  }, [compositeKey, children])

  return (
    <div
      style={{
        opacity: animating ? 0 : 1,
        transform: animating ? "translate3d(0,12px,0)" : "translate3d(0,0,0)",
        transition: "opacity 0.25s cubic-bezier(0.16,1,0.3,1), transform 0.25s cubic-bezier(0.16,1,0.3,1)",
      }}
    >
      {content}
    </div>
  )
}
