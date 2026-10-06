/**
 * Records the homepage product reel (<LiveShowcase>): every scene, in both
 * themes and both languages, from the real app.
 *
 * Usage:
 *   pnpm capture:showcase                         # everything
 *   pnpm capture:showcase --scenes player,compare --themes dark --locales es
 *   pnpm capture:showcase --port 3001
 *
 * Output: public/media/previews/{scene}-{theme}-{locale}.mp4 + .jpg poster.
 *
 * Public scenes (player, compare, playbook) are recorded signed out — nothing
 * personal can reach a frame. The signed-in ones (trade, ai-advisor) open a
 * browser for you to sign in once; the session is cached in .auth/ and the
 * identity is blurred and verified before any footage is kept. The advisor
 * scene uses whatever AI engine that account has configured.
 */

import { chromium, type Browser, type BrowserContext, type Page } from "playwright"
import { tmpdir } from "node:os"
import { resolve } from "node:path"
import {
  AUTH_FILE,
  CENSOR_CSS,
  assertCensored,
  cacheSession,
  cachedSessionWorks,
  captureFrames,
  censorScript,
  encodeTake,
  waitForLogin,
} from "./lib/capture"

type Theme = "dark" | "light"
type Locale = "es" | "en"
type SceneKey = "player" | "compare" | "playbook" | "trade" | "ai-advisor"

type Scene = {
  path: string
  auth: boolean
  /**
   * The walkthrough. It calls `poster()` at the moment that should become the
   * still — a fixed timestamp drifts with network speed and used to land on
   * half-animated, empty cards.
   */
  run: (page: Page, locale: Locale, poster: () => void) => Promise<void>
}

const args = process.argv.slice(2)
const arg = (flag: string) => {
  const i = args.indexOf(flag)
  return i !== -1 && i + 1 < args.length ? args[i + 1] : undefined
}
const list = <T extends string>(flag: string, all: readonly T[]): T[] => {
  const raw = arg(flag)
  if (!raw) return [...all]
  const picked = raw.split(",").map((s) => s.trim()) as T[]
  for (const p of picked) if (!all.includes(p)) throw new Error(`Unknown ${flag} value: ${p}`)
  return picked
}

const BASE = `http://localhost:${arg("--port") ?? "3000"}`
const OUT_DIR = resolve("public/media/previews")
// The showcase card is 16:10; recording at that ratio avoids letterboxing.
const VIEWPORT = { width: 1280, height: 800 }
// Frames at the device-scale-2 size; scaled down once, at encode time.
const FRAME = { width: 2560, height: 1600 }

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

// ── Scenes ───────────────────────────────────────────────────────────────────

