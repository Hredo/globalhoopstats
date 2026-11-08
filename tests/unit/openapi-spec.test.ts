import { describe, it, expect } from "vitest"
import { readdirSync, statSync } from "node:fs"
import { join, relative, sep } from "node:path"
import { buildOpenApiSpec } from "@/lib/api/openapi"
import { SOURCE_IDS } from "@/lib/sources"

const V1 = join(process.cwd(), "src", "app", "api", "v1")

/** Every route.ts under src/app/api/v1 as an OpenAPI path ("[slug]" → "{slug}"). */
function routePaths(dir = V1): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) return routePaths(full)
    if (name !== "route.ts") return []
    const rel = relative(V1, dir).split(sep).filter(Boolean)
    return [["/api/v1", ...rel].join("/").replace(/\[([^\]]+)\]/g, "{$1}")]
  })
}

describe("OpenAPI description of /api/v1", () => {
  const spec = buildOpenApiSpec()

  // Hand-written spec: this is what stops a new endpoint shipping undocumented,
  // or a removed one lingering in the description agents read.
  it("documents exactly the routes that exist", () => {
    expect(Object.keys(spec.paths).sort()).toEqual(routePaths().sort())
  })

  it("is OpenAPI 3.1 with both ways of sending a key", () => {
    expect(spec.openapi).toBe("3.1.0")
    expect(spec.components.securitySchemes.bearer.scheme).toBe("bearer")
    expect(spec.components.securitySchemes.apiKey.name).toBe("X-API-Key")
  })

  it("offers every league the API accepts", () => {
    const league = spec.paths["/api/v1/players"].get.parameters.find(
      (p) => p.name === "league",
    )
    expect(league?.schema).toMatchObject({ enum: [...SOURCE_IDS] })
  })

  it("resolves every $ref it uses", () => {
    const refs = JSON.stringify(spec).match(/"#\/components\/[^"]+"/g) ?? []
    for (const ref of refs) {
      const path = ref.slice(3, -1).split("/")
      let node: unknown = spec
      for (const key of path) node = (node as Record<string, unknown>)[key]
      expect(node, ref).toBeDefined()
    }
  })
})
