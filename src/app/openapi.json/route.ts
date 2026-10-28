import { buildOpenApiSpec } from "@/lib/api/openapi"

// No data in it: built once at deploy time.
export const dynamic = "force-static"

/**
 * GET /openapi.json — the description of /api/v1. Outside /api/ on purpose:
 * robots.txt keeps crawlers out of /api/, and this is the one document about it
 * we want agents to find. Readable cross-origin so a docs viewer or client
 * generator on another site can load it.
 */
export function GET() {
  return Response.json(buildOpenApiSpec(), {
    headers: {
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
      "Access-Control-Allow-Origin": "*",
      // Cross-Origin-Resource-Policy is set in next.config.mjs: the global
      // `same-origin` there overrides anything set here.
    },
  })
}
