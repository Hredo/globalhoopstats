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
      const { homedir, userInfo } = await import("node:os")
      // Hostinger runs the app with HOME set to the site folder
      // (/home/<user>/domains/<site>), while the cron's shell — and the
      // documented cron line — read /home/<user>. Writing only to homedir()
      // left the cron reading a stale file and 401ing every night from July
      // to October 2026. The passwd entry (userInfo) is the account's real
      // home; both get the file.
      const homes = new Set([homedir(), userInfo().homedir].filter(Boolean))
      for (const home of homes) {
        const path = join(home, ".cron-auth.hdr")
        await writeFile(path, `X-Cron-Secret: ${process.env.CRON_SECRET}\n`, {
          mode: 0o600,
        })
        // writeFile's mode only applies on create; re-assert on overwrite.
        await chmod(path, 0o600)
        console.log(`[boot] cron auth header file ready at ${path}`)
      }
    } catch (err) {
      // Never block the boot on this — the cron just 401s until it's fixed.
      console.warn("[boot] could not write cron auth header file:", err)
    }
  }
}

type RequestErrorContext = {
  routerKind: string
  routePath: string
  routeType: string
}

/**
 * Every uncaught server error (render, route handler, server action) lands in
 * `app_errors`, grouped by fingerprint — see lib/ops/errors.ts. Node runtime
 * only (it needs the database), and it must never throw: a broken database is
 * one of the errors it would be reporting.
 */
export async function onRequestError(
  error: unknown,
  request: { path: string; method: string },
  context: RequestErrorContext,
) {
  if (process.env.NEXT_RUNTIME !== "nodejs") return
  try {
    const { recordError } = await import("@/lib/ops/errors")
    await recordError({
      kind: context.routeType || context.routerKind || "request",
      route: context.routePath || request.path.split("?")[0] || null,
      method: request.method,
      error,
    })
  } catch {
    // Reporting failed (usually the database itself); the log still has it.
  }
}
