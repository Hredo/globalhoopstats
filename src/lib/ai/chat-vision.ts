import type { AiProvider } from "@/lib/ai/providers"

const TIMEOUT_MS = 180_000

export type VisionImage = {
  data: string
  mediaType: string
}

export type VisionInput = {
  provider: AiProvider
  model: string
  apiKey: string | null
  system: string
  messages: Array<{ role: "user" | "assistant"; content: string }>
  images: VisionImage[]
  maxTokens?: number
  temperature?: number
}

export type VisionResult =
  | { ok: true; content: string }
  | { ok: false; error: string }

async function withTimeout<T>(
  fn: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    return await fn(controller.signal)
  } finally {
    clearTimeout(timer)
  }
}

/** OpenAI-compatible vision (OpenAI, Groq, DeepSeek, xAI, Mistral, etc.) */
async function visionOpenAiCompatible(
  input: VisionInput,
): Promise<VisionResult> {
  if (!input.apiKey) return { ok: false, error: "Missing API key." }

  const content: unknown[] = []
  for (const msg of input.messages) {
    content.push({ type: "text", text: msg.content })
  }
  for (const img of input.images) {
    content.push({
      type: "image_url",
      image_url: { url: `data:${img.mediaType};base64,${img.data}` },
    })
  }

  return withTimeout(async (signal) => {
    const res = await fetch(`${input.provider.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${input.apiKey}`,
      },
      signal,
      body: JSON.stringify({
        model: input.model,
        messages: [
          { role: "system", content: input.system },
          { role: "user", content },
        ],
        max_tokens: input.maxTokens ?? 2000,
        temperature: input.temperature ?? 0.3,
        stream: false,
      }),
    })
    if (!res.ok) {
      const detail = (await res.text().catch(() => "")).slice(0, 300)
      return { ok: false, error: `${input.provider.name} ${res.status}: ${detail || res.statusText}` }
    }
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const contentText = json.choices?.[0]?.message?.content?.trim()
    if (!contentText) return { ok: false, error: "Empty response." }
    return { ok: true, content: contentText }
  })
}

/** Anthropic Claude vision */
async function visionAnthropic(input: VisionInput): Promise<VisionResult> {
  if (!input.apiKey) return { ok: false, error: "Missing API key." }

  const content: unknown[] = []
  for (const msg of input.messages) {
    content.push({ type: "text", text: msg.content })
  }
  for (const img of input.images) {
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: img.mediaType,
        data: img.data,
      },
    })
  }

  return withTimeout(async (signal) => {
    const res = await fetch(`${input.provider.baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": input.apiKey as string,
        "anthropic-version": "2023-06-01",
      },
      signal,
      body: JSON.stringify({
        model: input.model,
        max_tokens: input.maxTokens ?? 2000,
        temperature: input.temperature ?? 0.3,
        system: input.system,
        messages: [{ role: "user", content }],
      }),
    })
    if (!res.ok) {
      const detail = (await res.text().catch(() => "")).slice(0, 300)
      return { ok: false, error: `Anthropic ${res.status}: ${detail || res.statusText}` }
    }
    const json = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>
    }
    const text = json.content
      ?.filter((b) => b.type === "text" && b.text)
      .map((b) => b.text)
      .join("")
      .trim()
    if (!text) return { ok: false, error: "Empty response." }
    return { ok: true, content: text }
  })
}

/** Google Gemini vision */
async function visionGoogle(input: VisionInput): Promise<VisionResult> {
  if (!input.apiKey) return { ok: false, error: "Missing API key." }

  const parts: unknown[] = []
  for (const msg of input.messages) {
    parts.push({ text: msg.content })
  }
  for (const img of input.images) {
    parts.push({
      inlineData: { mimeType: img.mediaType, data: img.data },
    })
  }

  const url = `${input.provider.baseUrl}/models/${encodeURIComponent(
    input.model,
  )}:generateContent?key=${encodeURIComponent(input.apiKey)}`

  return withTimeout(async (signal) => {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: input.system }] },
        contents: [{ role: "user", parts }],
        generationConfig: {
          maxOutputTokens: input.maxTokens ?? 2000,
          temperature: input.temperature ?? 0.3,
        },
      }),
    })
    if (!res.ok) {
      const detail = (await res.text().catch(() => "")).slice(0, 300)
      return { ok: false, error: `Gemini ${res.status}: ${detail || res.statusText}` }
    }
    const json = (await res.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> }
      }>
    }
    const text = json.candidates?.[0]?.content?.parts
      ?.map((p) => p.text ?? "")
      .join("")
      .trim()
    if (!text) return { ok: false, error: "Empty response." }
    return { ok: true, content: text }
  })
}

export async function chatCompleteVision(
  input: VisionInput,
): Promise<VisionResult> {
  try {
    switch (input.provider.kind) {
      case "anthropic":
        return await visionAnthropic(input)
      case "google":
        return await visionGoogle(input)
      case "openai":
      case "openai-compat":
      case "local":
        return await visionOpenAiCompatible(input)
      default:
        return { ok: false, error: "Vision not supported for this provider." }
    }
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return { ok: false, error: "The model took too long to respond." }
    }
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown vision error.",
    }
  }
}
