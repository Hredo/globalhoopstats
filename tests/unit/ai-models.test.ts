import { describe, it, expect, vi, afterEach } from "vitest"
import { listProviderModels } from "@/lib/ai/models"
import { getProvider } from "@/lib/ai/providers"

const groq = getProvider("groq")!
const anthropic = getProvider("anthropic")!
const google = getProvider("google")!
const ollama = getProvider("ollama")!

function jsonOnce(body: unknown, ok = true, status = 200) {
  return vi.fn(async () => ({
    ok,
    status,
    statusText: ok ? "OK" : "Bad Request",
    json: async () => body,
    text: async () => JSON.stringify(body),
  })) as unknown as typeof fetch
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("listProviderModels", () => {
  it("reads the OpenAI-compatible shape", async () => {
    vi.stubGlobal(
      "fetch",
      jsonOnce({
        data: [{ id: "llama-3.3-70b-versatile" }, { id: "qwen/qwen3-32b" }],
      }),
    )
    const res = await listProviderModels(groq, "gsk_test")
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.models.map((m) => m.id)).toEqual([
      "llama-3.3-70b-versatile",
      "qwen/qwen3-32b",
    ])
  })

  it("reads the Anthropic shape and keeps display names", async () => {
    vi.stubGlobal(
      "fetch",
      jsonOnce({
        data: [{ id: "claude-sonnet-5", display_name: "Claude Sonnet 5" }],
      }),
    )
    const res = await listProviderModels(anthropic, "sk-ant-test")
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.models[0]).toEqual({
      id: "claude-sonnet-5",
      label: "Claude Sonnet 5",
    })
  })

  it("strips the models/ prefix and drops non-chat Gemini models", async () => {
    vi.stubGlobal(
      "fetch",
      jsonOnce({
        models: [
          {
            name: "models/gemini-3.5-flash",
            displayName: "Gemini 3.5 Flash",
            supportedGenerationMethods: ["generateContent"],
          },
          {
            name: "models/text-embedding-004",
            displayName: "Embedding",
            supportedGenerationMethods: ["embedContent"],
          },
        ],
      }),
    )
    const res = await listProviderModels(google, "AIzaTestKey")
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.models.map((m) => m.id)).toEqual(["gemini-3.5-flash"])
  })

  it("surfaces an upstream failure instead of throwing", async () => {
    vi.stubGlobal(
      "fetch",
      jsonOnce({ error: { message: "invalid api key" } }, false, 401),
    )
    const res = await listProviderModels(groq, "gsk_bad")
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.status).toBe(401)
    expect(res.error).toContain("401")
  })

  it("refuses a cloud provider with no key", async () => {
    const res = await listProviderModels(groq, null)
    expect(res.ok).toBe(false)
  })

  it("drops ids that are not shaped like model ids", async () => {
    vi.stubGlobal(
      "fetch",
      jsonOnce({ data: [{ id: "good-model" }, { id: "bad id with spaces" }, { id: "" }] }),
    )
    const res = await listProviderModels(groq, "gsk_test")
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.models.map((m) => m.id)).toEqual(["good-model"])
  })

  it("de-duplicates repeated ids", async () => {
    vi.stubGlobal(
      "fetch",
      jsonOnce({ data: [{ id: "dup" }, { id: "dup" }, { id: "other" }] }),
    )
    const res = await listProviderModels(groq, "gsk_test")
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.models.map((m) => m.id)).toEqual(["dup", "other"])
  })

  it("reaches a local engine without a key", async () => {
    vi.stubGlobal("fetch", jsonOnce({ data: [{ id: "llama3.1:8b" }] }))
    const res = await listProviderModels(ollama, null)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.models.map((m) => m.id)).toEqual(["llama3.1:8b"])
  })

  it("turns a transport error into a result rather than an exception", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("ECONNREFUSED")
      }) as unknown as typeof fetch,
    )
    const res = await listProviderModels(groq, "gsk_test")
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.error).toContain("ECONNREFUSED")
  })
})
