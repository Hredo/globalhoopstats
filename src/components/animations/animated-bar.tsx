"use client"

import { motion, useReducedMotion } from "framer-motion"

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
  const reduce = useReducedMotion()
  const pct = Math.min(100, (value / max) * 100)

  if (reduce) {
    return (
      <div
        className={`h-full rounded-full ${color ?? "bg-brand-500"} ${className ?? ""}`}
        style={{ width: `${pct}%`, ...style }}
      />
    )
  }

  return (
    <motion.div
      className={`h-full rounded-full ${color ?? "bg-brand-500"} ${className ?? ""}`}
      initial={{ width: "0%" }}
      whileInView={{ width: `${pct}%` }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration, delay, ease: [0.19, 1, 0.22, 1] }}
      style={style}
    />
  )
}
