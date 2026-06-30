/**
 * Next.js instrumentation hook — runs once when the server process boots.
 *
 * The data sync no longer runs inside the web server. It is a SEPARATE process
 * (`pnpm sync:*`, see scripts/sync.ts) triggered by an external Hostinger cron
 * job — see docs/SYNC.md. Keeping the scrape out of the web process means a
 * deploy/restart can't kill a sync mid-run, the long scrape never competes with
 * request traffic, and the sync worker can later move to its own machine.
 *
 * Nothing needs to start on boot today; this hook is kept as the documented
 * place for future boot-time wiring.
 */
export async function register() {
  // intentionally empty — sync is driven by external cron → CLI (docs/SYNC.md)
}
