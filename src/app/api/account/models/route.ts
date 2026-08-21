import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth/current-user"
import { getProvider } from "@/lib/ai/providers"
import { getDecryptedKey } from "@/lib/ai/user-provider"
import { listProviderModels } from "@/lib/ai/models"
import {
  clientIp,
  readRateLimit,
  redactSecrets,
} from "@/lib/security/ai-advisor"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Live model list for a provider, using the caller's own stored key.
 *
 * The engine picker calls this so the user chooses from models the provider
 * will actually serve, instead of a hand-written catalogue that goes stale and
 * 404s at answer time.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser(request.headers.get("cookie"))
  if (!user) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    )
  }

  // Cheap upstream call, but it is still an outbound request per hit.
  const limited = readRateLimit(clientIp(request), "account:models", 30, 1)
  if (!limited.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many requests. Wait a few seconds." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    )
  }

  const providerId = new URL(request.url).searchParams.get("provider")
  const provider = getProvider(providerId)
  if (!provider) {
    return NextResponse.json(
      { ok: false, error: "Unknown provider." },
      { status: 400 },
    )
  }

  let apiKey: string | null = null
  if (provider.needsKey) {
    apiKey = await getDecryptedKey(user.id, provider.id)
    if (!apiKey) {
      return NextResponse.json({
        ok: false,
        error: "No key saved for this provider yet.",
        reason: "no_key",
      })
    }
  }

  const result = await listProviderModels(provider, apiKey)
  if (!result.ok) {
    // Vendors echo the offending credential back in 401 bodies.
    return NextResponse.json({
      ok: false,
      error: redactSecrets(result.error),
      status: result.status,
    })
  }
  return NextResponse.json({ ok: true, models: result.models })
}
