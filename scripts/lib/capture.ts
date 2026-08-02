/**
 * Shared plumbing for the homepage showcase recorders
 * (record-trade-video.ts and record-playbook-video.ts).
 *
 * Everything here is about getting a clean, publishable file out of Playwright;
 * the interesting part — what each demo actually does on screen — stays in the
 * per-feature scripts.
 */

import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs"
import { resolve } from "node:path"
import type { Browser, BrowserContext, Page } from "playwright"

/**
 * Censors the signed-in identity everywhere it can surface: the navbar trigger
 * (avatar initials) and the account dropdown header (name + email).
 *
 * Scoped with `:has(span.bg-gradient-to-br)` rather than plain
 * `button[aria-haspopup="menu"]`, because the navbar's Players, Teams and
 * language controls carry that same attribute — a looser selector blurs half
 * the nav. The gradient avatar chip is unique to the account menu.
 *
 * The radius is deliberately far past "unreadable": at these type sizes 6px
 * already destroys the glyphs, so 26px leaves nothing but a colour smear.
 */
export const CENSOR_CSS = `
  button[aria-haspopup="menu"]:has(> span.bg-gradient-to-br) > span,
  div[role="menu"]:has(span.bg-gradient-to-br) span.bg-gradient-to-br,
  div[role="menu"]:has(span.bg-gradient-to-br) p {
    filter: blur(26px) !important;
  }
  button[aria-haspopup="menu"]:has(> span.bg-gradient-to-br) {
    overflow: hidden !important;
    border-radius: 9999px !important;
  }
  /* chrome that has no business in a marketing clip */
  [aria-label="Cookie notice"],
  [aria-label="Aviso de cookies"] { display: none !important; }
`

/**
 * Source for the init script that applies the censor and strips the identity
 * out of the DOM itself.
 *
 * Returned as a **string**, not a function, and fed to
 * `addInitScript({ content })`. Handing Playwright a function from this module
 * does not work: tsx compiles the file through esbuild, which wraps named
 * functions in a `__name()` helper that exists only in the Node module scope.
 * The serialised body then throws on the page, the whole init script dies
 * silently, and the take records with the account name in full view.
 *
 * CSS alone is also not enough: the account button carries the real name in
 * both `title` and `aria-label`, and `title` renders a native OS tooltip that
 * no stylesheet can blur — one stray hover and the name is on camera as plain
 * text. The observer keeps scrubbing because the button mounts after
 * hydration and React re-renders it.
 */
export function censorScript(css: string): string {
  return `(() => {
  const css = ${JSON.stringify(css)};
  const install = () => {
    const s = document.createElement("style");
    s.id = "ghs-preview-censor";
    s.textContent = css;
    document.head.appendChild(s);
  };
  if (document.head) install();
  else document.addEventListener("DOMContentLoaded", install, { once: true });

  const scrub = () => {
    document.querySelectorAll('button[aria-haspopup="menu"]').forEach((el) => {
      if (!el.querySelector("span.bg-gradient-to-br")) return;
      el.removeAttribute("title");
      el.setAttribute("aria-label", "Account");
    });
  };
  const start = () => {
    scrub();
    new MutationObserver(scrub).observe(document.body, { childList: true, subtree: true });
  };
  if (document.body) start();
  else document.addEventListener("DOMContentLoaded", start, { once: true });
})();`
}

/**
 * Fails the take rather than publishing an uncensored one.
 *
 * A silent censor failure is the one bug here with a real-world cost — it ships
 * the owner's name and email to the homepage — so it is checked against the
 * live DOM before any footage is kept, not assumed from the CSS being present.
 */
export async function assertCensored(page: Page) {
  const state = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button[aria-haspopup="menu"]')].find(
      (b) => b.querySelector("span.bg-gradient-to-br"),
    )
    if (!btn) return { found: false, filter: "", title: null as string | null }
    const span = btn.querySelector("span")
    return {
      found: true,
      filter: span ? getComputedStyle(span).filter : "",
      title: btn.getAttribute("title"),
    }
  })

  if (!state.found) {
    throw new Error("Account menu not found — is the recording context signed in?")
  }
  if (!state.filter.includes("blur")) {
    throw new Error(`Account avatar is NOT blurred (filter: ${state.filter || "none"}).`)
  }
  if (state.title) {
    throw new Error(`Account button still exposes a title attribute: ${state.title}`)
  }
}

/**
 * Blocks until the browser really has a session.
 *
 * The obvious check — waiting for the user-menu button — does not work: the
 * navbar's language switcher is also `aria-haspopup="menu"`, so the selector
 * matches while still signed out, the script sails on and `storageState()`
 * comes back with zero cookies. Ask the server instead.
 *
 * Polled from Node rather than `waitForFunction` because signing in navigates,
 * and a navigation tears down the page-side execution context mid-poll.
 */
export async function waitForLogin(page: Page, timeoutMs = 300_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const ok = await page.evaluate(async () => {
        const res = await fetch("/api/auth/me", { cache: "no-store" })
        const data = (await res.json()) as { user?: { id?: string } | null }
        return Boolean(data?.user?.id)
      })
      if (ok) return
    } catch {
      /* mid-navigation — try again on the next tick */
    }
    await new Promise((r) => setTimeout(r, 2000))
  }
  throw new Error("Timed out waiting for sign-in.")
}

/**
 * Where the signed-in browser state is parked between takes. Recording every
 * scene in both themes otherwise means signing in four separate times; with
 * this you sign in once and every later run reuses it. Gitignored — it holds a
 * live session cookie.
 */
export const AUTH_FILE = resolve(".auth/preview-session.json")

export function hasCachedSession(): boolean {
  return existsSync(AUTH_FILE)
}

