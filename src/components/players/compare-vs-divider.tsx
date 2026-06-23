"use client"

import { motion } from "framer-motion"

export function CompareVsDivider({ label }: { label: string }) {
  return (
    <motion.div
      className="flex items-center justify-center md:flex-col"
      aria-hidden
      animate={{ scale: [1, 1.04, 1] }}
      transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
    >
      <span className="hidden h-full w-px bg-gradient-to-b from-transparent via-hairline-strong to-transparent md:block" />
      <span className="gh-bezel flex h-14 w-14 items-center justify-center">
        <span className="gh-bezel-inner flex h-full w-full items-center justify-center font-display text-base font-bold text-ink-200">
          {label}
        </span>
      </span>
      <span className="hidden h-full w-px bg-gradient-to-b from-transparent via-hairline-strong to-transparent md:block" />
    </motion.div>
  )
}
