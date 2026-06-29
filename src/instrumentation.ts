/**
 * Next.js instrumentation hook — runs once when the server process boots.
 * We use it to start the in-process nightly sync scheduler, so the data refresh
 * needs no external trigger (GitHub Actions / cron service).
 */
export async function register() {
  // Only on the Node.js server runtime, only in production, and only when not
  // explicitly disabled. (Avoids scraping from local dev and the Edge runtime.)
  if (process.env.NEXT_RUNTIME !== "nodejs") return
  if (process.env.NODE_ENV !== "production") return
  if (process.env.DISABLE_INTERNAL_CRON === "1") return

  const { startScheduler } = await import("@/lib/sync/scheduler")
  startScheduler()
}
