"use client"

import { useSyncExternalStore } from "react"

function getSnapshot(): boolean {
  if (typeof window === "undefined") return true
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

function subscribe(callback: () => void): () => void {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
  mq.addEventListener("change", callback)
  return () => mq.removeEventListener("change", callback)
}

/**
 * `serverValue` is what the server render (and hydration) assumes. The safe
 * default is `true`; pass `false` where swapping the markup after hydration
 * costs more than a few frames of motion for reduced-motion visitors — the
 * homepage hero, whose poster is the LCP element and must not be re-mounted.
 */
export function useReducedMotion(serverValue = true): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => serverValue)
}
