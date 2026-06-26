"use client"

import { SerwistProvider } from "@serwist/turbopack/react"
import type { ReactNode } from "react"

export function SerwistGate({ children }: { children: ReactNode }) {
  if (process.env.NODE_ENV !== "production") return <>{children}</>
  return <SerwistProvider swUrl="/serwist/sw.js">{children}</SerwistProvider>
}
