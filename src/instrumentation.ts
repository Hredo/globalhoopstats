/**
 * Next.js instrumentation hook — runs once when the server process boots.
 *
 * The scheduled data sync is kicked by an external Hostinger cron job that
 * curls POST /api/cron/sync (see docs/SYNC.md); the handler responds 202 and
 * the sync continues detached in this server process.
 *
 * So the cron can authenticate WITHOUT the secret ever appearing in the
 * inspectable hPanel cron command, this hook materialises the app's own
 * CRON_SECRET into a 0600 header file in $HOME; the cron line then reads it
 * with `curl -H @$HOME/.cron-auth.hdr …`.
 */
export async function register() {
  if (
    process.env.NEXT_RUNTIME === "nodejs" &&
    process.env.NODE_ENV === "production" &&
    process.env.CRON_SECRET
  ) {
    try {
      const { writeFile, chmod } = await import("node:fs/promises")
      const { join } = await import("node:path")
      const { homedir } = await import("node:os")
      const path = join(homedir(), ".cron-auth.hdr")
      await writeFile(path, `X-Cron-Secret: ${process.env.CRON_SECRET}\n`, {
        mode: 0o600,
      })
      // writeFile's mode only applies on create; re-assert on overwrite.
      await chmod(path, 0o600)
      console.log(`[boot] cron auth header file ready at ${path}`)
    } catch (err) {
      // Never block the boot on this — the cron just 401s until it's fixed.
      console.warn("[boot] could not write cron auth header file:", err)
    }
  }
}
