import { describe, it, expect } from "vitest"
import {
  isChatModel,
  paramsOf,
  pickBestModel,
  rankModels,
  versionOf,
} from "@/lib/ai/model-ranking"
import { AI_PROVIDERS, getProvider } from "@/lib/ai/providers"

const ids = (list: string[]) => list.map((id) => ({ id, label: id }))
const order = (list: string[]) => rankModels(ids(list)).map((m) => m.id)

/**
 * Nothing here may hardcode a model id as "the good one". The catalogue in
 * providers.ts has gone stale twice and broken the AI both times, so the rules
 * are about the SHAPE of an id — version, tier word, parameter count — and a
 * model that ships next week sorts to the top without a code change.
 */
describe("versionOf", () => {
  it("reads the plain and decimal forms", () => {
    expect(versionOf("gpt-5.5")).toBe(5.5)
    expect(versionOf("gemini-3.5-flash")).toBe(3.5)
    expect(versionOf("llama3.1:8b")).toBe(3.1)
    expect(versionOf("mistral-large-3")).toBe(3)
  })

  it("reads Anthropic's dash-separated decimal", () => {
    // The bug this guards: "claude-3-5-sonnet" scored a 5 from its own
    // separator, so the retired 3.5 Sonnet outranked Sonnet 5.
    expect(versionOf("claude-3-5-sonnet-20241022")).toBe(3.5)
    expect(versionOf("claude-sonnet-5")).toBe(5)
    expect(versionOf("claude-opus-4-8")).toBe(4.8)
  })

  it("does not mistake a date or a parameter count for a version", () => {
    expect(versionOf("claude-haiku-4-5-20251001")).toBe(4.5)
    expect(versionOf("llama-3.3-70b-versatile")).toBe(3.3)
    expect(versionOf("mixtral-8x22b")).toBe(0)
  })
})

describe("paramsOf", () => {
  it("reads plain and mixture-of-experts sizes", () => {
    expect(paramsOf("llama3.3:70b")).toBe(70)
    expect(paramsOf("mixtral-8x22b")).toBe(176)
    expect(paramsOf("sonar-pro")).toBe(0)
  })
})

describe("isChatModel", () => {
  it("drops what a chat request would 400 on", () => {
    for (const id of [
      "text-embedding-3-large",
      "whisper-1",
      "dall-e-3",
      "tts-1-hd",
      "omni-moderation-latest",
      "BAAI/bge-reranker-v2-m3",
      "stable-diffusion-xl",
    ]) {
      expect(isChatModel(id), id).toBe(false)
    }
  })

  it("keeps the models we can actually drive", () => {
    for (const id of [
      "gpt-5.5",
      "claude-sonnet-5",
      "gemini-3-pro",
      "meta-llama/Llama-3.3-70B-Instruct-Turbo",
      "llama3.1:8b",
    ]) {
      expect(isChatModel(id), id).toBe(true)
    }
  })
})

describe("rankModels", () => {
  it("puts the newest first, not the alphabetically first", () => {
    // The bug: an alphabetical sort offered gpt-3.5-turbo above gpt-5.
    expect(order(["gpt-3.5-turbo", "gpt-5.5", "gpt-4o", "gpt-4.1"])[0]).toBe(
      "gpt-5.5",
    )
  })

  it("prefers the balanced flagship over the premium variant", () => {
    // Auto-picking the most expensive tier would quietly cost the user money.
    expect(order(["gpt-5.5-pro", "gpt-5.5", "gpt-5.4-mini"])).toEqual([
      "gpt-5.5",
      "gpt-5.5-pro",
      "gpt-5.4-mini",
    ])
  })

  it("ranks a current model above a retired one from the same family", () => {
    expect(
      order([
        "claude-3-5-sonnet-20241022",
        "claude-sonnet-5",
        "claude-3-opus-20240229",
      ])[0],
    ).toBe("claude-sonnet-5")
  })

  it("filters non-chat models out of the list entirely", () => {
    expect(order(["text-embedding-3-large", "gpt-5.5", "dall-e-3"])).toEqual([
      "gpt-5.5",
    ])
  })

  it("is a stable sort, so a picker does not reshuffle between renders", () => {
    const list = ["gpt-5.5", "gpt-4.1", "gpt-4o"]
    expect(order(list)).toEqual(order(list))
  })

  it("prefers a bigger local model at the same version", () => {
    expect(order(["llama3.1:8b", "llama3.1:70b"])[0]).toBe("llama3.1:70b")
  })
})

describe("pickBestModel", () => {
  it("returns null when nothing usable came back, so the caller can fall back", () => {
    expect(pickBestModel([])).toBeNull()
    expect(pickBestModel(ids(["text-embedding-3-large"]))).toBeNull()
  })

  it("picks the newest chat model on offer", () => {
    expect(pickBestModel(ids(["gpt-4o", "gpt-5.5", "whisper-1"]))).toBe("gpt-5.5")
  })
})

/**
 * The catalogue itself. New providers deliberately ship with no model list —
 * live discovery is the source of truth and a hand-written id is what goes
 * stale.
 */
describe("the provider catalogue", () => {
  it("gives every provider a usable fallback model id", () => {
    for (const p of AI_PROVIDERS) {
      expect(p.defaultModel.trim().length, p.id).toBeGreaterThan(0)
    }
  })

  it("has no duplicate ids or base URLs", () => {
    const idSet = new Set(AI_PROVIDERS.map((p) => p.id))
    expect(idSet.size).toBe(AI_PROVIDERS.length)
    const urls = AI_PROVIDERS.map((p) => p.baseUrl)
    expect(new Set(urls).size).toBe(urls.length)
  })

  it("points every cloud provider at an https endpoint and a key page", () => {
    for (const p of AI_PROVIDERS) {
      if (!p.needsKey) continue
      expect(p.baseUrl.startsWith("https://"), p.id).toBe(true)
      expect(p.keyUrl?.startsWith("https://"), p.id).toBe(true)
    }
  })

  it("exposes the providers added for choice", () => {
    for (const id of [
      "together",
      "fireworks",
      "cerebras",
      "qwen",
      "moonshot",
      "zai",
      "sambanova",
      "deepinfra",
      "nebius",
    ]) {
      const p = getProvider(id)
      expect(p, id).not.toBeNull()
      expect(p?.supportsAdvisor, id).toBe(true)
      expect(p?.supportsCompare, id).toBe(true)
      // These read their catalogue live; a hardcoded list here would rot.
      expect(p?.models, id).toHaveLength(0)
    }
  })
})
