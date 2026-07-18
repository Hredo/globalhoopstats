/**
 * Record the Playbook demo video for the homepage showcase.
 *
 * Usage:
 *   pnpm tsx scripts/record-playbook-video.ts [--light]
 *   pnpm tsx scripts/record-playbook-video.ts --all
 *
 * Flags:
 *   --light    Record in light mode (default: dark)
 *   --all      Record both dark and light in sequence
 *   --port 3001  Dev server port (default: 3000)
 *
 * The signed-in identity is blurred to illegibility before anything is
 * captured, so no personal data ever reaches a frame.
 *
 * Output: public/media/previews/playbook-{dark,light}.mp4 + a matching .jpg poster
 */

import { chromium, type Page } from "playwright"
import { resolve } from "node:path"
import {
  finishTake,
  waitForLogin,
  cacheSession,
  cachedSessionWorks,
  censorScript,
  assertCensored,
  AUTH_FILE,
  CENSOR_CSS,
} from "./lib/capture"

const args = process.argv.slice(2)
const PORT = extractArg(args, "--port") ?? "3000"
const BASE = `http://localhost:${PORT}`
const OUT_DIR = resolve("public/media/previews")

const recordAll = args.includes("--all")
const themes = recordAll ? (["dark", "light"] as const) : ([args.includes("--light") ? "light" : "dark"] as const)

