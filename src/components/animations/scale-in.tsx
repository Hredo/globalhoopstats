"use client"

import { motion, useReducedMotion } from "framer-motion"
import type { ComponentProps, ReactNode } from "react"

export function ScaleIn({
  children,
  delay = 0,
  from = 0.92,
  once = true,
  amount = 0.2,
  className,
  ...rest
}: {
  children: ReactNode
  delay?: number
  from?: number
  once?: boolean
  amount?: number
  className?: string
} & Omit<ComponentProps<typeof motion.div>, "children">) {
  const reduce = useReducedMotion()

  if (reduce) {
    return (
      <div className={className} {...(rest as ComponentProps<"div">)}>
        {children}
      </div>
    )
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, scale: from }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once, amount, margin: "0px 0px -8% 0px" }}
      transition={{
        duration: 0.7,
        delay,
        ease: [0.19, 1, 0.22, 1],
      }}
      {...rest}
    >
      {children}
    </motion.div>
  )
}
