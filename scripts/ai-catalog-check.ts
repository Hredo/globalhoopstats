/**
 * Keep the AI provider catalogue current: `pnpm ai:catalog`.
 *
 * `src/lib/ai/providers.ts` is the one hand-written part of the AI setup —
 * it decides where keys may be sent, so it changes only by review. This diffs
 * it against the public models.dev catalogue and reports:
 *
 *   - a provider whose base URL moved (Nebius did, and keys silently 404'd);
 *   - a fallback or default model the vendor retired or never served;
 *   - providers on models.dev we do not offer yet, newest first;
 *   - key / docs / pricing links that no longer answer.
 *
 * Exits 1 on a moved URL, a dead fallback model or a broken link, so it can
 * run in CI. Read-only: it never touches the database or the catalogue.
 */
import { AI_PROVIDERS, catalogIdFor } from "../src/lib/ai/providers"
import { MODELS_DEV_URL } from "../src/lib/ai/catalog-live"

type RawModel = { status?: string; release_date?: string }
type RawProvider = {
  name?: string
  api?: string
  models?: Record<string, RawModel>
}

const norm = (url: string) => url.trim().replace(/\/+$/, "")

/**
 * Differences from models.dev that were checked by hand and are deliberate.
 * Each one needs a reason; delete it when it stops being true.
 */
const KNOWN_DIFFERENCES: Record<string, string> = {
  // DeepSeek serves the OpenAI-compatible API both with and without /v1.
  "deepseek:baseUrl": "both paths are documented by DeepSeek",
  // models.dev flags Sonar as deprecated in favour of Perplexity's Agent API,
  // but docs.perplexity.ai still lists the Sonar models (checked 2026-10-28).
  "perplexity:sonar-pro": "still documented by Perplexity",
  "perplexity:sonar-reasoning-pro": "still documented by Perplexity",
  "perplexity:sonar": "still documented by Perplexity",
}

async function checkLink(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      // A console that bounces a logged-out visitor to its login page is a
      // live link; following the bounce only tests the login flow.
      redirect: "manual",
      signal: AbortSignal.timeout(20_000),
      headers: { "User-Agent": "globalhoopstats-catalog-check" },
    })
    // Consoles answer 401/403 to a logged-out request; the page still exists.
    if (res.status < 400 || res.status === 401 || res.status === 403)
      return null
    return `HTTP ${res.status}`
  } catch (err) {
    return err instanceof Error ? err.message : String(err)
  }
}

async function main() {
  console.log(`Fetching ${MODELS_DEV_URL} …`)
  const res = await fetch(MODELS_DEV_URL, {
    signal: AbortSignal.timeout(180_000),
  })
  if (!res.ok) throw new Error(`models.dev ${res.status}`)
  const doc = (await res.json()) as Record<string, RawProvider>
  const problems: string[] = []
  const flag = (key: string, msg: string) => {
    const known = KNOWN_DIFFERENCES[key]
    if (known) console.log(`  ~ ${msg} (known: ${known})`)
    else problems.push(msg)
  }

  console.log("\n== Base URLs and fallback models ==")
  for (const p of AI_PROVIDERS) {
    if (p.kind === "local") continue
    const entry = doc[catalogIdFor(p)]
    if (!entry) {
      console.log(`  ? ${p.id}: not on models.dev (cannot verify)`)
      continue
    }
    if (
      entry.api &&
      !entry.api.includes("${") &&
      norm(entry.api) !== norm(p.baseUrl)
    ) {
      flag(
        `${p.id}:baseUrl`,
        `${p.id}: base URL is ${p.baseUrl}, models.dev says ${entry.api}`,
      )
    }
    const known = entry.models ?? {}
    const ids = new Set([p.defaultModel, ...p.models.map((m) => m.id)])
    for (const id of ids) {
      const m = known[id]
      if (!m) {
        // models.dev does not mirror every vendor's full list; only the hand-
        // written lists here are held to it.
        const msg = `${p.id}: model "${id}" is not on models.dev`
        if (p.models.length > 0) problems.push(msg)
        else console.log(`  ? ${msg}`)
      } else if (m.status === "deprecated") {
        flag(`${p.id}:${id}`, `${p.id}: model "${id}" is deprecated upstream`)
      }
    }
  }

  console.log("\n== Providers on models.dev we do not offer (newest first) ==")
  const ours = new Set(AI_PROVIDERS.map(catalogIdFor))
  const candidates = Object.entries(doc)
    .filter(
      ([id, p]) =>
        !ours.has(id) && p.api?.startsWith("https://") && !p.api.includes("${"),
    )
    .map(([id, p]) => {
      const models = Object.values(p.models ?? {}).filter(
        (m) => m.status !== "deprecated",
      )
      const newest =
        models
          .map((m) => m.release_date ?? "")
          .sort()
          .at(-1) ?? ""
      return { id, api: p.api!, count: models.length, newest }
    })
    .filter((c) => c.count >= 5)
    .sort((a, b) => b.newest.localeCompare(a.newest))
    .slice(0, 15)
  for (const c of candidates) {
    console.log(
      `  ${c.newest.padEnd(10)}  ${c.id.padEnd(22)} ${String(c.count).padStart(4)} models  ${c.api}`,
    )
  }

  console.log("\n== Links ==")
  const links = AI_PROVIDERS.flatMap((p) =>
    [p.keyUrl, p.docsUrl, p.pricingUrl]
      .filter((u): u is string => Boolean(u))
      .map((url) => ({ provider: p.id, url })),
  )
  for (const { provider, url } of links) {
    const err = await checkLink(url)
    if (err) problems.push(`${provider}: ${url} → ${err}`)
  }
  console.log(`  ${links.length} links checked`)

  if (problems.length === 0) {
    console.log("\nCatalogue is current.")
    return
  }
  console.log(`\n${problems.length} problem(s):`)
  for (const p of problems) console.log(`  ✗ ${p}`)
  process.exitCode = 1
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
