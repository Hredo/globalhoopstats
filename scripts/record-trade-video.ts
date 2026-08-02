/**
 * Record the trade simulator demo video for the homepage showcase.
 *
 * Usage:
 *   pnpm tsx scripts/record-trade-video.ts [--light] [--player "Luka Doncic"]
 *   pnpm tsx scripts/record-trade-video.ts --all
 *
 * Flags:
 *   --light    Record in light mode (default: dark)
 *   --all      Record both dark and light in sequence
 *   --port 3001  Dev server port (default: 3000)
 *
 * The signed-in identity is blurred to illegibility before anything is
 * captured, so no personal data ever reaches a frame.
 *
 * Output: public/media/previews/trade-{dark,light}.mp4 + a matching .jpg poster
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

// First names only, on purpose. Typing a full name walks the live search
// through a stretch where nothing matches — "Giannis Antetokounmpo" ends on a
// "No results" panel, because the stored spelling carries diacritics — and a
// failed search on camera is the last thing a demo reel should show.
const player1 = extractArg(args, "--player") ?? "Luka"
const player2 = extractArg(args, "--p2") ?? "LeBron"
const player3 = extractArg(args, "--p3") ?? "Giannis"

function extractArg(a: string[], f: string): string | undefined {
  const i = a.indexOf(f)
  return i !== -1 && i + 1 < a.length ? a[i + 1] : undefined
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

async function recordTheme(theme: "dark" | "light") {
  const browser = await chromium.launch({
    headless: false,
    // Chromium throttles rAF to a standstill in a window it thinks is parked,
    // which records as a frozen page — the whole app is animation-driven.
    args: [
      "--disable-background-timer-throttling",
      "--disable-backgrounding-occluded-windows",
      "--disable-renderer-backgrounding",
    ],
  })

  // ── PHASE 1: Sign in once, then reuse it for every later take ──
  if (!(await cachedSessionWorks(browser, `${BASE}/market/trade`))) {
    console.log(`\n🎬 [${theme}] Opening browser — log in manually...`)
    const loginCtx = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    })
    const loginPage = await loginCtx.newPage()

    await loginPage.goto(`${BASE}/login`, { waitUntil: "networkidle" })
    console.log("   👆 Log in now (email + password + 2FA si tienes).")

    // Ask the server whether there is a session — a DOM check does not work
    // here, see waitForLogin() for why.
    await waitForLogin(loginPage)
    console.log("   ✅ Login detected!")

    await sleep(800)
    await cacheSession(loginCtx)
    await loginCtx.close()
  } else {
    console.log(`\n🎬 [${theme}] Reusing the cached session.`)
  }

  // ── PHASE 2: Recording with blurred user ──
  console.log(`   📹 Recording trade-${theme}.mp4...`)

  const recordCtx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2,
    storageState: AUTH_FILE,
    // This — not an init script — is what actually picks the theme. Restoring
    // storageState wipes localStorage after init scripts run, so seeding
    // "ghs-theme" there silently loses; the app then falls back to
    // prefers-color-scheme, which is exactly what colorScheme drives.
    colorScheme: theme,
    recordVideo: { dir: OUT_DIR, size: { width: 1280, height: 800 } },
  })

  // Pin the UI language so the walkthrough's selectors (and the copy on screen)
  // are stable regardless of the account's saved preference.
  await recordCtx.addCookies([
    { name: "ghs_locale", value: "en", domain: "localhost", path: "/" },
    { name: "ghs_cookie_consent", value: "rejected", domain: "localhost", path: "/" },
  ])

  await recordCtx.addInitScript({ content: censorScript(CENSOR_CSS) })

  const page = await recordCtx.newPage()

  // Navigate to trade page — the browser should have the session cookie
  // from the storageState (or from the browser's own cookie jar)
  await page.goto(`${BASE}/market/trade`, { waitUntil: "networkidle" })
  console.log(`   📍 Current URL: ${page.url()}`)

  if (page.url().includes("/login")) {
    await recordCtx.close()
    await browser.close()
    throw new Error("/market/trade bounced to /login — the session did not carry over.")
  }

  await sleep(2200)

  // Prove the identity is actually hidden before a single usable frame is kept.
  await assertCensored(page)
  console.log(`   🕶️ Identity censored.`)

  // ── SIMULAR: search player ──
  console.log(`   🔍 Searching "${player1}"...`)
  await pickPlayer(page, "first", player1)
  await sleep(1400)

  // Narrow what should come back — a real control, and it reads on camera.
  console.log(`   🎚️ Setting the position needed...`)
  await page.locator("select").first().selectOption({ index: 2 })
  await sleep(1300)

  // ── SIMULAR: click Simulate ──
  console.log(`   ⚡ Simulating...`)
  await page.locator(".gh-btn-primary").first().click()
  // The valuation engine round-trips; wait for the verdict, not a fixed timer.
  await page
    .locator("text=/Scenarios:|Escenarios:/")
    .first()
    .waitFor({ state: "visible", timeout: 45000 })
  await sleep(1600)

  // Walk the returned packages so the viewer sees actual output, not a header.
  console.log(`   📜 Reading the returned packages...`)
  await page.evaluate(() => window.scrollTo({ top: 520, behavior: "smooth" }))
  await sleep(2600)
  await page.evaluate(() => window.scrollTo({ top: 1080, behavior: "smooth" }))
  await sleep(2600)

  // ── SWITCH TO PROPONER ──
  console.log(`   🔄 Switching to Proponer...`)
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }))
  await sleep(1000)
  await page.locator("button").filter({ hasText: /^(Propose|Proponer)$/ }).first().click()
  await sleep(1600)

  // ── PROPONER: outgoing (left) ──
  console.log(`   🔍 Outgoing "${player2}"...`)
  await pickPlayer(page, "first", player2)
  await sleep(1800)

  // ── PROPONER: incoming (right) ──
  console.log(`   🔍 Incoming "${player3}"...`)
  await pickPlayer(page, "last", player3)
  await sleep(2200)

  // Land on the balance verdict — the payoff of the whole feature.
  console.log(`   ⚖️ Showing the balance verdict...`)
  await page.evaluate(() => window.scrollTo({ top: 420, behavior: "smooth" }))
  await sleep(3000)

  // ── Done ──
  console.log(`   ✅ Closing browser...`)
  await recordCtx.close()
  await browser.close()

  // ── Transcode the take → trade-{theme}.mp4 + poster ──
  finishTake(OUT_DIR, `trade-${theme}`, 12)
}

/**
 * Drives one PlayerSearchPopover end to end. Both trade modes use the same
 * component: a trigger button that opens a panel, a combobox inside it, then a
 * listbox of live results — the combobox does not exist until the panel opens,
 * which is why clicking the trigger first is not optional.
 *
 * Typing is deliberately slow so the search visibly reacts on camera instead of
 * snapping straight to a finished list.
 */
async function pickPlayer(page: Page, trigger: "first" | "last", query: string) {
  const triggers = page.locator('button[aria-haspopup="listbox"]')
  const btn = trigger === "first" ? triggers.first() : triggers.last()
  const input = page.locator('input[role="combobox"]').first()

  // Switching modes slides the panels in under AnimatePresence, and a click
  // that lands mid-transition is swallowed — the trigger reports visible while
  // the handler is not wired up yet. Open it, verify, retry if it did not take.
  for (let attempt = 1; ; attempt++) {
    await btn.waitFor({ state: "visible", timeout: 15000 })
    await btn.click()
    try {
      await input.waitFor({ state: "visible", timeout: 4000 })
      break
    } catch {
      if (attempt >= 3) throw new Error("Player search popover never opened.")
      await sleep(900)
    }
  }

  await input.type(query, { delay: 100 })
  await sleep(1600)

  const hit = page.locator('[role="option"]').first()
  await hit.waitFor({ state: "visible", timeout: 20000 })
  await sleep(700)
  await hit.click()
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
