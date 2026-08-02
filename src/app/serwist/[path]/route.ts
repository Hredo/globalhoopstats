// Static service worker served at /serwist/sw.js.
//
// The previous implementation compiled the worker on demand with
// @serwist/turbopack (createSerwistRoute), which needs the TypeScript source
// (src/app/sw.ts) plus a working esbuild/esbuild-wasm at *request* time.
// Hostinger's auto-deploy ships build artifacts only — no repo source and no
// usable esbuild binary at runtime — so the route threw on every hit and
// `/serwist/sw.js` returned 500 for every visitor. Browsers re-fetch the SW
// script on each load (and retry), so this alone produced the bulk of the
// site's 5xx traffic.
//
// This hand-written worker has no build step: the handler just returns a plain
// string, so it cannot 500 on any runtime. Same URL as before, so
// already-registered clients also start getting 200s.

const SW_SCRIPT = `// globalhoopstats service worker (minimal, no precache).
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Network-only passthrough. A fetch handler is required for the app to stay
// installable as a PWA; we intentionally do not cache so no stale HTML/API
// responses are ever served.
self.addEventListener("fetch", () => {});
`

// Plain dynamic handler: runs per request, does no I/O or compilation, so it is
// cheap and cannot fail. Browser/Cloudflare still cache it via the headers.
export const dynamic = "force-dynamic"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string }> },
) {
  const { path } = await params
  if (path === "sw.js") {
    return new Response(SW_SCRIPT, {
      headers: {
        "Content-Type": "text/javascript; charset=utf-8",
        "Service-Worker-Allowed": "/",
        "Cache-Control": "public, max-age=0, must-revalidate",
      },
    })
  }
  // sw.js.map (or anything else under /serwist/*) — nothing to serve.
  return new Response(null, { status: 404 })
}
