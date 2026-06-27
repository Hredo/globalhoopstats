import { setStrengthOverrides } from "@/lib/market/league-strength"
import { getLeagueStrengthOverrides } from "@/lib/admin/config"

let initialized = false

export async function ensureOverridesLoaded() {
  if (initialized) return
  initialized = true
  try {
    const overrides = await getLeagueStrengthOverrides()
    if (Object.keys(overrides).length > 0) {
      setStrengthOverrides(overrides)
    }
  } catch {
    // DB not available, keep defaults
  }
}
