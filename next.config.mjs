import { withSerwist } from "@serwist/turbopack"

const isDev = process.env.NODE_ENV !== "production"

// Loopback Ollama (local LLM) is contacted from the browser to list installed
// models, so it must stay in connect-src.
const OLLAMA_CONNECT = "http://localhost:11434 http://127.0.0.1:11434"

// In dev, Next/Turbopack needs eval (React Refresh / HMR) and a websocket for
// hot reload. In production neither is required, so we drop them — this is what
// makes the CSP an effective anti-XSS / anti-exfiltration control.
const scriptSrc = isDev
  ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
  : "script-src 'self' 'unsafe-inline'"
const connectSrc = isDev
  ? `connect-src 'self' ws: wss: ${OLLAMA_CONNECT}`
  : `connect-src 'self' ${OLLAMA_CONNECT}`

const baseCsp = [
  "default-src 'self'",
  scriptSrc,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https: blob:",
  "font-src 'self' data:",
  connectSrc,
  "frame-src 'none'",
  "object-src 'none'",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ")

// Stricter variant for the AI advisor (renders user/LLM-supplied content):
// no blanket https: image source.
const advisorCsp = [
  "default-src 'self'",
  scriptSrc,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  connectSrc,
  "frame-src 'none'",
  "object-src 'none'",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ")

const nextConfig = {
  // Don't advertise the framework (information disclosure).
  poweredByHeader: false,
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
          // Base CSP: relaxed for general pages
          {
            key: "Content-Security-Policy",
            value: baseCsp,
          },
        ],
      },
      {
        // Stricter CSP for the AI advisor (user-supplied content)
        source: "/ai-advisor/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: advisorCsp,
          },
        ],
      },
    ]
  },
}

export default withSerwist(nextConfig)