const SCENES: Record<SceneKey, Scene> = {
  /**
   * One person, two leagues: the profile switches between his EuroLeague and
   * Liga Endesa lines — the cross-league identity is the product — then the
   * real shooting zones and the comparables.
   */
  player: {
    path: "/players/euroleague-mario-hezonja",
    auth: false,
    async run(page, _locale, poster) {
      const league = (name: RegExp) =>
        page.locator("button, [role=tab]").filter({ hasText: name }).first()
      await sleep(1800)
      await league(/^(Liga Endesa|ACB)$/).click()
      await sleep(2600)
      await league(/^EuroLeague$/).click()
      await sleep(1800)
      await glide(page, 820, 1900) // the shot chart, the slowest beat
      await sleep(1600)
      poster()
      await sleep(2200)
      await glide(page, 1330, 1500) // comparables
      await sleep(2200)
      await glide(page, 0, 1800)
      await sleep(1000)
    },
  },

  /** Cross-league head-to-head: a EuroLeague forward against an NBA star. */
  compare: {
    path: "/compare",
    auth: false,
    async run(page, _locale, poster) {
      await sleep(1200)
      await pickPlayer(page, "first", "Hezonja")
      await sleep(1600)
      await pickPlayer(page, "last", "Doncic")
      await sleep(2200)
      await glide(page, 420, 1600)
      await sleep(2000)
      poster()
      await sleep(1400)
      await glide(page, 980, 1600)
      await sleep(2600)
      await glide(page, 0, 1600)
      await sleep(1000)
    },
  },

  /** A real template, drawn on, given a second frame and played back. */
  playbook: {
    path: "/playbook",
    auth: false,
    async run(page, _locale, poster) {
      const board = page.locator("svg.touch-none").first()
      await board.waitFor({ state: "visible", timeout: 30000 })
      const at = async (fx: number, fy: number) => {
        const b = await board.boundingBox()
        if (!b) throw new Error("board not measurable")
        return { x: b.x + b.width * fx, y: b.y + b.height * fy }
      }
      await sleep(1200)

      await page.getByRole("button", { name: /^Menu$|^Menú$/ }).first().click()
      await sleep(500)
      await page.getByRole("menuitem", { name: /^Templates$|^Plantillas$/ }).first().click()
      await sleep(1500)
      await page.locator("button").filter({ hasText: /^Offense|^Ataque/ }).first().click()
      await sleep(1200)
      await page.locator('div.overflow-y-auto button[type="button"]').first().click()
      await sleep(1800)

      await playbookPlay(page)
      await sleep(5000)

      await playbookTool(page, /Add defender|defensor/i)
      for (const [fx, fy] of [[0.34, 0.42], [0.66, 0.5]] as const) {
        const p = await at(fx, fy)
        await page.mouse.move(p.x, p.y, { steps: 18 })
        await sleep(300)
        await page.mouse.click(p.x, p.y)
        await sleep(800)
      }
      await playbookTool(page, /Pass|Pase/i)
      await drag(page, await at(0.22, 0.68), await at(0.5, 0.3))
      await sleep(1200)
      await playbookTool(page, /Screen|Bloqueo/i)
      await drag(page, await at(0.5, 0.3), await at(0.68, 0.22))
      await sleep(900)
      poster()
      await sleep(300)

      await playbookTool(page, /Add frame|Añadir fotograma/i)
      await sleep(1000)
      await playbookTool(page, /Select|Seleccionar/i)
      await drag(page, await at(0.34, 0.42), await at(0.42, 0.24))
      await sleep(1200)
      await playbookPlay(page)
      await sleep(5600)
    },
  },

  /** Simulate a market for one player, then propose and balance a swap. */
  trade: {
    path: "/market/trade",
    auth: true,
    async run(page, _locale, poster) {
      await sleep(1200)
      await pickPlayer(page, "first", "Hezonja")
      await sleep(1300)
      await page.locator("select").first().selectOption({ index: 2 })
      await sleep(1100)
      await page.locator(".gh-btn-primary").first().click()
      await page
        .locator("text=/Scenarios:|Escenarios:/")
        .first()
        .waitFor({ state: "visible", timeout: 45000 })
      await sleep(1500)
      await glide(page, 520, 1600)
      await sleep(2200)
      await glide(page, 1080, 1600)
      await sleep(2200)
      await glide(page, 0, 1200)
      await sleep(600)
      await page.locator("button").filter({ hasText: /^(Propose|Proponer)$/ }).first().click()
      await sleep(1500)
      await pickPlayer(page, "first", "Tavares")
      await sleep(1600)
      await pickPlayer(page, "last", "Vezenkov")
      await sleep(2000)
      await glide(page, 240, 1400) // the balance verdict, both sides in frame
      await sleep(1200)
      poster()
      await sleep(1800)
    },
  },

  /** One real question, answered from the database with the account's model. */
  "ai-advisor": {
    path: "/ai-advisor",
    auth: true,
    async run(page, locale, poster) {
      // The advisor answers for a club: pick it first, as a coach would.
      const team = page.locator("#team-selector-input")
      await team.waitFor({ state: "visible", timeout: 30000 })
      await sleep(1000)
      await team.click()
      await team.pressSequentially("Real Mad", { delay: 90 })
      const club = page.locator('[aria-label="Available teams"] [role="option"]').first()
      await club.waitFor({ state: "visible", timeout: 15000 })
      await sleep(500)
      await club.click()
      const input = page.getByRole("textbox", { name: "Ask the advisor" })
      await page.waitForFunction(
        () => (document.querySelector('[aria-label="Ask the advisor"]') as HTMLInputElement | null)?.disabled === false,
        undefined,
        { timeout: 15000 },
      )
      await sleep(900)
      await input.click()
      await input.pressSequentially(
        locale === "es"
          ? "Necesito un base que corra al contraataque"
          : "I need a point guard who pushes the break",
        { delay: 45 },
      )
      await sleep(600)
      await page.getByRole("button", { name: "Send message" }).click()
      // The input is disabled while the advisor answers and comes back when
      // the answer is complete — a real signal, not a timer.
      await page.waitForFunction(
        () => (document.querySelector('[aria-label="Ask the advisor"]') as HTMLInputElement | null)?.disabled === true,
        undefined,
        { timeout: 15000 },
      )
      await page.waitForFunction(
        () => (document.querySelector('[aria-label="Ask the advisor"]') as HTMLInputElement | null)?.disabled === false,
        undefined,
        { timeout: 120000, polling: 500 },
      )
      await sleep(1500)
      const log = page.locator('[aria-label="Advisor conversation"]')
      await log.evaluate((el) => el.scrollTo({ top: el.scrollHeight * 0.45, behavior: "smooth" }))
      await sleep(1500)
      poster()
      await sleep(1700)
      await log.evaluate((el) => el.scrollTo({ top: el.scrollHeight, behavior: "smooth" }))
      await sleep(2800)
    },
  },
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Smooth, eased scroll to a page offset — instant jumps read as glitches.
 * Sent as source text: tsx/esbuild wraps named functions in a Node-only
 * `__name()` helper, which throws when the body is serialised to the page.
 */
async function glide(page: Page, top: number, ms: number) {
  await page.evaluate(`new Promise((done) => {
    const from = window.scrollY, t0 = performance.now()
    const tick = (now) => {
      const t = Math.min((now - t0) / ${ms}, 1)
      window.scrollTo(0, from + (${top} - from) * (1 - Math.pow(1 - t, 3)))
      if (t < 1) requestAnimationFrame(tick); else done()
    }
    requestAnimationFrame(tick)
  })`)
}

/**
 * Drives one player search popover (compare and trade share the component):
 * a trigger that opens a panel, a combobox inside it, a listbox of live
 * results. Typing is slow so the search visibly reacts on camera.
 */
async function pickPlayer(page: Page, which: "first" | "last", query: string) {
  const triggers = page.locator('button[aria-haspopup="listbox"]')
  const btn = which === "first" ? triggers.first() : triggers.last()
  const input = page.locator('input[role="combobox"]').first()
  // A click that lands mid-transition is swallowed; open, verify, retry.
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
  // One letter matches nothing and the panel flashes its "no player matches"
  // state on camera; the first three land at once, the rest are typed.
  await input.fill(query.slice(0, 3))
  await input.pressSequentially(query.slice(3), { delay: 110 })
  await sleep(1400)
  const hit = page.locator('[role="option"]').first()
  await hit.waitFor({ state: "visible", timeout: 20000 })
  await sleep(600)
  await hit.click()
}

async function playbookTool(page: Page, label: RegExp) {
  await page.getByRole("button", { name: label }).first().click()
  await sleep(600)
}

async function playbookPlay(page: Page) {
  await page.getByRole("button", { name: /Play animation|Reproducir/i }).first().click()
}

async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y, { steps: 16 })
  await sleep(250)
  await page.mouse.down()
  await page.mouse.move(to.x, to.y, { steps: 32 })
  await sleep(350)
  await page.mouse.up()
}

