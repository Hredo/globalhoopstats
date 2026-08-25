import { describe, it, expect } from "vitest"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join, relative, sep } from "node:path"

/**
 * Every screen with an AI analysis button has to go through the same pipeline.
 *
 * The requirement, in the owner's words: whatever model is selected, the
 * answer has to be expert, readable, and free of invented figures — and that
 * has to hold on EVERY view with an AI button, not on the three we happened to
 * look at. Guarding it by hand does not scale; a new route added next month
 * would quietly ship raw model output the way trade and playbook used to.
 *
 * So the rule is structural: a route may not call `chatComplete` directly.
 * It goes through `generateGroundedAnswer`, which owns the verification and
 * the retry.
 */
const API_ROOT = join(process.cwd(), "src", "app", "api")

/**
 * Callers that legitimately talk to a model without producing prose for a
 * human to read. Each one is listed with the reason it is exempt.
 */
const EXEMPT: Record<string, string> = {
  // Reads a play out of a photo and returns JSON, not prose. The grounding and
  // heading guards make no sense on a parsed document.
  "playbooks/photo-import/route.ts": "returns structured JSON, not prose",
  // Pings the provider to check a key works. The reply is thrown away.
  "account/api-keys/test/route.ts": "connectivity check, output discarded",
}

function routeFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...routeFiles(full))
    else if (entry === "route.ts") out.push(full)
  }
  return out
}

function key(file: string): string {
  return relative(API_ROOT, file).split(sep).join("/")
}

describe("every AI surface goes through the verified pipeline", () => {
  const files = routeFiles(API_ROOT)

  it("finds the API routes at all", () => {
    // A wrong path here would make every assertion below vacuously pass.
    expect(files.length).toBeGreaterThan(5)
  })

  for (const file of files) {
    const rel = key(file)
    const src = readFileSync(file, "utf8")
    if (!src.includes("@/lib/ai/chat")) continue

    it(`${rel} does not call the model directly`, () => {
      if (EXEMPT[rel]) {
        expect(EXEMPT[rel], `${rel} is exempt`).toBeTruthy()
        return
      }
      expect(
        src.includes("chatComplete"),
        `${rel} calls chatComplete directly — route it through generateGroundedAnswer, or add it to EXEMPT with a reason`,
      ).toBe(false)
    })
  }

  it("routes every prose surface through generateGroundedAnswer", () => {
    // Named explicitly rather than inferred: if one of these stops using the
    // pipeline, the failure should say which screen went unguarded.
    const SURFACES = [
      "compare/ai/route.ts",
      "market/trade/ai/route.ts",
      "playbooks/ai/route.ts",
      "players/ai/route.ts",
    ]
    for (const rel of SURFACES) {
      const src = readFileSync(join(API_ROOT, ...rel.split("/")), "utf8")
      expect(
        src.includes("generateGroundedAnswer"),
        `${rel} is not using the verified pipeline`,
      ).toBe(true)
    }
    // The advisor reaches it through its own prompt builder.
    const llm = readFileSync(
      join(process.cwd(), "src", "lib", "ai", "llm.ts"),
      "utf8",
    )
    expect(llm).toContain("generateGroundedAnswer")
    expect(llm).not.toContain("chatComplete(")
  })
})

describe("the pipeline verifies before it returns", () => {
  const src = readFileSync(
    join(process.cwd(), "src", "lib", "ai", "answer.ts"),
    "utf8",
  )

  it("applies every guard we have", () => {
    for (const guard of [
      "isMostlyHeadings",
      "isUsableAnswer",
      "echoesInstructions",
      "mentionsAnySubject",
      "inventsFigures",
      "trimDegeneratedOutput",
    ]) {
      expect(src, `answer.ts does not apply ${guard}`).toContain(guard)
    }
  })

  it("retries a rejected answer once before giving up", () => {
    expect(src).toContain("correction(")
    expect(src).toContain("retried: true")
  })

  it("sanitises what it returns", () => {
    expect(src).toContain("cleanLlmOutput")
  })
})
