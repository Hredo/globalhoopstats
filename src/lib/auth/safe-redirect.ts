/**
 * Sanitise a post-login `next` redirect target.
 *
 * Only same-site absolute paths are allowed. A bare `startsWith("/")` check is
 * NOT enough: protocol-relative URLs (`//evil.com`) and backslash tricks
 * (`/\evil.com`) also start with a slash but resolve to an external origin via
 * `new URL(next, origin)` or the client router, enabling open redirects.
 *
 * Neither is a regex on the raw string: the URL parser deletes tab, CR and LF
 * wherever they appear, so `/\t/evil.com` passes a "no second slash" check
 * and then navigates to `//evil.com`. The target is therefore resolved the way
 * the browser will resolve it, and kept only if it stays on our origin.
 */
const PROBE_ORIGIN = "https://same-origin.invalid"

export function safeNextPath(
  raw: string | null | undefined,
  fallback = "/ai-advisor",
): string {
  if (!raw) return fallback
  if (!raw.startsWith("/") || /[\u0000-\u001f\u007f\\]/.test(raw)) return fallback
  let resolved: URL
  try {
    resolved = new URL(raw, PROBE_ORIGIN)
  } catch {
    return fallback
  }
  if (resolved.origin !== PROBE_ORIGIN) return fallback
  // Dot segments can collapse into a leading `//` (`/../..//evil.com`), which
  // is protocol-relative again once handed back as a bare path.
  if (resolved.pathname.startsWith("//")) return fallback
  return `${resolved.pathname}${resolved.search}${resolved.hash}`
}
