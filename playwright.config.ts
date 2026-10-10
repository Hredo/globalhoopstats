import { defineConfig, devices } from "@playwright/test"

/**
 * End-to-end tests against a running app backed by the SYNTHETIC fixture
 * (scripts/seed-fixture.ts) — never production. CI starts MySQL, seeds it,
 * builds and starts the app, then runs this. Locally:
 *
 *   E2E_BASE_URL=http://localhost:3100 E2E_EMAIL=… E2E_PASSWORD=… E2E_API_KEY=… pnpm test:e2e
 */
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    locale: "es-ES",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /navigation\.spec\.ts/ },
  ],
})
