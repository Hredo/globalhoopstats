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
 * Output: public/media/previews/trade-{dark,light}.mp4
 */

import { chromium } from "playwright"
import { readdirSync, renameSync, statSync } from "node:fs"
import { resolve } from "node:path"

const args = process.argv.slice(2)
const PORT = extractArg(args, "--port") ?? "3000"
const BASE = `http://localhost:${PORT}`
const OUT_DIR = resolve("public/media/previews")

const recordAll = args.includes("--all")
const themes = recordAll ? (["dark", "light"] as const) : ([args.includes("--light") ? "light" : "dark"] as const)

const player1 = extractArg(args, "--player") ?? "Luka Doncic"
const player2 = extractArg(args, "--p2") ?? "LeBron James"
const player3 = extractArg(args, "--p3") ?? "Giannis Antetokounmpo"

function extractArg(a: string[], f: string): string | undefined {
  const i = a.indexOf(f)
  return i !== -1 && i + 1 < a.length ? a[i + 1] : undefined
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

async function recordTheme(theme: "dark" | "light") {
  const browser = await chromium.launch({ headless: false })

  // ── PHASE 1: Manual login (no recording) ──
  console.log(`\n🎬 [${theme}] Opening browser — log in manually...`)
  const loginCtx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  })
  const loginPage = await loginCtx.newPage()

  await loginPage.addInitScript((t: string) => {
    document.documentElement.setAttribute("data-theme", t)
    try { localStorage.setItem("ghs-theme", t) } catch { /* noop */ }
  }, theme)

  await loginPage.goto(`${BASE}/login`, { waitUntil: "networkidle" })
  console.log("   👆 Log in now (email + password + 2FA si tienes).")

  // Wait for login — the user-menu button appears when authenticated
  await loginPage.waitForSelector('button[aria-haspopup="menu"]', { timeout: 120000 })
  console.log("   ✅ Login detected!")

  // Save storage state (cookies + localStorage) from the logged-in session
  await sleep(500)
  const storageState = await loginCtx.storageState()
  console.log(`   🍪 Cookies in storageState: ${storageState.cookies.length}`)
  if (storageState.cookies.length > 0) {
    storageState.cookies.forEach((c) => console.log(`      ${c.name}: ${c.value.slice(0, 20)}...`))
  }

  await loginCtx.close()

  // If no cookies in storageState, try one more approach: read from page context
  if (storageState.cookies.length === 0) {
    console.log("   ⚠️ No cookies in storageState — trying direct navigation approach...")
    // Just use the same browser context for recording
  }

  // ── PHASE 2: Recording with blurred user ──
  console.log(`   📹 Recording trade-${theme}.mp4...`)

  const recordCtx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2,
    ...(storageState.cookies.length > 0 ? { storageState } : {}),
    recordVideo: { dir: OUT_DIR, size: { width: 1280, height: 800 } },
  })

  // If storageState had no cookies, set the locale cookie manually
  // (session cookie will be set by the browser after redirect)
  if (storageState.cookies.length === 0) {
    await recordCtx.addCookies([
      { name: "ghs_locale", value: "en", domain: "localhost", path: "/" },
    ])
  }

  await recordCtx.addInitScript((t: string) => {
    document.documentElement.setAttribute("data-theme", t)
    try { localStorage.setItem("ghs-theme", t) } catch { /* noop */ }
    // Blur user avatar + name in the navbar
    const css = `
      button[aria-haspopup="menu"] > span:first-child,
      button[aria-haspopup="menu"] > span:nth-child(2),
      button[aria-haspopup="menu"] > span:nth-child(3),
      div[role="menu"] span:first-child,
      div[role="menu"] p { filter: blur(10px) !important; }
    `
    const s = document.createElement("style")
    s.textContent = css
    document.head.appendChild(s)
  }, theme)

  const page = await recordCtx.newPage()

  // Navigate to trade page — the browser should have the session cookie
  // from the storageState (or from the browser's own cookie jar)
  await page.goto(`${BASE}/market/trade`, { waitUntil: "networkidle" })
  console.log(`   📍 Current URL: ${page.url()}`)

  // If redirected to login, the storage state didn't carry the cookie
  if (page.url().includes("/login")) {
    console.log("   ⚠️ Redirected to login — logging in again manually...")
    await page.waitForSelector('button[aria-haspopup="menu"]', { timeout: 120000 })
    // Navigate back to trade
    await page.goto(`${BASE}/market/trade`, { waitUntil: "networkidle" })
  }

  await sleep(2000)

  // ── SIMULAR: search player ──
  console.log(`   🔍 Searching "${player1}"...`)
  // Wait for the search input container to be ready
  await page.waitForSelector('input[role="combobox"]', { state: 'visible' })
  
  const simInput = page.locator('input[role="combobox"]')
  await simInput.click()
  await sleep(600)
  await simInput.fill(player1.slice(0, 3))
  await sleep(1500)
  await simInput.fill(player1)
  await sleep(800)

  const firstOption = page.locator('[role="option"]').first()
  await firstOption.waitFor({ state: "visible", timeout: 15000 })
  await sleep(500)
  await firstOption.click()
  await sleep(800)

  // ── SIMULAR: click Simulate ──
  console.log(`   ⚡ Simulating...`)
  await page.locator(".gh-btn-primary").first().click()
  await sleep(6000)

  // Scroll to show results
  console.log(`   📜 Scrolling to results...`)
  await page.evaluate(() => window.scrollTo({ top: 600, behavior: "smooth" }))
  await sleep(2000)

  // ── SWITCH TO PROPONER ──
  console.log(`   🔄 Switching to Proponer...`)
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }))
  await sleep(800)
  await page.locator("button").filter({ hasText: /Propose|Proponer/ }).click()
  await sleep(1500)

  // ── PROPONER: outgoing (left) ──
  console.log(`   🔍 Outgoing "${player2}"...`)
  await page.locator('[aria-haspopup="listbox"]').first().click()
  await sleep(600)

  const leftInput = page.locator('input[role="combobox"]')
  await leftInput.fill(player2.slice(0, 3))
  await sleep(1200)
  await leftInput.fill(player2)
  await sleep(800)

  await page.locator('[role="option"]').first().waitFor({ state: "visible", timeout: 15000 })
  await sleep(400)
  await page.locator('[role="option"]').first().click()
  await sleep(1000)

  // ── PROPONER: incoming (right) ──
  console.log(`   🔍 Incoming "${player3}"...`)
  await page.locator('[aria-haspopup="listbox"]').last().click()
  await sleep(600)

  const rightInput = page.locator('input[role="combobox"]')
  await rightInput.fill(player3.slice(0, 3))
  await sleep(1200)
  await rightInput.fill(player3)
  await sleep(800)

  await page.locator('[role="option"]').first().waitFor({ state: "visible", timeout: 15000 })
  await sleep(400)
  await page.locator('[role="option"]').first().click()
  await sleep(1000)

  // Scroll to show full proponer
  console.log(`   📜 Scrolling proponer view...`)
  await page.evaluate(() => window.scrollTo({ top: 400, behavior: "smooth" }))
  await sleep(2500)

  // ── Done ──
  console.log(`   ✅ Closing browser...`)
  await recordCtx.close()
  await browser.close()

  // ── Rename .webm → trade-{theme}.mp4 ──
  const files = readdirSync(OUT_DIR)
  const webmFile = files
    .filter((f) => f.endsWith(".webm"))
    .sort((a, b) => statSync(resolve(OUT_DIR, b)).mtimeMs - statSync(resolve(OUT_DIR, a)).mtimeMs)[0]

  if (webmFile) {
    const dst = resolve(OUT_DIR, `trade-${theme}.mp4`)
    renameSync(resolve(OUT_DIR, webmFile), dst)
    console.log(`   💾 Saved: ${dst}`)
  } else {
    console.warn(`   ⚠️ No .webm found for ${theme}`)
  }
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
