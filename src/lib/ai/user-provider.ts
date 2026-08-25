/**
 * Server-side resolution of "which AI engine does THIS user want for THIS
 * feature", plus small read helpers over user_settings / user_api_keys.
 *
 * The advisor/compare routes call resolveEngine() to decide whether they can
 * run an LLM (and with which key) or must tell the user to configure one.
 */
import { and, eq } from "drizzle-orm"
import { getDb } from "@/lib/db/client"
import { userApiKeys, userSettings } from "@/lib/db/schema"
import {
  getProvider,
  resolveModel,
  type AiFeature,
  type AiProvider,
} from "@/lib/ai/providers"
import { resolveBestModel } from "@/lib/ai/models"
import { decryptSecret } from "@/lib/security/secrets"

export type UserSettingsView = {
  advisorProvider: string | null
  advisorModel: string | null
  compareProvider: string | null
  compareModel: string | null
  locale: string
  emailProduct: boolean
  emailUsage: boolean
  reduceMotion: boolean
  currency: string
}

export const DEFAULT_SETTINGS: UserSettingsView = {
  advisorProvider: null,
  advisorModel: null,
  compareProvider: null,
  compareModel: null,
  locale: "en",
  emailProduct: true,
  emailUsage: false,
  reduceMotion: false,
  currency: "EUR",
}

export async function getUserSettings(
  userId: string,
): Promise<UserSettingsView> {
  const db = getDb()
  const rows = await db
    .select()
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1)
  const row = rows[0]
  if (!row) return { ...DEFAULT_SETTINGS }
  return {
    advisorProvider: row.advisorProvider,
    advisorModel: row.advisorModel,
    compareProvider: row.compareProvider,
    compareModel: row.compareModel,
    locale: row.locale,
    emailProduct: row.emailProduct,
    emailUsage: row.emailUsage,
    reduceMotion: row.reduceMotion,
    currency: row.currency,
  }
}

export type KeyStatus = {
  provider: string
  last4: string
  label: string | null
  updatedAt: string
}

export async function listKeyStatuses(userId: string): Promise<KeyStatus[]> {
  const db = getDb()
  const rows = await db
    .select({
      provider: userApiKeys.provider,
      last4: userApiKeys.last4,
      label: userApiKeys.label,
      updatedAt: userApiKeys.updatedAt,
    })
    .from(userApiKeys)
    .where(eq(userApiKeys.userId, userId))
  return rows.map((r) => ({
    provider: r.provider,
    last4: r.last4,
    label: r.label,
    updatedAt: r.updatedAt.toISOString(),
  }))
}

export async function getDecryptedKey(
  userId: string,
  providerId: string,
): Promise<string | null> {
  const db = getDb()
  const rows = await db
    .select({ encryptedKey: userApiKeys.encryptedKey })
    .from(userApiKeys)
    .where(
      and(eq(userApiKeys.userId, userId), eq(userApiKeys.provider, providerId)),
    )
    .limit(1)
  const row = rows[0]
  if (!row) return null
  return decryptSecret(row.encryptedKey)
}

export type ResolvedEngine =
  | {
      ok: true
      provider: AiProvider
      model: string
      apiKey: string | null
    }
  | {
      ok: false
      reason: "not_selected" | "unknown_provider" | "no_key" | "decrypt_failed"
      providerId?: string
    }

/**
 * Try to resolve a default AI engine from environment variables. Used when the
 * user hasn't configured their own provider (anonymous users or accounts with
 * no AI key set).
 *
 * Env vars:
 *   AI_DEFAULT_PROVIDER  — provider id from providers.ts (e.g. "openai", "groq")
 *   AI_DEFAULT_MODEL     — model id (optional, falls back to provider default)
 *   AI_DEFAULT_API_KEY   — API key for the provider (required if needsKey)
 */
/**
 * Which model to actually send.
 *
 * A pinned choice is the user's and is respected as-is. With nothing pinned we
 * ask the provider what it serves today and take the newest capable one, so a
 * vendor shipping a new flagship reaches every user without a code change —
 * and a retired id never reaches the API as a 404 `model_not_found`, which is
 * the failure that twice looked like "the AI stopped working".
 */
async function pickModel(
  provider: AiProvider,
  pinned: string | null,
  apiKey: string | null,
): Promise<string> {
  if (pinned?.trim()) return resolveModel(provider, pinned)
  return resolveBestModel(provider, apiKey)
}

export async function resolveDefaultEngine(): Promise<ResolvedEngine> {
  const providerId = process.env.AI_DEFAULT_PROVIDER
  if (!providerId) return { ok: false, reason: "not_selected" }
  const provider = getProvider(providerId)
  if (!provider) return { ok: false, reason: "unknown_provider", providerId }
  const pinned = process.env.AI_DEFAULT_MODEL ?? null
  if (!provider.needsKey) {
    return {
      ok: true,
      provider,
      model: await pickModel(provider, pinned, null),
      apiKey: null,
    }
  }
  const apiKey = process.env.AI_DEFAULT_API_KEY
  if (!apiKey) return { ok: false, reason: "no_key", providerId }
  return {
    ok: true,
    provider,
    model: await pickModel(provider, pinned, apiKey),
    apiKey,
  }
}

export async function resolveEngine(
  userId: string,
  feature: AiFeature,
): Promise<ResolvedEngine> {
  const settings = await getUserSettings(userId)
  const providerId =
    feature === "advisor" ? settings.advisorProvider : settings.compareProvider
  const modelPref =
    feature === "advisor" ? settings.advisorModel : settings.compareModel

  if (!providerId) return resolveDefaultEngine()
  const provider = getProvider(providerId)
  if (!provider) return resolveDefaultEngine()

  if (!provider.needsKey) {
    return {
      ok: true,
      provider,
      model: await pickModel(provider, modelPref, null),
      apiKey: null,
    }
  }

  const apiKey = await getDecryptedKey(userId, providerId)
  if (!apiKey) {
    // Distinguish "no key saved for THIS provider" from "a key is saved but no
    // longer decrypts" (ENCRYPTION_KEY rotated). The check has to be scoped to
    // the selected provider: keyed on the user alone, anyone who had ever saved
    // any key got told "decrypt_failed" for a provider they simply never set up.
    const db = getDb()
    const exists = await db
      .select({ id: userApiKeys.id })
      .from(userApiKeys)
      .where(
        and(eq(userApiKeys.userId, userId), eq(userApiKeys.provider, providerId)),
      )
      .limit(1)
    if (exists.length === 0) {
      // Nothing saved for this provider — fall back to the default engine.
      return resolveDefaultEngine()
    }
    return { ok: false, reason: "decrypt_failed", providerId }
  }
  return {
    ok: true,
    provider,
    model: await pickModel(provider, modelPref, apiKey),
    apiKey,
  }
}
