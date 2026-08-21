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

  it("uses the default only when nothing has been chosen", () => {
    expect(resolveModel(openai, null)).toBe(openai.defaultModel)
    expect(resolveModel(openai, "")).toBe(openai.defaultModel)
    expect(resolveModel(openai, "   ")).toBe(openai.defaultModel)
  })

  it("passes a cloud model through even when the catalogue has not heard of it", () => {
    // The catalogue is hand-written and goes stale. Substituting a different
    // model hides the problem — and when the catalogue's own default is the
    // stale one (Groq, Aug 2026: `meta-llama/llama-4-scout-17b-16e-instruct`
    // returned model_not_found) the substitution IS the outage. Passing the
    // user's pick through gives them an actionable error instead.
    expect(resolveModel(openai, "gpt-6-turbo")).toBe("gpt-6-turbo")
    expect(
      resolveModel(getProvider("groq")!, "moonshotai/kimi-k2-instruct"),
    ).toBe("moonshotai/kimi-k2-instruct")
  })

  it("accepts any installed tag for a local engine", () => {
    expect(resolveModel(ollama, "llama3.2:latest")).toBe("llama3.2:latest")
    expect(resolveModel(ollama, "hf.co/user/some-model:Q4_K_M")).toBe(
      "hf.co/user/some-model:Q4_K_M",
    )
    expect(resolveModel(ollama, "qwen2.5-coder:7b")).toBe("qwen2.5-coder:7b")
  })

  it("still rejects a value that is not shaped like a model id", () => {
    for (const provider of [ollama, openai]) {
      expect(resolveModel(provider, "bad model; drop table")).toBe(
        provider.defaultModel,
      )
      expect(resolveModel(provider, "a".repeat(200))).toBe(
        provider.defaultModel,
      )
      expect(resolveModel(provider, "../../etc/passwd")).toBe(
        provider.defaultModel,
      )
    }
  })

  it("migrates retired cloud model ids to their replacement", () => {
    // A known rename still wins over pass-through: that mapping is deliberate.
    const migrated = resolveModel(openai, "gpt-4o")
    expect(migrated).not.toBe("gpt-4o")
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

  it("never migrates a model id onto one that is not in the catalogue", () => {
    // A migration whose target no longer exists silently converts a
    // possibly-valid choice into a definitely-broken one. That is how the Groq
    // entry behaved: it pointed at a model the vendor had retired.
    const catalogue = new Set(
      AI_PROVIDERS.flatMap((p) => p.models.map((m) => m.id)),
    )
    for (const p of AI_PROVIDERS) {
      for (const { id } of p.models) {
        // A catalogue id must never itself be a migration source.
        expect(
          resolveModel(p, id),
          `${p.id}: ${id} is both a catalogue entry and a migration source`,
        ).toBe(id)
      }
    }
    expect(catalogue.size).toBeGreaterThan(0)
  })

  it("does not offer the Groq model that upstream retired", () => {
    const groq = getProvider("groq")!
    const dead = "meta-llama/llama-4-scout-17b-16e-instruct"
    expect(groq.models.some((m) => m.id === dead)).toBe(false)
    expect(groq.defaultModel).not.toBe(dead)
    // And nothing migrates onto it either.
    expect(resolveModel(groq, "llama-3.1-8b-instant")).not.toBe(dead)
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
