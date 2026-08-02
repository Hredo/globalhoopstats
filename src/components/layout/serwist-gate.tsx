"use client"

import { useEffect } from "react"
import type { ReactNode } from "react"

/**
 * Registers the (now static) service worker in production. Kept as a thin
 * wrapper — no dependency on @serwist/turbopack, which compiled the worker at
 * request time and 500'd on Hostinger. Registration failures must never break
 * the app, so they are swallowed.
 */
export function SerwistGate({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" ||
      typeof navigator === "undefined" ||
      !("serviceWorker" in navigator)
    ) {
      return
    }
    navigator.serviceWorker.register("/serwist/sw.js").catch(() => {
      /* SW registration is best-effort; ignore failures. */
    })
  }, [])

  return <>{children}</>
}
