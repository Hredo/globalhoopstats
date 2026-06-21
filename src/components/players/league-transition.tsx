"use client"

import { useSearchParams } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"

const easing: [number, number, number, number] = [0.16, 1, 0.3, 1]

export function LeagueTransition({
  children,
}: {
  children: React.ReactNode
}) {
  const searchParams = useSearchParams()
  const league = searchParams.get("league") ?? "default"

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={league}
        initial={{ opacity: 0, y: 16, filter: "blur(6px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        exit={{ opacity: 0, y: -12, filter: "blur(6px)" }}
        transition={{ duration: 0.4, ease: easing }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
