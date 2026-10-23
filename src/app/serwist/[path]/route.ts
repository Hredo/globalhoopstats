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

const SW_SCRIPT = `// globalhoopstats service worker (minimal: only the offline page is cached).
const OFFLINE_CACHE = "ghs-offline-v1";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  // A failed precache must not stop the worker from installing.
  event.waitUntil(
    caches.open(OFFLINE_CACHE)
      .then((cache) => cache.addAll([OFFLINE_URL, "/hoop-game.js"]))
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("ghs-offline-") && k !== OFFLINE_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network-only, so no stale HTML/API response is ever served. The one
// exception: a page navigation that fails outright (no connection) gets the
// cached offline page with the mini-game instead of the browser's error.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() =>
        caches.match(OFFLINE_URL).then((res) => res || Response.error())
      )
    );
    return;
  }
  if (new URL(req.url).pathname === "/hoop-game.js") {
    event.respondWith(fetch(req).catch(() => caches.match(req).then((res) => res || Response.error())));
  }
});

// Alerts (lib/alerts/push.ts). The payload is { title, body, href }; href is
// always a same-site path, and anything else falls back to /following.
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) {}
  const href = typeof data.href === "string" && data.href.startsWith("/") && !data.href.startsWith("//") ? data.href : "/following";
  event.waitUntil(
    self.registration.showNotification(data.title || "globalhoopstats", {
      body: data.body || "",
      icon: "/icon-192",
      badge: "/icon-192",
      data: { href },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const href = (event.notification.data && event.notification.data.href) || "/following";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (new URL(c.url).origin === self.location.origin && "focus" in c) {
          c.navigate(href);
          return c.focus();
        }
      }
      return self.clients.openWindow(href);
    })
  );
});
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