/** Persist the context's cookies + storage for the next take to pick up. */
export async function cacheSession(ctx: BrowserContext) {
  mkdirSync(resolve(".auth"), { recursive: true })
  await ctx.storageState({ path: AUTH_FILE })
}

/**
 * Confirms the cached session still opens a gated page. Sessions expire and a
 * stale file otherwise fails much later, halfway into a take.
 */
export async function cachedSessionWorks(browser: Browser, gatedUrl: string) {
  if (!hasCachedSession()) return false
  const ctx = await browser.newContext({ storageState: AUTH_FILE })
  const page = await ctx.newPage()
  try {
    await page.goto(gatedUrl, { waitUntil: "domcontentloaded" })
    return !page.url().includes("/login")
  } catch {
    return false
  } finally {
    await ctx.close()
  }
}

// ── Encoding ─────────────────────────────────────────────────────────────────

/**
 * Playwright only ever writes VP8/WebM, which Safari will not play — renaming
 * the file to .mp4 (as these scripts used to do) just hides that behind a
 * misleading extension. So every take gets genuinely transcoded to H.264.
 *
 * Playwright's own bundled ffmpeg is stripped down to a VP8 encoder and cannot
 * do it, hence the search for a real build.
 */
function findFfmpeg(): string {
  const candidates = [
    process.env.FFMPEG_PATH,
    "ffmpeg",
    ...(() => {
      const capcut = "C:/Program Files/CapCut/Apps"
      if (!existsSync(capcut)) return []
      return readdirSync(capcut)
        .map((v) => `${capcut}/${v}/ffmpeg.exe`)
        .filter((p) => existsSync(p))
        .reverse() // newest install first
    })(),
  ].filter(Boolean) as string[]

  for (const bin of candidates) {
    try {
      execFileSync(bin, ["-hide_banner", "-version"], { stdio: "ignore" })
      return bin
    } catch {
      /* try the next candidate */
    }
  }
  throw new Error(
    "No usable ffmpeg found. Install one (winget install Gyan.FFmpeg) or set FFMPEG_PATH.",
  )
}

/**
 * Whichever H.264 encoder this ffmpeg ships with, capped to a bitrate a landing
 * page can afford. The hardware encoders all default to a quality target with
 * no ceiling, which on 1280×800 screen capture lands around 8 Mbit/s — a 40 MB
 * card on the homepage. `-maxrate` is the real control; the quality knobs just
 * stop it wasting bits on the long static stretches.
 */
const MAXRATE = "1400k"
const BUFSIZE = "2800k"

function pickEncoder(bin: string): string[] {
  const out = execFileSync(bin, ["-hide_banner", "-encoders"], { encoding: "utf-8" })
  const cap = ["-maxrate", MAXRATE, "-bufsize", BUFSIZE]
  if (out.includes("libx264"))
    return ["-c:v", "libx264", "-preset", "slow", "-crf", "28", ...cap]
  if (out.includes("h264_nvenc"))
    // nvenc ignores -cq unless it is explicitly in VBR mode with no target bitrate
    return ["-c:v", "h264_nvenc", "-preset", "p6", "-rc", "vbr", "-cq", "32", "-b:v", "0", ...cap]
  if (out.includes("h264_qsv"))
    return ["-c:v", "h264_qsv", "-global_quality", "30", ...cap]
  if (out.includes("h264_amf"))
    return ["-c:v", "h264_amf", "-quality", "quality", "-qp_i", "30", ...cap]
  if (out.includes("h264_mf")) return ["-c:v", "h264_mf", "-b:v", MAXRATE]
  throw new Error("This ffmpeg has no H.264 encoder.")
}

/**
 * Turns the raw take Playwright just flushed into the two files the showcase
 * consumes: `{name}.mp4` and a `{name}.jpg` poster pulled out of that same clip
 * (so the still can never drift from the footage).
 *
 * Call this after the context is closed — that is what flushes the .webm.
 */
export function finishTake(outDir: string, name: string, posterAtSeconds: number) {
  const webm = readdirSync(outDir)
    .filter((f) => f.endsWith(".webm"))
    .map((f) => resolve(outDir, f))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0]

  if (!webm) {
    console.warn(`   ⚠️ No .webm found for ${name}`)
    return
  }

  const ffmpeg = findFfmpeg()
  const encoder = pickEncoder(ffmpeg)
  const mp4 = resolve(outDir, `${name}.mp4`)
  const jpg = resolve(outDir, `${name}.jpg`)

  execFileSync(
    ffmpeg,
    [
      "-hide_banner", "-loglevel", "error", "-y",
      "-i", webm,
      ...encoder,
      // 24 fps is plenty for a muted background loop and shaves ~20% off
      "-vf", "fps=24",
      "-g", "48",
      "-pix_fmt", "yuv420p",
      // web delivery: seekable from the first byte, no audio track at all
      "-movflags", "+faststart",
      "-an",
      mp4,
    ],
    { stdio: "inherit" },
  )

  execFileSync(
    ffmpeg,
    [
      "-hide_banner", "-loglevel", "error", "-y",
      "-ss", String(posterAtSeconds),
      "-i", mp4,
      "-frames:v", "1", "-q:v", "4",
      jpg,
    ],
    { stdio: "inherit" },
  )

  rmSync(webm, { force: true })

  // A take that dies mid-walkthrough still leaves its raw .webm behind, and
  // those are ~20 MB each sitting in public/. Sweep them on the way out.
  for (const stray of readdirSync(outDir).filter((f) => f.endsWith(".webm"))) {
    rmSync(resolve(outDir, stray), { force: true })
  }

  console.log(`   💾 Saved: ${mp4} (${Math.round(statSync(mp4).size / 1024)} KB) + poster`)
}
