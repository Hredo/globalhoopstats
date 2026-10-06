/**
 * Shared plumbing for the homepage showcase recorders
 * (scripts/record-showcase.ts).
 *
 * Everything here is about getting a clean, publishable file out of Playwright;
 * the interesting part — what each demo actually does on screen — stays in the
 * per-feature scripts.
 */

import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs"
import { writeFile } from "node:fs/promises"
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
  /* chrome that has no business in a marketing clip: the cookie notice, the
     floating theme switch, and Next's dev-mode badge (the old takes had its
     "N" in every corner because they were recorded against "pnpm dev") */
  [aria-label="Cookie notice"],
  [aria-label="Aviso de cookies"],
  [data-capture-hide],
  nextjs-portal { display: none !important; }
  /* the account's own advisor conversations: private, and not the product */
  aside[aria-label="Conversations"] li { filter: blur(26px) !important; }
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
const MAXRATE = "2200k"
const BUFSIZE = "4400k"

function pickEncoder(bin: string): string[] {
  const out = execFileSync(bin, ["-hide_banner", "-encoders"], { encoding: "utf-8" })
  const cap = ["-maxrate", MAXRATE, "-bufsize", BUFSIZE]
  if (out.includes("libx264"))
    // stillimage: UI capture is flat colour and sharp type, not film grain
    return ["-c:v", "libx264", "-preset", "slow", "-tune", "stillimage", "-crf", "23", ...cap]
  if (out.includes("h264_nvenc"))
    // nvenc ignores -cq unless it is explicitly in VBR mode with no target bitrate
    return ["-c:v", "h264_nvenc", "-preset", "p7", "-tune", "hq", "-rc", "vbr", "-cq", "26", "-b:v", "0", ...cap]
  if (out.includes("h264_qsv"))
    return ["-c:v", "h264_qsv", "-global_quality", "30", ...cap]
  if (out.includes("h264_amf"))
    return ["-c:v", "h264_amf", "-quality", "quality", "-qp_i", "30", ...cap]
  if (out.includes("h264_mf")) return ["-c:v", "h264_mf", "-b:v", MAXRATE]
  throw new Error("This ffmpeg has no H.264 encoder.")
}

// ── Frame capture ────────────────────────────────────────────────────────────

/**
 * A take recorded as individual JPEG frames, bypassing `recordVideo`.
 *
 * Playwright's own recorder encodes VP8 at a fixed 1 Mbit/s whatever size it
 * is asked for, so a 2560×1600 capture comes out as mush before ffmpeg ever
 * sees it — that, more than the final bitrate, is why the old clips smeared
 * text. The screencast API hands over each frame as the compositor produced
 * it; they are written to disk with their arrival time and encoded once, at
 * the quality the final file deserves.
 */
export type FrameTake = {
  dir: string
  /** ms since epoch at which each frame arrived, in order. */
  times: number[]
  stop: () => Promise<void>
}

export async function captureFrames(
  page: Page,
  size: { width: number; height: number },
  dir: string,
): Promise<FrameTake> {
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  const times: number[] = []
  const pending: Promise<void>[] = []
  await page.screencast.start({
    size,
    quality: 92,
    onFrame: ({ data }) => {
      const i = times.length
      times.push(Date.now())
      pending.push(writeFile(resolve(dir, `f${String(i).padStart(6, "0")}.jpg`), data))
    },
  })
  return {
    dir,
    times,
    stop: async () => {
      await page.screencast.stop()
      await Promise.all(pending)
    },
  }
}

/**
 * Encodes a frame take into `{name}.mp4` + `{name}.jpg` poster. Each frame is
 * held until the next one arrived (the screencast only emits on change), and
 * the result is resampled to a constant 30 fps.
 */
export function encodeTake(
  take: FrameTake,
  outDir: string,
  name: string,
  posterAtSeconds: number,
  { trimFrom, width = 1600 }: { trimFrom: number; width?: number },
) {
  const { times, dir } = take
  if (times.length < 2) throw new Error(`${name}: the screencast produced no frames.`)
  const end = times[times.length - 1] + 1000 / 30
  const lines: string[] = []
  let first = true
  for (let i = 0; i < times.length; i++) {
    const until = i + 1 < times.length ? times[i + 1] : end
    if (until <= trimFrom) continue
    const from = first ? trimFrom : times[i]
    first = false
    lines.push(`file 'f${String(i).padStart(6, "0")}.jpg'`, `duration ${((until - from) / 1000).toFixed(4)}`)
  }
  // The concat demuxer ignores the last duration unless the file repeats.
  lines.push(lines[lines.length - 2])
  const list = resolve(dir, "frames.txt")
  writeFileSync(list, lines.join("\n"))

  const ffmpeg = findFfmpeg()
  const mp4 = resolve(outDir, `${name}.mp4`)
  const jpg = resolve(outDir, `${name}.jpg`)
  execFileSync(
    ffmpeg,
    [
      "-hide_banner", "-loglevel", "error", "-y",
      "-f", "concat", "-safe", "0", "-i", list,
      ...pickEncoder(ffmpeg),
      "-vf", `scale=${width}:-2:flags=lanczos,fps=30`,
      "-g", "60",
      "-pix_fmt", "yuv420p",
      "-movflags", "+faststart",
      "-an",
      mp4,
    ],
    { stdio: "inherit" },
  )
  execFileSync(
    ffmpeg,
    ["-hide_banner", "-loglevel", "error", "-y", "-ss", String(posterAtSeconds), "-i", mp4, "-frames:v", "1", "-q:v", "3", jpg],
    { stdio: "inherit" },
  )
  rmSync(dir, { recursive: true, force: true })
  console.log(`   💾 ${name}.mp4 (${Math.round(statSync(mp4).size / 1024)} KB) + poster`)
}
