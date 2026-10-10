import { expect, test } from "@playwright/test"
import { API_KEY, EMAIL, firstPlayerHref, login, prepare } from "./helpers"

test.beforeEach(async ({ context, baseURL }) => prepare(context, baseURL!))

test("player profile shows percentiles and a projection", async ({ page }) => {
  const href = await firstPlayerHref(page)
  await page.goto(href)
  await expect(page.getByRole("heading", { name: "Perfil en percentiles" })).toBeVisible()
  await page.getByRole("button", { name: "Por partido" }).click()
  await expect(page.getByText(/pct\. \d+/).first()).toBeVisible()
  await expect(page.getByText("Un nivel más arriba")).toBeVisible()
})

test("projection page learns from real promotions", async ({ page }) => {
  // The fixture promotes Tercera FEB players into Segunda FEB.
  await page.goto("/players?league=eba")
  const href = (await page.locator('a[href^="/players/"]').first().getAttribute("href"))!
  await page.goto(`/projection?player=${href.split("/").pop()}&to=leb-plata`)
  await expect(page.getByText(/Aprendido de \d+ jugadores/).first()).toBeVisible()
  await expect(page.getByRole("table")).toBeVisible()
})

test.describe("signed in", () => {
  test.skip(!EMAIL, "E2E_EMAIL / E2E_PASSWORD not set")

  test("follow a player and find him in Following", async ({ page }) => {
    await login(page)
    const href = await firstPlayerHref(page)
    await page.goto(href)
    const name = (await page.locator("h1").first().textContent())!.trim()
    const follow = page.getByRole("button", { name: "Seguir", exact: true })
    await follow.click()
    await expect(page.getByRole("button", { name: /Siguiendo/ })).toBeVisible()
    await page.goto("/following")
    await expect(page.getByRole("link", { name })).toBeVisible()
  })

  test("shortlist: create, add, move, comment, export and share read-only", async ({ page, browser, baseURL }) => {
    await login(page)
    const listName = `E2E ${Date.now()}`
    await page.goto("/shortlists")
    await page.getByLabel("Nombre").fill(listName)
    await page.getByRole("button", { name: "Nueva shortlist" }).click()
    await page.waitForURL(/\/shortlists\/[0-9a-f-]{36}/)
    await expect(page.getByRole("heading", { name: listName })).toBeVisible()

    // Add a player through the picker.
    const found = await page.request.get("/api/compare/players/search?q=ar&limit=1")
    const { results } = (await found.json()) as { results: Array<{ fullName: string }> }
    const picker = page.getByRole("combobox", { name: "Añadir jugador" })
    await picker.fill(results[0]!.fullName.slice(0, 6))
    await page.getByRole("listbox").getByRole("option").first().click()
    await expect(page.locator("article").first()).toBeVisible()

    // Move it to "Objetivo" and leave a comment.
    await page.locator("article select").first().selectOption("target")
    await page.getByPlaceholder("Escribe una nota para el staff…").fill("Revisar defensa en pick and roll")
    await page.getByRole("button", { name: "Publicar" }).click()
    await expect(page.getByText("Revisar defensa en pick and roll")).toBeVisible()

    // CSV export is a real attachment with a header row.
    const listUrl = page.url()
    const csv = await page.request.get(`${listUrl.replace("/shortlists/", "/api/shortlists/")}/export`)
    expect(csv.status()).toBe(200)
    expect(csv.headers()["content-type"]).toContain("text/csv")
    expect(await csv.text()).toContain(`"player","slug","status"`)

    // A read-only link opens for an anonymous visitor, without staff notes.
    const id = listUrl.split("/").pop()!
    const share = await page.request.post("/api/shares", {
      data: { kind: "shortlist", ref: id, days: 7 },
      headers: { origin: baseURL! },
    })
    expect(share.status()).toBe(201)
    const { url } = (await share.json()) as { url: string }
    const anon = await browser.newContext()
    const anonPage = await anon.newPage()
    await anonPage.goto(new URL(new URL(url).pathname, baseURL).href)
    await expect(anonPage.getByRole("heading", { name: listName })).toBeVisible()
    await expect(anonPage.getByText("Objetivo")).toBeVisible()
    await expect(anonPage.getByText("Revisar defensa en pick and roll")).toHaveCount(0)
    await anon.close()
  })
})

test.describe("public API", () => {
  test("rejects a missing key and serves data with a valid one", async ({ request }) => {
    const denied = await request.get("/api/v1/leagues")
    expect(denied.status()).toBe(401)
    test.skip(!API_KEY, "E2E_API_KEY not set")
    const res = await request.get("/api/v1/players?league=acb&limit=3", {
      headers: { authorization: `Bearer ${API_KEY}` },
    })
    expect(res.status()).toBe(200)
    const body = (await res.json()) as { data: unknown[]; meta: { league: string; attribution: string } }
    expect(body.data.length).toBe(3)
    expect(body.meta.league).toBe("acb")
    expect(body.meta.attribution).toContain("globalhoopstats")
    expect(res.headers()["x-ratelimit-remaining"]).toBeDefined()
  })
})
