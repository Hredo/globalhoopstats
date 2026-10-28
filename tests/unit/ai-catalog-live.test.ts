import { describe, it, expect } from "vitest"
import { summariseModelsDev } from "@/lib/ai/catalog-live"
import { adaptToRejection } from "@/lib/ai/chat"
import { isAuthFailure } from "@/lib/ai/models"
import {
  AI_PROVIDERS,
  catalogIdFor,
  getProvider,
  modelPageUrl,
} from "@/lib/ai/providers"

const anthropic = getProvider("anthropic")!
const together = getProvider("together")!

describe("summariseModelsDev", () => {
  const raw = {
    anthropic: {
      models: {
        "claude-old": { name: "Old", release_date: "2024-01-01" },
        "claude-new": {
          name: "New",
          release_date: "2026-10-07",
          reasoning: true,
          limit: { context: 1_000_000 },
          cost: { input: 2, output: 10 },
        },
        "claude-retired": {
          name: "Retired",
          release_date: "2026-10-20",
          status: "deprecated",
        },
        "text-embedding-x": { name: "Embed", release_date: "2026-10-25" },
        "claude-image": {
          name: "Image",
          release_date: "2026-10-26",
          modalities: { output: ["image"] },
        },
      },
    },
    // Our id "together" is "togetherai" on models.dev.
    togetherai: {
      models: { "deepseek-ai/X": { name: "X", release_date: "2026-09-01" } },
    },
  }

  it("lists the newest chat models first and skips retired and non-chat ones", () => {
    const out = summariseModelsDev(raw, [anthropic, together])
    expect(out.providers.anthropic.latest.map((m) => m.id)).toEqual([
      "claude-new",
      "claude-old",
    ])
    expect(out.providers.anthropic.modelCount).toBe(2)
    expect(out.providers.anthropic.latest[0]).toMatchObject({
      name: "New",
      reasoning: true,
      contextTokens: 1_000_000,
      priceIn: 2,
      priceOut: 10,
    })
  })

  it("maps our provider ids onto models.dev's", () => {
    const out = summariseModelsDev(raw, [anthropic, together])
    expect(out.providers.together.latest[0].id).toBe("deepseek-ai/X")
  })

  it("survives a malformed document", () => {
    expect(summariseModelsDev(null).providers).toEqual({})
    expect(summariseModelsDev({ anthropic: { models: 7 } }).providers).toEqual(
      {},
    )
  })
})

describe("adaptToRejection", () => {
  const body = {
    model: "gpt-6.1-terra",
    max_tokens: 700,
    temperature: 0.6,
    frequency_penalty: 0.4,
    presence_penalty: 0.1,
  }

  it("renames max_tokens when OpenAI asks for max_completion_tokens", () => {
    const next = adaptToRejection(
      body,
      "Unsupported parameter: 'max_tokens' is not supported with this model. Use 'max_completion_tokens' instead.",
    )
    expect(next).toMatchObject({ max_completion_tokens: 700 })
    expect(next).not.toHaveProperty("max_tokens")
  })

  it("drops a temperature the model refuses", () => {
    const next = adaptToRejection(
      body,
      "Unsupported value: 'temperature' does not support 0.6 with this model.",
    )
    expect(next).not.toHaveProperty("temperature")
    expect(next).toMatchObject({ model: "gpt-6.1-terra", max_tokens: 700 })
  })

  it("drops the penalties together", () => {
    const next = adaptToRejection(body, "presence_penalty is not supported")
    expect(next).not.toHaveProperty("presence_penalty")
    expect(next).not.toHaveProperty("frequency_penalty")
  })

  it("gives up on a 400 about anything else", () => {
    expect(adaptToRejection(body, "model gpt-x does not exist")).toBeNull()
  })

  it("never touches the model or messages", () => {
    let current: Record<string, unknown> | null = { ...body, messages: [1] }
    for (const detail of ["penalty", "max_tokens", "temperature"]) {
      current = adaptToRejection(current!, detail)
      expect(current).toMatchObject({ model: "gpt-6.1-terra", messages: [1] })
    }
  })
})

describe("isAuthFailure", () => {
  it("recognises credential errors whatever the status", () => {
    expect(isAuthFailure(401, "")).toBe(true)
    expect(isAuthFailure(403, "")).toBe(true)
    expect(
      isAuthFailure(400, "Google 400: API key not valid. API_KEY_INVALID"),
    ).toBe(true)
    expect(isAuthFailure(undefined, "Incorrect API key provided")).toBe(true)
  })

  it("does not blame the key for other failures", () => {
    expect(isAuthFailure(404, "Perplexity 404: Not Found")).toBe(false)
    expect(isAuthFailure(429, "rate limit exceeded")).toBe(false)
    expect(
      isAuthFailure(undefined, "The provider took too long to answer."),
    ).toBe(false)
  })
})

describe("provider links", () => {
  it("gives every provider https docs and key links", () => {
    for (const p of AI_PROVIDERS) {
      expect(p.docsUrl, p.id).toMatch(/^https:\/\//)
      if (p.keyUrl) expect(p.keyUrl, p.id).toMatch(/^https:\/\//)
      if (p.pricingUrl) expect(p.pricingUrl, p.id).toMatch(/^https:\/\//)
    }
  })

  it("builds per-model pages where the vendor has them, else its model list", () => {
    expect(
      modelPageUrl(getProvider("openrouter")!, "anthropic/claude-sonnet-5.5"),
    ).toBe("https://openrouter.ai/anthropic/claude-sonnet-5.5")
    expect(modelPageUrl(getProvider("ollama")!, "qwen3:8b")).toBe(
      "https://ollama.com/library/qwen3",
    )
    expect(modelPageUrl(anthropic, "claude-sonnet-5-5")).toBe(anthropic.docsUrl)
  })

  it("keeps models.dev ids unique so no two providers read the same entry", () => {
    const ids = AI_PROVIDERS.map(catalogIdFor)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
