import { expect, test } from "@playwright/test"
import { prepare } from "./helpers"

test.beforeEach(async ({ context, baseURL }) => prepare(context, baseURL!))

test("every navigation destination is reachable and renders", async ({ page, isMobile }) => {
  await page.goto("/players")
  if (isMobile) {
    await page.getByRole("button", { name: "Abrir menú" }).click()
    const sheet = page.locator("#mobile-nav-panel")
    await expect(sheet).toBeVisible()
    for (const label of ["Jugadores", "Equipos", "Comparar", "Proyección", "Shortlists", "Siguiendo", "Pizarra"]) {
      await expect(sheet.getByRole("link", { name: new RegExp(label) })).toBeVisible()
    }
    await sheet.getByRole("link", { name: /Proyección/ }).click()
    await expect(page).toHaveURL(/\/projection/)
    await expect(page.locator("#mobile-nav-panel")).toHaveCount(0)
    return
  }
  for (const [group, item, path] of [
    ["Explorar", "Equipos", "/teams"],
    ["Analizar", "Proyección", "/projection"],
    ["Analizar", "Comparar", "/compare"],
  ] as const) {
    await page.getByRole("button", { name: group }).click()
    await page.locator("#nav-panel").getByRole("link", { name: new RegExp(item) }).click()
    await expect(page).toHaveURL(new RegExp(path))
    await expect(page.locator("h1").first()).toBeVisible()
  }
})

test("Escape closes the navigation panel", async ({ page, isMobile }) => {
  test.skip(isMobile, "desktop panels only")
  await page.goto("/")
  const trigger = page.getByRole("button", { name: "Analizar" })
  await trigger.click()
  await expect(trigger).toHaveAttribute("aria-expanded", "true")
  await page.keyboard.press("Escape")
  await expect(trigger).toHaveAttribute("aria-expanded", "false")
})

test("developers page documents the API", async ({ page }) => {
  await page.goto("/developers")
  await expect(page.getByText("GET /api/v1/players/{slug}")).toBeVisible()
})
