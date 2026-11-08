import { buildLlmsFullTxt } from "@/lib/seo/llms"
import { loadLlmsLeagues, loadLlmsScorers } from "@/lib/seo/llms-data"

export const revalidate = 3600

/** GET /llms-full.txt — llms.txt plus each league's top 25 scorers. */
export async function GET() {
  const leagues = await loadLlmsLeagues()
  const scorers = await loadLlmsScorers(leagues, 25)
  return new Response(buildLlmsFullTxt(leagues, scorers), {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  })
}
