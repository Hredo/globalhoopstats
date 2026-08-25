/**
 * The Content-Security-Policy, built per request around a nonce.
 *
 * It used to be a static header in next.config.mjs carrying
 * `script-src 'self' 'unsafe-inline'`. Everything else about it was strong —
 * `object-src 'none'`, `frame-ancestors 'none'`, `base-uri 'self'`,
 * `form-action 'self'` — but `'unsafe-inline'` is the one that decides how bad
 * an XSS is: with it, any injected `<script>` runs, and the rest of the policy
 * is decoration. It was there because Next.js emits inline bootstrap and
 * hydration scripts.
 *
 * A per-request nonce is the answer to that. Next puts the nonce on its own
 * inline scripts when it sees one in the CSP of the incoming request, so its
 * scripts keep working and anything injected — which cannot know the nonce —
 * does not.
 *
 * Deliberately NOT using `'strict-dynamic'`: it makes host allow-lists be
 * ignored, and this site is served through Cloudflare, which injects its
 * analytics beacon as an external script at the edge with no nonce of ours.
 * Under `'strict-dynamic'` that beacon would be blocked; with a plain nonce
 * plus the host allow-list it keeps working, and inline injection is still
 * dead. Nonce and host list together are the right trade here.
 */

/** Loopback Ollama is contacted from the browser to list installed models. */
const OLLAMA_CONNECT = "http://localhost:11434 http://127.0.0.1:11434"
/** Cloudflare Web Analytics, injected at the edge on the proxied domain. */
const CF_SCRIPT = "https://static.cloudflareinsights.com"
const CF_CONNECT = "https://cloudflareinsights.com"

export type CspOptions = {
  nonce: string
  /** Dev needs eval for React Refresh and a websocket for hot reload. */
  dev: boolean
  /**
   * The advisor renders model-written content, so it does not get the blanket
   * `https:` image source the rest of the site needs for club badges.
   */
  strictImages: boolean
}

export function buildCsp({ nonce, dev, strictImages }: CspOptions): string {
  const scriptSrc = [
    "script-src 'self'",
    `'nonce-${nonce}'`,
    CF_SCRIPT,
    // React Refresh compiles modules with eval. Never in production.
    dev ? "'unsafe-eval'" : null,
  ]
    .filter(Boolean)
    .join(" ")

  const connectSrc = [
    "connect-src 'self'",
    dev ? "ws: wss:" : null,
    OLLAMA_CONNECT,
    CF_CONNECT,
  ]
    .filter(Boolean)
    .join(" ")

  return [
    "default-src 'self'",
    scriptSrc,
    // Style nonces are not workable here: Next and the CSS-in-JS path emit
    // style attributes rather than style elements, and `'unsafe-inline'` on
    // styles cannot execute script.
    "style-src 'self' 'unsafe-inline'",
    strictImages
      ? "img-src 'self' data: https:"
      : "img-src 'self' data: https: blob:",
    "font-src 'self' data:",
    connectSrc,
    "frame-src 'none'",
    "object-src 'none'",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    // Nothing on this site should ever be posted to over plain HTTP.
    dev ? null : "upgrade-insecure-requests",
  ]
    .filter(Boolean)
    .join("; ")
}

/**
 * A fresh nonce. Base64 of 16 random bytes — `crypto` is the Web Crypto global,
 * available in both the Node and Edge middleware runtimes.
 */
export function newCspNonce(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes))
}
