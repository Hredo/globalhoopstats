/**
 * Pure translation helper used by both the server (`getT`) and the client
 * (`useT`). Looks up a dot-path inside a dictionary and interpolates `{var}`
 * placeholders. Falls back to the key itself when a path is missing so a
 * forgotten string is obvious in the UI instead of crashing.
 */

export type TranslationVars = Record<string, string | number>

export function translate(
  dict: unknown,
  path: string,
  vars?: TranslationVars,
): string {
  let current: unknown = dict
  for (const segment of path.split(".")) {
    if (
      current &&
      typeof current === "object" &&
      segment in (current as Record<string, unknown>)
    ) {
      current = (current as Record<string, unknown>)[segment]
    } else {
      return path
    }
  }
  if (typeof current !== "string") return path
  if (!vars) return current
  return current.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in vars ? String(vars[key]) : match,
  )
}
