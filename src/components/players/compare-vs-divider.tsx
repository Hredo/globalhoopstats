"use client"

import { motion } from "framer-motion"

export function CompareVsDivider({ label }: { label: string }) {
  return (
    <motion.div
      className="relative flex items-center justify-center md:flex-col"
      aria-hidden
      animate={{ scale: [1, 1.04, 1] }}
      transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
    >
      <span className="hidden h-full w-px bg-gradient-to-b from-transparent via-hairline-strong to-transparent md:block" />
      <motion.div
        className="absolute -inset-4 rounded-full opacity-30 blur-2xl"
        animate={{ opacity: [0.2, 0.5, 0.2] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        style={{
          background:
            "radial-gradient(circle at 50% 50%, var(--color-brand-500/25), var(--color-accent-cyan/15), transparent 70%)",
        }}
      />
      <span className="gh-bezel relative flex h-14 w-14 items-center justify-center">
        <span className="gh-bezel-inner flex h-full w-full items-center justify-center font-display text-base font-bold text-ink-200">
          {label}
        </span>
      </span>
      <span className="hidden h-full w-px bg-gradient-to-b from-transparent via-hairline-strong to-transparent md:block" />
    </motion.div>
  )
}
