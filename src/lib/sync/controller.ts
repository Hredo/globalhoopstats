/**
 * In-memory controller for the manually-triggered sync, so the admin panel can
 * start one, see whether one is running, and request a stop.
 *
 * State lives on globalThis so it survives Next's dev HMR module reloads and is
 * shared across all route handlers in the single long-running server process.
 * (This assumes one app instance — which is the case on the Hostinger Node
 * server. The cron route additionally keeps a DB-based guard for safety.)
 */

type SyncControlState = {
  running: boolean
  targets: string[]
  startedAt: number | null
  cancelRequested: boolean
  trigger: "admin" | "cron" | null
}

const g = globalThis as unknown as { __ghsSyncControl?: SyncControlState }
const state: SyncControlState =
  g.__ghsSyncControl ??
  (g.__ghsSyncControl = {
    running: false,
    targets: [],
    startedAt: null,
    cancelRequested: false,
    trigger: null,
  })

/** Try to claim the run. Returns false if a sync is already in progress. */
export function beginSync(targets: string[], trigger: "admin" | "cron"): boolean {
  if (state.running) return false
  state.running = true
  state.targets = targets
  state.startedAt = Date.now()
  state.cancelRequested = false
  state.trigger = trigger
  return true
}

export function endSync(): void {
  state.running = false
  state.targets = []
  state.startedAt = null
  state.cancelRequested = false
  state.trigger = null
}

/** Ask the running sync to stop. Returns false if nothing is running. */
export function requestCancel(): boolean {
  if (!state.running) return false
  state.cancelRequested = true
  return true
}

export function isCancelRequested(): boolean {
  return state.cancelRequested
}

export function isSyncRunning(): boolean {
  return state.running
}

export type SyncSnapshot = {
  running: boolean
  targets: string[]
  startedAt: string | null
  cancelRequested: boolean
  trigger: "admin" | "cron" | null
}

export function syncSnapshot(): SyncSnapshot {
  return {
    running: state.running,
    targets: [...state.targets],
    startedAt: state.startedAt ? new Date(state.startedAt).toISOString() : null,
    cancelRequested: state.cancelRequested,
    trigger: state.trigger,
  }
}
