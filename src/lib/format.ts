export function formatStat(
  n: number | null | undefined,
  digits = 1,
  suffix = "",
): string {
  if (n == null || Number.isNaN(n)) return "—"
  return `${n.toFixed(digits)}${suffix}`
}

export function formatPct(n: number | null | undefined, digits = 1): string {
  if (n == null || Number.isNaN(n)) return "—"
  return `${(n * 100).toFixed(digits)}%`
}

export function formatInt(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—"
  return Math.round(n).toLocaleString("en-US")
}

export function formatHeight(cm: number | null | undefined): string {
  if (cm == null || Number.isNaN(cm)) return "—"
  const totalIn = cm / 2.54
  const ft = Math.floor(totalIn / 12)
  const inches = Math.round(totalIn - ft * 12)
  return `${ft}'${inches}"`
}

export function formatWeight(kg: number | null | undefined): string {
  if (kg == null || Number.isNaN(kg)) return "—"
  return `${kg} kg`
}

export function ageFrom(bd: string | null | undefined): number | null {
  if (!bd) return null
  const d = new Date(bd)
  if (Number.isNaN(d.getTime())) return null
  return Math.floor((Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000))
}

export function getInitials(name: string, max = 2): string {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, max)
    .join("")
    .toUpperCase()
}

// Connectors that stay lowercase inside a club name ("Bàsquet de Menorca").
const NAME_CONNECTORS = new Set(["de", "del", "la", "las", "el", "els", "los", "les", "y", "i", "e"])
// Short tokens that are words, not initials ("San Fernando", "Son Servera").
const SHORT_WORDS = new Set(["san", "son", "sur", "mar", "rio", "río", "oro", "sol", "can", "ca"])

/**
 * Display casing for a club name.
 *
 * The FEB feeds publish team names in capitals ("BIELE ISB") while every other
 * league ships mixed case, so a list mixing them reads as shouting. Only an
 * all-caps name is rewritten; tokens of up to three letters ("CB", "ISB") are
 * kept as written, since they are almost always initials.
 */
export function displayTeamName(name: string): string {
  const trimmed = name.trim()
  if (!/\p{L}/u.test(trimmed) || trimmed !== trimmed.toUpperCase()) return trimmed
  return trimmed
    .split(/(\s+)/)
    .map((word, i) => {
      if (/^\s+$/.test(word)) return word
      const letters = word.replace(/[^\p{L}]/gu, "")
      const lower = word.toLowerCase()
      if (i > 0 && NAME_CONNECTORS.has(lower)) return lower
      if (letters.length <= 3 && !SHORT_WORDS.has(lower)) return word
      return lower.replace(/(^|[-'’.])(\p{L})/gu, (_, sep, ch) => sep + ch.toUpperCase())
    })
    .join("")
}
