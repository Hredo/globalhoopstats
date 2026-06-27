import { sql } from "drizzle-orm"
import { getDb } from "@/lib/db/client"

type ConfigValue = Record<string, unknown>

let configCache: Record<string, ConfigValue> | null = null

export async function getConfig(): Promise<Record<string, ConfigValue>> {
  if (configCache) return configCache
  const db = getDb()
  const rows = await db.execute(sql.raw(`SELECT key, value FROM app_config`))
  const result: Record<string, ConfigValue> = {}
  for (const row of rows as unknown as { key: string; value: string }[]) {
    try {
      result[row.key] = JSON.parse(row.value)
    } catch {
      result[row.key] = { _raw: row.value }
    }
  }
  configCache = result
  return result
}

export function invalidateConfigCache() {
  configCache = null
}

export async function isFeatureEnabled(key: string): Promise<boolean> {
  const config = await getConfig()
  const flags = config.feature_flags as Record<string, boolean> | undefined
  return flags?.[key] !== false
}

export async function getValuationThresholds(): Promise<Record<string, number>> {
  const config = await getConfig()
  const defaults = { franchise: 78, starter: 60, rotation: 42, role: 25 }
  const overrides = config.valuation_thresholds as Record<string, number> | undefined
  return overrides ? { ...defaults, ...overrides } : defaults
}

export async function getLeagueStrengthOverrides(): Promise<Record<string, number>> {
  const config = await getConfig()
  return (config.league_strength_overrides as Record<string, number>) ?? {}
}
