/*
 * Fast end-to-end-ish check of the multi-group fix: enumerate every "Liga
 * Regular" group, postback to each, and accumulate rosters. Roster-only (skips
 * the slow per-category/Equipo passes), short delay — just proves the group
 * loop unions teams+players across groups.
 *   pnpm exec tsx scripts/_feb-validate.ts segundafeb 2
 *   pnpm exec tsx scripts/_feb-validate.ts tercerafeb 3
 */
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
const BASE = "https://baloncestoenvivo.feb.es"
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const decode = (s: string) =>
  s.replace(/&amp;/g, "&").replace(/&aacute;/g, "á").replace(/&eacute;/g, "é")
   .replace(/&iacute;/g, "í").replace(/&oacute;/g, "ó").replace(/&uacute;/g, "ú")
   .replace(/&ntilde;/g, "ñ").replace(/&Ntilde;/g, "Ñ").replace(/&uuml;/g, "ü")
   .replace(/&nbsp;/g, " ").replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))

type Select = { name: string; options: Array<{ value: string; text: string; selected: boolean }> }

function parseHiddens(html: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const tag of html.match(/<input[^>]*type="hidden"[^>]*>/gi) ?? []) {
    const name = tag.match(/name="([^"]+)"/)?.[1]
    if (name) out[name] = decode(tag.match(/value="([^"]*)"/)?.[1] ?? "")
  }
  return out
}
function parseSelects(html: string): Select[] {
  const out: Select[] = []
  const re = /<select[^>]*\bname="([^"]+)"[^>]*>([\s\S]*?)<\/select>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    const options: Select["options"] = []
    const ore = /<option([^>]*)>([\s\S]*?)<\/option>/gi
    let om: RegExpExecArray | null
    while ((om = ore.exec(m[2]!)) !== null)
      options.push({ value: om[1]!.match(/value="([^"]*)"/)?.[1] ?? "", text: decode(om[2]!.replace(/<[^>]+>/g, "").trim()), selected: /\bselected\b/i.test(om[1]!) })
    out.push({ name: m[1]!, options })
  }
  return out
}
function body(h: Record<string, string>, s: Select[], target: string, ov: Record<string, string>): string {
  const b = new URLSearchParams()
  for (const [k, v] of Object.entries(h)) b.set(k, v)
  for (const sel of s) b.set(sel.name, (sel.options.find((o) => o.selected) ?? sel.options[0])?.value ?? "")
  for (const [k, v] of Object.entries(ov)) b.set(k, v)
  b.set("__EVENTTARGET", target); b.set("__EVENTARGUMENT", "")
  return b.toString()
}
async function fetchText(url: string, init?: { method?: string; body?: string }) {
  const res = await fetch(url, {
    method: init?.method ?? "GET", body: init?.body,
    headers: { "User-Agent": UA, Accept: "text/html", "Accept-Language": "es-ES,es;q=0.9", ...(init?.body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}) },
  })
  if (!res.ok) throw new Error(`${res.status}`)
  return res.text()
}
const isTeam = (v: string) => /^\d+$/.test(v) && Number(v) > 100000
function countRosterPlayers(html: string): string[] {
  const ids: string[] = []
  for (const rm of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const m = rm[1]!.match(/class="nombre jugador"[\s\S]*?Jugador\.aspx\?i=\d+&(?:amp;)?c=(\d+)[^>]*>\s*([^<]+?)\s*<\/a>/i)
    if (m) ids.push(m[1]!)
  }
  return ids
}

async function main() {
  const nm = process.argv[2] ?? "segundafeb"
  const g = process.argv[3] ?? "2"
  const url = `${BASE}/rankings.aspx?g=${g}&t=2025&nm=${nm}`
  const first = await fetchText(url)
  const baseH = parseHiddens(first)
  const baseS = parseSelects(first)
  const groupSel = baseS.find((s) => s.name.endsWith("gruposDropDownList"))!
  const groups = groupSel.options.filter((o) => /liga\s+regular/i.test(o.text) && /^-?\d+$/.test(o.value))
  console.log(`groups: ${groups.length} → ${groups.map((x) => x.text).join(" · ")}\n`)

  const teamIds = new Set<string>()
  const playerIds = new Set<string>()
  for (const grp of groups) {
    const ov = { [groupSel.name]: grp.value }
    await sleep(500)
    const regHtml = await fetchText(url, { method: "POST", body: body(baseH, baseS, groupSel.name, ov) })
    const h = parseHiddens(regHtml)
    const s = parseSelects(regHtml)
    const teamSel = s.find((x) => x.options.some((o) => o.value === "-1" && /equipo/i.test(o.text)) && x.options.some((o) => isTeam(o.value)))!
    const opts = teamSel.options.filter((o) => isTeam(o.value))
    let groupPlayers = 0
    for (const opt of opts) {
      teamIds.add(opt.value)
      await sleep(400)
      const html = await fetchText(url, { method: "POST", body: body(h, s, teamSel.name, { ...ov, [teamSel.name]: opt.value }) })
      const ids = countRosterPlayers(html)
      ids.forEach((id) => playerIds.add(id))
      groupPlayers += ids.length
    }
    console.log(`  ${grp.text.padEnd(28)} teams=${String(opts.length).padStart(2)}  roster players=${groupPlayers}`)
  }
  console.log(`\nTOTAL unique teams=${teamIds.size}  unique players=${playerIds.size}`)
}
main().catch((e) => { console.error("VALIDATE FAILED:", e?.message ?? e); process.exit(1) })