// ── Recording ────────────────────────────────────────────────────────────────

async function ensureSession(browser: Browser) {
  if (await cachedSessionWorks(browser, `${BASE}/market/trade`)) {
    console.log("🔑 Reusing the cached session.")
    return
  }
  console.log("\n🔑 Sign in in the window that just opened (email, password, 2FA).")
  const ctx = await browser.newContext({ viewport: VIEWPORT })
  const page = await ctx.newPage()
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" })
  await waitForLogin(page, 15 * 60_000)
  await sleep(800)
  await cacheSession(ctx)
  await ctx.close()
  console.log("   ✅ Session cached.")
}

async function record(browser: Browser, key: SceneKey, theme: Theme, locale: Locale) {
  const scene = SCENES[key]
  const name = `${key}-${theme}-${locale}`
  console.log(`🎬 ${name}`)

  const ctx: BrowserContext = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
    // Picks the theme: the app falls back to prefers-color-scheme, and
    // restoring storageState would wipe a localStorage seed anyway.
    colorScheme: theme,
    ...(scene.auth ? { storageState: AUTH_FILE } : {}),
  })
  await ctx.addCookies([
    { name: "ghs_locale", value: locale, domain: "localhost", path: "/" },
    { name: "ghs_cookie_consent", value: "rejected", domain: "localhost", path: "/" },
  ])
  await ctx.addInitScript({ content: censorScript(CENSOR_CSS) })
  // First-visit tours would cover the walkthrough.
  await ctx.addInitScript({
    content: `try { localStorage.setItem("ai-advisor:tour-done", "1") } catch {}`,
  })

  const page = await ctx.newPage()
  try {
    const take = await captureFrames(page, FRAME, resolve(tmpdir(), `ghs-take-${name}`))
    await page.goto(`${BASE}${scene.path}`, { waitUntil: "networkidle", timeout: 120000 })
    if (page.url().includes("/login")) throw new Error(`${scene.path} bounced to /login.`)
    if (scene.auth) await assertCensored(page)
    // Let fonts, data and entrance animations settle; everything up to here
    // (navigation, first paint, loading) is cut from the clip.
    await sleep(1800)
    const trimFrom = Date.now()
    let posterAt = trimFrom + 2000
    await scene.run(page, locale, () => {
      posterAt = Date.now()
    })
    await take.stop()
    await ctx.close()
    encodeTake(take, OUT_DIR, name, (posterAt - trimFrom) / 1000, { trimFrom })
  } catch (err) {
    await ctx.close().catch(() => {})
    throw err
  }
}

async function main() {
  const scenes = list<SceneKey>("--scenes", ["player", "compare", "playbook", "trade", "ai-advisor"])
  const themes = list<Theme>("--themes", ["dark", "light"])
  const locales = list<Locale>("--locales", ["es", "en"])

  const needsAuth = scenes.some((s) => SCENES[s].auth)
  const browser = await chromium.launch({
    // Headed only when someone has to sign in. Either way rAF must not be
    // throttled: the app is animation-driven and a parked window records frozen.
    headless: !needsAuth,
    args: [
      "--disable-background-timer-throttling",
      "--disable-backgrounding-occluded-windows",
      "--disable-renderer-backgrounding",
    ],
  })
  try {
    if (needsAuth) await ensureSession(browser)
    for (const key of scenes)
      for (const theme of themes)
        for (const locale of locales) await record(browser, key, theme, locale)
  } finally {
    await browser.close()
  }
  console.log("\n🎉 Done.")
}

main().catch((err) => {
  console.error("❌", err)
  process.exit(1)
})
