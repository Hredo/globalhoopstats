"use client"

/**
 * One shared view of "who is signed in" for client components.
 *
 * The navbar bell, follow buttons, shortlist pickers and the user menu all need
 * it; each calling /api/auth/me on its own meant several requests per page.
 * This keeps a single in-flight request and one cached answer, refreshed on
 * the `auth:changed` event the auth forms already dispatch.
 */
import { useEffect, useSyncExternalStore } from "react"

export type SessionUser = { id: string; email: string; name: string; plan: string; role: string }
type State = { status: "loading" | "ready"; user: SessionUser | null }

let state: State = { status: "loading", user: null }
let inflight: Promise<void> | null = null
const listeners = new Set<() => void>()

function emit(next: State) {
  state = next
  for (const l of listeners) l()
}

export function refreshSession(): Promise<void> {
  if (inflight) return inflight
  inflight = fetch("/api/auth/me", { cache: "no-store" })
    .then((r) => r.json() as Promise<{ user: SessionUser | null }>)
    .then((d) => emit({ status: "ready", user: d.user ?? null }))
    .catch(() => emit({ ...state, status: "ready" }))
    .finally(() => {
      inflight = null
    })
  return inflight
}

let wired = false
function wire() {
  if (wired || typeof window === "undefined") return
  wired = true
  window.addEventListener("auth:changed", () => void refreshSession())
}

const subscribe = (cb: () => void) => {
  listeners.add(cb)
  return () => listeners.delete(cb)
}
const SERVER: State = { status: "loading", user: null }

export function useSession(): State {
  const snap = useSyncExternalStore(subscribe, () => state, () => SERVER)
  useEffect(() => {
    wire()
    if (state.status === "loading" && !inflight) void refreshSession()
  }, [])
  return snap
}
