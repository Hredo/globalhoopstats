import { describe, it, expect } from "vitest"
import {
  AI_PROVIDERS,
  getProvider,
  isPlausibleModelId,
  resolveModel,
} from "@/lib/ai/providers"

const ollama = getProvider("ollama")!
const openai = getProvider("openai")!

describe("resolveModel", () => {
  it("keeps a model that belongs to the provider's catalogue", () => {
    expect(resolveModel(openai, openai.models[1].id)).toBe(openai.models[1].id)
  })

  it("falls back to the default for a cloud model that is not in the catalogue", () => {
    expect(resolveModel(openai, "not-a-real-model")).toBe(openai.defaultModel)
    expect(resolveModel(openai, null)).toBe(openai.defaultModel)
  })

  it("accepts any installed tag for a local engine", () => {
    // The regression that silently killed the advisor: a locally installed
    // model was snapped back to the catalogue default, so the request went out
    // for a model the machine had never pulled and Ollama answered 404.
    expect(resolveModel(ollama, "llama3.2:latest")).toBe("llama3.2:latest")
    expect(resolveModel(ollama, "hf.co/user/some-model:Q4_K_M")).toBe(
      "hf.co/user/some-model:Q4_K_M",
    )
    expect(resolveModel(ollama, "qwen2.5-coder:7b")).toBe("qwen2.5-coder:7b")
  })

  it("still rejects a nonsense tag for a local engine", () => {
    expect(resolveModel(ollama, "  ")).toBe(ollama.defaultModel)
    expect(resolveModel(ollama, "bad model; drop table")).toBe(
      ollama.defaultModel,
    )
    expect(resolveModel(ollama, "a".repeat(200))).toBe(ollama.defaultModel)
  })

  it("migrates retired cloud model ids to their replacement", () => {
    const migrated = resolveModel(openai, "gpt-4o")
    expect(openai.models.some((m) => m.id === migrated)).toBe(true)
  })
})

describe("provider catalogue", () => {
  it("gives every provider a default model that is in its own list", () => {
    for (const p of AI_PROVIDERS) {
      expect(
        p.models.some((m) => m.id === p.defaultModel),
        `${p.id} default model ${p.defaultModel} is missing from its catalogue`,
      ).toBe(true)
    }
  })

  it("only marks local engines as accepting custom models", () => {
    for (const p of AI_PROVIDERS) {
      if (p.allowCustomModels) expect(p.kind).toBe("local")
    }
  })
})

describe("isPlausibleModelId", () => {
  it("accepts the tag shapes real providers use", () => {
    for (const id of [
      "gpt-5.5",
      "claude-sonnet-5",
      "meta-llama/llama-4-scout-17b-16e-instruct",
      "llama3.1:8b",
      "deepseek-r1:8b",
    ]) {
      expect(isPlausibleModelId(id), id).toBe(true)
    }
  })

  it("rejects whitespace and shell/URL metacharacters", () => {
    for (const id of ["", " ", "a b", "model?x=1", "model&y", "../etc", "a\nb"]) {
      expect(isPlausibleModelId(id), JSON.stringify(id)).toBe(false)
    }
  })
})
