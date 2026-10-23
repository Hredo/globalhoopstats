import { afterEach, describe, expect, it, vi } from "vitest"
import {
  FetchError,
  fetchText,
  isRetryable,
  minIntervalFor,
} from "@/lib/sources/fetcher"

describe("fetcher politeness", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("keeps basketball-reference under its 20 requests/minute limit", () => {
    expect(
      60_000 / minIntervalFor("www.basketball-reference.com"),
    ).toBeLessThanOrEqual(20)
    expect(minIntervalFor("www.acb.com")).toBe(1200)
  })

  it("does not retry a 4xx answer except 408 and 429", () => {
    expect(isRetryable(new FetchError("x", 403))).toBe(false)
    expect(isRetryable(new FetchError("x", 404))).toBe(false)
    expect(isRetryable(new FetchError("x", 408))).toBe(true)
    expect(isRetryable(new FetchError("x", 429))).toBe(true)
    expect(isRetryable(new FetchError("x", 502))).toBe(true)
    expect(isRetryable(new Error("timeout"))).toBe(true)
  })

  it("fails a 403 after one request and names the host", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response("blocked", { status: 403, statusText: "Forbidden" }),
    )
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      fetchText("https://blocked.example.test/page.html"),
    ).rejects.toThrow("HTTP 403 Forbidden from blocked.example.test")
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
