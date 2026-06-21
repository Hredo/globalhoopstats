"use client"

import { AnimatePresence, motion } from "framer-motion"
import type { ReactNode } from "react"

type Props = {
  children: ReactNode
  league: string
  query: string
  sort: string
  order: string
}

export function PageTransition({ children, league, query, sort, order }: Props) {
  const compositeKey = `${league}|${query}|${sort}|${order}`

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={compositeKey}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
