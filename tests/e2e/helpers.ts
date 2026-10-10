import { expect, type BrowserContext, type Page } from "@playwright/test"

export const EMAIL = process.env.E2E_EMAIL ?? ""
export const PASSWORD = process.env.E2E_PASSWORD ?? ""
export const API_KEY = process.env.E2E_API_KEY ?? ""

/** Skip the cookie banner and pin Spanish, like a returning visitor. */
export async function prepare(context: BrowserContext, baseURL: string) {
  await context.addCookies([
    { name: "ghs_cookie_consent", value: "rejected", url: baseURL },
    { name: "ghs_locale", value: "es", url: baseURL },
  ])
}

export async function login(page: Page) {
  await page.goto("/login")
  await page.fill("#email", EMAIL)
  await page.fill("#password", PASSWORD)
  await page.press("#password", "Enter")
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20_000 })
}

/** The first player of the directory, by the link on his card. */
export async function firstPlayerHref(page: Page): Promise<string> {
  await page.goto("/players")
  const link = page.locator('a[href^="/players/"]').first()
  await expect(link).toBeVisible()
  return (await link.getAttribute("href"))!
}
