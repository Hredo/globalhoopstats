import { NextResponse } from "next/server"
import { z } from "zod"
import { getCurrentUser } from "@/lib/auth/current-user"
import { getProvider, resolveModel } from "@/lib/ai/providers"
import { getDecryptedKey } from "@/lib/ai/user-provider"
import { isAuthFailure, listProviderModels } from "@/lib/ai/models"
import { pickBestModel } from "@/lib/ai/model-ranking"
import { chatComplete, REASONING_ONLY_ERROR } from "@/lib/ai/chat"
import { describeProviderError } from "@/lib/ai/answer"
import { getLocale } from "@/lib/i18n/server"
import {
  clientIp,
  readRateLimit,
  redactSecrets,
} from "@/lib/security/ai-advisor"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const schema = z.object({
  provider: z.string().trim().min(1).max(40),
  key: z.string().trim().min(8).max(400).optional(),
  model: z.string().trim().max(120).optional(),
})

/** Enough room for a reasoning model to think briefly and still say "OK". */
const PING_MAX_TOKENS = 256
const PING_TIMEOUT_MS = 30_000

/**
 * "Does this key work?", answered in two steps.
 *
 * 1. List the provider's models. Free, proves the key authenticates, and
 *    tells us which models this account can actually use.
 * 2. Ask one of THOSE models to say OK. This used to ping the catalogue's
 *    hand-written default, so a perfectly good key "failed" whenever that
 *    literal had been retired upstream.
 *
 * Errors come back readable and redacted: vendors echo the offending key in
 * their 401 bodies, and this route used to hand that body straight to the UI.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser(request.headers.get("cookie"))
  if (!user) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    )
  }
  const limited = readRateLimit(clientIp(request), "account:test-key", 10, 0.2)
  if (!limited.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many tests. Wait a few seconds." },
      {
        status: 429,
        headers: { "Retry-After": String(limited.retryAfterSec) },
      },
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON." },
      { status: 400 },
    )
  }
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid test request." },
      { status: 400 },
    )
  }
  const provider = getProvider(parsed.data.provider)
  if (!provider) {
    return NextResponse.json(
      { ok: false, error: "Unknown provider." },
      { status: 400 },
    )
  }

  // Prefer a freshly typed key (before saving); otherwise use the stored one.
  let apiKey: string | null = parsed.data.key ?? null
  if (provider.needsKey && !apiKey) {
    apiKey = await getDecryptedKey(user.id, provider.id)
    if (!apiKey) {
      return NextResponse.json(
        { ok: false, error: "No key saved for this provider yet." },
        { status: 400 },
      )
    }
  }

  const locale = await getLocale()
  const started = Date.now()

  const listed = await listProviderModels(provider, apiKey)
  if (!listed.ok && isAuthFailure(listed.status, listed.error)) {
    return NextResponse.json({
      ok: false,
      stage: "auth",
      error: describeProviderError(`401 ${listed.error}`, locale),
      detail: redactSecrets(listed.error),
    })
  }

  // A model listing that failed for any other reason (Perplexity serves no
  // /models at all) does not condemn the key: the ping below decides.
  const requested = parsed.data.model?.trim()
  const model = requested
    ? resolveModel(provider, requested)
    : ((listed.ok ? pickBestModel(listed.models) : null) ??
      provider.defaultModel)
  const modelCount = listed.ok ? listed.models.length : null

  const result = await chatComplete({
    provider,
    model,
    apiKey,
    system: "You are a connectivity check. Answer with a single short word.",
    messages: [{ role: "user", content: "Reply with: OK" }],
    maxTokens: PING_MAX_TOKENS,
    temperature: 0,
    timeoutMs: PING_TIMEOUT_MS,
  })
  const latencyMs = Date.now() - started

  // The vendor answered 200 and only the visible text is missing: the key and
  // the model both work, the model just spent the tiny budget thinking.
  const answeredSilently =
    !result.ok &&
    (result.error === REASONING_ONLY_ERROR ||
      result.error === "Empty response.")

  if (result.ok || answeredSilently) {
    return NextResponse.json({ ok: true, model, modelCount, latencyMs })
  }
  return NextResponse.json({
    ok: false,
    stage: "chat",
    model,
    modelCount,
    // The key authenticated; it is the model (or the account's credit) that
    // refused. Saying so stops people regenerating a key that was fine.
    keyValid: listed.ok,
    error: describeProviderError(result.error, locale),
    detail: redactSecrets(result.error),
  })
}
