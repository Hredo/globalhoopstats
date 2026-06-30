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

/**
 * Cross-process cancellation. The in-memory flag above only reaches a sync
 * running in THIS process (the admin/cron Next.js server). A sync launched from
 * a terminal (`pnpm sync:*`) or another worker is a different process, so Stop
 * also drops a timestamp sentinel in `app_config`; every sync polls it at league
 * boundaries and aborts when it sees a cancel newer than its own start.
 */
const CANCEL_KEY = "sync_cancel_at"

/** Record a cancel request visible to every process. */
export async function requestCancelDb(): Promise<void> {
  const { getDb } = await import("@/lib/db/client")
  const { appConfig } = await import("@/lib/db/schema")
  const db = getDb()
  const now = String(Date.now())
  await db
    .insert(appConfig)
    .values({ key: CANCEL_KEY, value: now, description: "Sync stop signal (ms epoch)" })
    .onConflictDoUpdate({ target: appConfig.key, set: { value: now, updatedAt: new Date() } })
}

/** True when a Stop was requested AFTER the given run-start time (ms epoch). */
export async function isSyncCancelled(sinceMs: number): Promise<boolean> {
  const { getDb } = await import("@/lib/db/client")
  const { appConfig } = await import("@/lib/db/schema")
  const { eq } = await import("drizzle-orm")
  const db = getDb()
  const [row] = await db
    .select({ value: appConfig.value })
    .from(appConfig)
    .where(eq(appConfig.key, CANCEL_KEY))
    .limit(1)
  if (!row) return false
  const at = Number(row.value)
  return Number.isFinite(at) && at > sinceMs
}
