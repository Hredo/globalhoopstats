import { buildLlmsTxt } from "@/lib/seo/llms"
import { loadLlmsLeagues } from "@/lib/seo/llms-data"

// Regenerated hourly from cached league data; the leagues change once a sync lands.
export const revalidate = 3600

/** GET /llms.txt — the site map for language models (https://llmstxt.org). */
export async function GET() {
  const leagues = await loadLlmsLeagues()
  return new Response(buildLlmsTxt(leagues), {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  })
}
