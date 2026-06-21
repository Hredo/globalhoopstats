/*
 * Read-only recon: dump every <select> (name + options) on FEB rankings.aspx
 * for a competition, so we can see how groups/phases are exposed.
 *   pnpm exec tsx scripts/_feb-recon.ts segundafeb 2
 *   pnpm exec tsx scripts/_feb-recon.ts tercerafeb 3
 *   pnpm exec tsx scripts/_feb-recon.ts primerafeb 1
 */
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
const BASE = "https://baloncestoenvivo.feb.es"

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&").replace(/&aacute;/g, "á").replace(/&eacute;/g, "é")
    .replace(/&iacute;/g, "í").replace(/&oacute;/g, "ó").replace(/&uacute;/g, "ú")
    .replace(/&ntilde;/g, "ñ").replace(/&Ntilde;/g, "Ñ").replace(/&uuml;/g, "ü")
    .replace(/&nbsp;/g, " ").replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
}

function parseSelects(html: string) {
  const out: Array<{ name: string; options: Array<{ value: string; text: string; selected: boolean }> }> = []
  const re = /<select[^>]*\bname="([^"]+)"[^>]*>([\s\S]*?)<\/select>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    const options: Array<{ value: string; text: string; selected: boolean }> = []
    const ore = /<option([^>]*)>([\s\S]*?)<\/option>/gi
    let om: RegExpExecArray | null
    while ((om = ore.exec(m[2]!)) !== null) {
      options.push({
        value: om[1]!.match(/value="([^"]*)"/)?.[1] ?? "",
        text: decodeEntities(om[2]!.replace(/<[^>]+>/g, "").trim()),
        selected: /\bselected\b/i.test(om[1]!),
      })
    }
    out.push({ name: m[1]!, options })
  }
  return out
}

function parseHiddens(html: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const tag of html.match(/<input[^>]*type="hidden"[^>]*>/gi) ?? []) {
    const name = tag.match(/name="([^"]+)"/)?.[1]
    const value = tag.match(/value="([^"]*)"/)?.[1] ?? ""
    if (name) out[name] = decodeEntities(value)
  }
  return out
}

function buildPostBody(
  hiddens: Record<string, string>,
  selects: ReturnType<typeof parseSelects>,
  eventTarget: string,
  overrides: Record<string, string>,
): string {
  const body = new URLSearchParams()
  for (const [k, v] of Object.entries(hiddens)) body.set(k, v)
  for (const s of selects) {
    const selected = s.options.find((o) => o.selected) ?? s.options[0]
    body.set(s.name, selected?.value ?? "")
  }
  for (const [k, v] of Object.entries(overrides)) body.set(k, v)
  body.set("__EVENTTARGET", eventTarget)
  body.set("__EVENTARGUMENT", "")
  return body.toString()
}

async function get(url: string, init?: { method?: string; body?: string }) {
  const res = await fetch(url, {
    method: init?.method ?? "GET",
    body: init?.body,
    headers: {
      "User-Agent": UA, Accept: "text/html", "Accept-Language": "es-ES,es;q=0.9",
      ...(init?.body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
  })
  return res
}

async function main() {
  const nm = process.argv[2] ?? "segundafeb"
  const g = process.argv[3] ?? "2"
  const groupValue = process.argv[4] // optional: postback to select this group
  const url = `${BASE}/rankings.aspx?g=${g}&t=2025&nm=${nm}`
  console.log("GET", url)
  let res = await get(url)
  console.log("status", res.status)
  let html = await res.text()

  if (groupValue) {
    const hiddens = parseHiddens(html)
    const sels = parseSelects(html)
    const groupSel = sels.find((s) => s.name.endsWith("gruposDropDownList"))!
    console.log(`POST select group [${groupValue}] via ${groupSel.name}`)
    res = await get(url, {
      method: "POST",
      body: buildPostBody(hiddens, sels, groupSel.name, { [groupSel.name]: groupValue }),
    })
    console.log("post status", res.status)
    html = await res.text()
  }

  const selects = parseSelects(html)
  console.log(`\n${selects.length} <select> elements:\n`)
  for (const s of selects) {
    console.log(`■ name="${s.name}"  (${s.options.length} options)`)
    for (const o of s.options.slice(0, 60)) {
      console.log(`    ${o.selected ? "✓" : " "} [${o.value}] ${o.text}`)
    }
    if (s.options.length > 60) console.log(`    … +${s.options.length - 60} more`)
    console.log()
  }
}

main().catch((e) => { console.error("RECON FAILED:", e?.message ?? e); process.exit(1) })