function extractArg(a: string[], f: string): string | undefined {
  const i = a.indexOf(f)
  return i !== -1 && i + 1 < a.length ? a[i + 1] : undefined
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

// The showcase card is 16:10, so record at that ratio — 1440×900 would letterbox.
const VIEWPORT = { width: 1280, height: 800 }

async function recordTheme(theme: "dark" | "light") {
  const browser = await chromium.launch({
    headless: false,
    // Chromium throttles rAF to a standstill in a window it thinks is parked,
    // which records as a frozen board — the play animation is rAF-driven.
    args: [
      "--disable-background-timer-throttling",
      "--disable-backgrounding-occluded-windows",
      "--disable-renderer-backgrounding",
    ],
  })

  // ── PHASE 1: Sign in once, then reuse it for every later take ──
  // /playbook itself is public, but signing in is what shows the cloud-save
  // and roster surfaces — which is the version worth putting on the homepage.
  if (!(await cachedSessionWorks(browser, `${BASE}/market/trade`))) {
    console.log(`\n🎬 [${theme}] Opening browser — log in manually...`)
    const loginCtx = await browser.newContext({ viewport: VIEWPORT })
    const loginPage = await loginCtx.newPage()

    await loginPage.goto(`${BASE}/login`, { waitUntil: "networkidle" })
    console.log("   👆 Log in now (email + password + 2FA si tienes).")
    await waitForLogin(loginPage)
    console.log("   ✅ Login detected!")

    await sleep(800)
    await cacheSession(loginCtx)
    await loginCtx.close()
  } else {
    console.log(`\n🎬 [${theme}] Reusing the cached session.`)
  }

  // ── PHASE 2: Recording ──
  console.log(`   📹 Recording playbook-${theme}.mp4...`)

  const recordCtx = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
    storageState: AUTH_FILE,
    // This — not an init script — is what actually picks the theme. Restoring
    // storageState wipes localStorage after init scripts run, so seeding
    // "ghs-theme" there silently loses; the app then falls back to
    // prefers-color-scheme, which is exactly what colorScheme drives.
    colorScheme: theme,
    recordVideo: { dir: OUT_DIR, size: VIEWPORT },
  })

  // Pin the UI language so the walkthrough's selectors (and the copy on screen)
  // are stable regardless of the account's saved preference.
  await recordCtx.addCookies([
    { name: "ghs_locale", value: "en", domain: "localhost", path: "/" },
    { name: "ghs_cookie_consent", value: "rejected", domain: "localhost", path: "/" },
  ])

  await recordCtx.addInitScript({ content: censorScript(CENSOR_CSS) })

  const page = await recordCtx.newPage()

  // Navigate to playbook
  await page.goto(`${BASE}/playbook`, { waitUntil: "networkidle" })
  console.log(`   📍 Current URL: ${page.url()}`)

  await sleep(2200)

  // Prove the identity is actually hidden before a single usable frame is kept.
  await assertCensored(page)
  console.log(`   🕶️ Identity censored.`)

  // The editor's board. Every drawing beat below is expressed in board-relative
  // coordinates, so the take survives the panel widths shifting around.
  const board = page.locator("svg.touch-none").first()
  const at = async (fx: number, fy: number) => {
    const b = await board.boundingBox()
    if (!b) throw new Error("board not measurable")
    return { x: b.x + b.width * fx, y: b.y + b.height * fy }
  }

  // ── SCENE 1: Start from one of the real templates ──
  console.log(`   📋 Opening template picker...`)
  await page.locator("button").filter({ hasText: /Templates|Plantillas/ }).first().click()
  await sleep(1600)

  console.log(`   🗂️ Filtering to offense...`)
  await page.locator("button").filter({ hasText: /^Offense|^Ataque/ }).first().click()
  await sleep(1400)

  console.log(`   📐 Loading a set...`)
  await page.locator('div.overflow-y-auto button[type="button"]').first().click()
  await sleep(2200)

  // ── SCENE 2: Watch what the template already animates ──
  console.log(`   ▶️ Playing the template...`)
  await play(page)
  await sleep(5200)

  // ── SCENE 3: Draw on it — defenders, a pass, a screen ──
  console.log(`   🎯 Adding defenders...`)
  await tool(page, /Add defender|defensor/i)
  for (const [fx, fy] of [[0.34, 0.42], [0.66, 0.5]] as const) {
    const p = await at(fx, fy)
    await page.mouse.move(p.x, p.y, { steps: 18 })
    await sleep(350)
    await page.mouse.click(p.x, p.y)
    await sleep(900)
  }

  console.log(`   ✏️ Drawing a pass...`)
  await tool(page, /Pass|Pase/i)
  await drag(page, await at(0.22, 0.68), await at(0.5, 0.3))
  await sleep(1400)

  console.log(`   🧱 Drawing a screen...`)
  await tool(page, /Screen|Bloqueo/i)
  await drag(page, await at(0.5, 0.3), await at(0.68, 0.22))
  await sleep(1400)

  // ── SCENE 4: A second frame is what turns a diagram into a play ──
  console.log(`   🎞️ Adding a frame and moving a player...`)
  await tool(page, /Add frame|Añadir fotograma/i)
  await sleep(1200)
  await tool(page, /Select|Seleccionar/i)
  await drag(page, await at(0.34, 0.42), await at(0.42, 0.24))
  await sleep(1400)

  console.log(`   ▶️ Replaying the finished play...`)
  await play(page)
  await sleep(6000)

  // ── SCENE 5: Real rosters — what separates this from a whiteboard app ──
  console.log(`   👥 Loading a real roster...`)
  await page.locator("button").filter({ hasText: /^Roster$|^Plantilla$/ }).first().click()
  await sleep(1200)
  const selects = page.locator("select")
  await selects.first().selectOption({ index: 1 })
  await sleep(1600)
  await selects.nth(1).selectOption({ index: 1 })
  await sleep(3200)

  // ── Done ──
  console.log(`   ✅ Closing browser...`)
  await recordCtx.close()
  await browser.close()

  // ── Transcode the take → playbook-{theme}.mp4 + poster ──
  finishTake(OUT_DIR, `playbook-${theme}`, 14)
}

/** Picks a tool from the rail. Every one is a button labelled from the dictionary. */
async function tool(page: Page, label: RegExp) {
  await page.getByRole("button", { name: label }).first().click()
  await sleep(700)
}

/** Starts playback. The button flips to "Pause…" once it is running. */
async function play(page: Page) {
  await page.getByRole("button", { name: /Play animation|Reproducir/i }).first().click()
}

/** A deliberate, on-camera drag — instant moves read as a glitch on video. */
async function drag(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
) {
  await page.mouse.move(from.x, from.y, { steps: 16 })
  await sleep(300)
  await page.mouse.down()
  await page.mouse.move(to.x, to.y, { steps: 32 })
  await sleep(400)
  await page.mouse.up()
}

async function main() {
  for (const theme of themes) {
    await recordTheme(theme)
  }
  console.log("\n🎉 All done!")
}

main().catch((err) => {
  console.error("❌ Fatal:", err)
  process.exit(1)
})
