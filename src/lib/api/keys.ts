/**
 * Keys for the public read API (/api/v1).
 *
 * Format `ghs_<43 base64url chars>` (32 random bytes). Only a scrypt digest
 * of the key, salted with a server secret, is stored: a database leak alone can
 * neither reveal nor verify a key (rotating ENCRYPTION_KEY revokes them all).
 * The salt is fixed per server on purpose — lookups are by digest — and that is
 * safe here because every key is 256 bits of randomness, never a human choice.
 * The first 12 characters are kept in clear to tell keys apart in the admin
 * panel. Each key has a daily request quota enforced on the shared MySQL
 * limiter, so it holds across processes and restarts.
 */
import { randomBytes, scrypt } from "node:crypto"
import { promisify } from "node:util"
import { and, eq, isNull } from "drizzle-orm"
import { NextResponse } from "next/server"
import { getDb } from "@/lib/db/client"
import { apiClients, type ApiClient } from "@/lib/db/schema"
import { consumeRateLimit } from "@/lib/security/rate-limit"
import { getServerEnv } from "@/lib/env"

const KEY = /^ghs_[A-Za-z0-9_-]{43}$/

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: string,
  keylen: number,
  options: { N: number; r: number; p: number },
) => Promise<Buffer>

/** scrypt cost: ~16 MiB and a few ms per call, off the event loop. */
const SCRYPT = { N: 2 ** 14, r: 8, p: 1 }

export async function generateApiKey(): Promise<{ key: string; prefix: string; hash: string }> {
  const key = `ghs_${randomBytes(32).toString("base64url")}`
  return { key, prefix: key.slice(0, 12), hash: await hashApiKey(key) }
}

export async function hashApiKey(key: string): Promise<string> {
  const env = getServerEnv()
  const secret = env.ENCRYPTION_KEY ?? env.SESSION_SECRET
  const digest = await scryptAsync(key, `ghs-api-key:${secret}`, 32, SCRYPT)
  return digest.toString("hex")
}

export function readApiKey(headers: Headers): string | null {
  const auth = headers.get("authorization") ?? ""
  const bearer = auth.match(/^Bearer\s+(\S+)$/i)?.[1]
  const key = bearer ?? headers.get("x-api-key")?.trim() ?? null
  return key && KEY.test(key) ? key : null
}

function apiError(status: number, error: string, extra: Record<string, string> = {}) {
  return NextResponse.json({ error }, { status, headers: { ...API_HEADERS, ...extra } })
}

export const API_HEADERS: Record<string, string> = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
}

export type ApiAuth = { client: ApiClient; remaining: number } | { response: NextResponse }

export async function authenticateApi(request: Request): Promise<ApiAuth> {
  const key = readApiKey(request.headers)
  if (!key) return { response: apiError(401, "Missing or malformed API key. Send Authorization: Bearer ghs_…") }
  const db = getDb()
  const client = (
    await db
      .select()
      .from(apiClients)
      .where(and(eq(apiClients.keyHash, await hashApiKey(key)), isNull(apiClients.revokedAt)))
      .limit(1)
  )[0]
  if (!client) return { response: apiError(401, "Invalid or revoked API key.") }

  const day = new Date().toISOString().slice(0, 10)
  const quota = await consumeRateLimit(`api:${client.id}:${day}`, client.dailyQuota, 86_400_000)
  if (!quota.ok) {
    return {
      response: apiError(429, "Daily quota exceeded.", { "Retry-After": String(quota.retryAfterSec) }),
    }
  }
  // At most one write per key per minute for the "last used" column.
  if (!client.lastUsedAt || Date.now() - client.lastUsedAt.getTime() > 60_000) {
    void db
      .update(apiClients)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiClients.id, client.id))
      .catch(() => {})
  }
  return { client, remaining: quota.remaining }
}

export function apiJson(data: unknown, remaining: number, meta: Record<string, unknown> = {}) {
  return NextResponse.json(
    {
      data,
      meta: {
        ...meta,
        source: "globalhoopstats.es",
        attribution: "Data compiled by globalhoopstats.es — attribution required.",
      },
    },
    { headers: { ...API_HEADERS, "X-RateLimit-Remaining": String(remaining) } },
  )
}
