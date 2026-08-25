// The Content-Security-Policy is built per request in middleware.ts, around
// a nonce — see src/lib/security/csp.ts. A header declared here is static,
// and a static header cannot carry a nonce, which is why script-src had to
// keep 'unsafe-inline' while it lived in this file.

const nextConfig = {
  // Don't advertise the framework (information disclosure).
  poweredByHeader: false,
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [480, 768, 1024, 1280, 1536],
    imageSizes: [96, 128, 256, 384],
    remotePatterns: [
      { protocol: "https", hostname: "cdn.nba.com" },
      { protocol: "https", hostname: "cdn.ssref.net" },
      { protocol: "https", hostname: "upload.wikimedia.org" },
      { protocol: "https", hostname: "i.ytimg.com" },
      { protocol: "https", hostname: "imagenes.feb.es" },
      { protocol: "https", hostname: "www.acb.com" },
    ],
  },
  eslint: {
    // Los errores de lint son preexistentes (reglas nuevas de React 19 en
    // eslint-config-next v16). No bloquean el build para no romper el deploy.
    ignoreDuringBuilds: true,
  },
  outputFileTracingRoot: process.cwd(),
  onDemandEntries: {
    maxInactiveAge: 1000 * 60 * 60,
    pagesBufferLength: 8,
  },
  // docx ships as IIFE; Turbopack fails with "super" error when transpiling it.
  // Remove the explicit transpile so Turbopack loads docx as-is.
  // transpilePackages: [],
  async headers() {
    return [
      {
        // Global security headers for all routes
        source: "/:path*",
        headers: [
          // Prevent MIME-type sniffing
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Disallow framing the site
          { key: "X-Frame-Options", value: "DENY" },
          // No referrer information on navigation
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Restrict browser features
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
          // Enforce HTTPS for 2 years
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains",
          },
          // Cross-origin isolation (COEP=unsafe-none because the site
          // loads external images/logos/thumbnails that don't set CORP)
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },
          {
            key: "Cross-Origin-Embedder-Policy",
            value: "unsafe-none",
          },
          {
            key: "Cross-Origin-Resource-Policy",
            value: "same-origin",
          },
          // Disable DNS prefetching (privacy)
          { key: "X-DNS-Prefetch-Control", value: "off" },
          // Opt out of XSS filter (redundant with CSP)
          { key: "X-XSS-Protection", value: "0" },
        ],
      },
    ]
  },
}

export default nextConfig
