/**
 * Catalogue of AI providers the app can drive for the AI Advisor and AI
 * Compare features. Single source of truth shared by:
 *  - the account "AI & keys" manager (list + key inputs)
 *  - the per-feature engine picker (settings)
 *  - the chat dispatcher (lib/ai/chat.ts)
 *  - the public setup guide (/ai-setup)
 *
 * No secrets and no React here — just static metadata.
 */

export type ProviderKind =
  | "openai" // native OpenAI Chat Completions
  | "openai-compat" // OpenAI-compatible /chat/completions (Groq, Mistral, …)
  | "anthropic" // Claude Messages API
  | "google" // Gemini generateContent
  | "local" // user's own machine (Ollama) — no key needed

export type AiModel = {
  id: string
  label: string
}

export type AiProvider = {
  id: string
  name: string
  /** One-line description shown in the catalogue. */
  blurb: string
  kind: ProviderKind
  /** Base URL for the HTTP API. Local providers resolve it from env at call time. */
  baseUrl: string
  /** Whether the user must paste an API key (false for local engines). */
  needsKey: boolean
  /** Expected key prefix, for a soft client-side sanity check. */
  keyPrefix?: string
  /** Where to create the key (console URL), surfaced in the UI and the guide. */
  keyUrl?: string
  models: AiModel[]
  defaultModel: string
  /**
   * True for engines whose model list comes from the user's own machine rather
   * than from an account with the vendor. Drives how the picker labels and
   * sources its options; `resolveModel` passes through a plausible id for every
   * provider, local or not.
   */
  allowCustomModels?: boolean
  supportsAdvisor: boolean
  supportsCompare: boolean
  /** Short, ordered "how to connect" steps for the setup guide. */
  guide: string[]
  /** Accent color (hex) for the provider chip/logo. */
  accent: string
}

export const AI_PROVIDERS: AiProvider[] = [
  {
    id: "ollama",
    name: "Ollama (local)",
    blurb:
      "Cualquier modelo que tengas instalado en tu máquina. Privado, sin clave, sin coste.",
    kind: "local",
    baseUrl: "http://localhost:11434/v1",
    needsKey: false,
    keyUrl: "https://ollama.com/download",
    // Suggestions only. The picker replaces these with the tags actually
    // installed on the machine, and `allowCustomModels` lets any of them
    // through — a model that is not in this list is not an invalid model.
    models: [
      { id: "llama3.1:8b", label: "Llama 3.1 8B" },
      { id: "qwen3:8b", label: "Qwen 3 8B" },
      { id: "gemma3:12b", label: "Gemma 3 12B" },
      { id: "llama3.3:70b", label: "Llama 3.3 70B" },
      { id: "mistral-small:24b", label: "Mistral Small 24B" },
      { id: "deepseek-r1:8b", label: "DeepSeek R1 8B (light)" },
    ],
    // Matches the tag the setup guide tells users to pull. Only used when the
    // machine reports no installed models at all.
    defaultModel: "llama3.1:8b",
    allowCustomModels: true,
    supportsAdvisor: true,
    supportsCompare: true,
    accent: "#9ca3af",
    guide: [
      "Install the Ollama app from ollama.com/download.",
      "Pull a model in your terminal: ollama pull llama3.1:8b",
      "Make sure Ollama is running (the app, or `ollama serve`).",
      "Pick “Ollama (local)” here — we detect it automatically, no key needed.",
    ],
  },
  {
    id: "openai",
    name: "OpenAI",
    blurb: "GPT-5.5 — el modelo más avanzado de OpenAI con 1M de contexto.",
    kind: "openai",
    baseUrl: "https://api.openai.com/v1",
    needsKey: true,
    keyPrefix: "sk-",
    keyUrl: "https://platform.openai.com/api-keys",
    models: [
      { id: "gpt-5.5", label: "GPT-5.5 (latest flagship)" },
      { id: "gpt-5.5-pro", label: "GPT-5.5 Pro (máxima capacidad)" },
      { id: "gpt-5.4-mini", label: "GPT-5.4 mini (rápido, económico)" },
    ],
    defaultModel: "gpt-5.5",
    supportsAdvisor: true,
    supportsCompare: true,
    accent: "#10a37f",
    guide: [
      "Create an account at platform.openai.com and add billing.",
      "Open platform.openai.com/api-keys and create a new secret key.",
      "Copy the key (starts with sk-…) — it is shown only once.",
      "Paste it here and pick a model (GPT-5.5 is the latest).",
    ],
  },
  {
    id: "anthropic",
    name: "Anthropic (Claude)",
    blurb: "Claude Sonnet 5 y Opus 4.8 — lo último en análisis, código y agentes.",
    kind: "anthropic",
    baseUrl: "https://api.anthropic.com",
    needsKey: true,
    keyPrefix: "sk-ant-",
    keyUrl: "https://console.anthropic.com/settings/keys",
    models: [
      { id: "claude-sonnet-5", label: "Claude Sonnet 5 (último, recomendado)" },
      { id: "claude-opus-4.8", label: "Claude Opus 4.8 (máxima inteligencia)" },
      { id: "claude-sonnet-4.6", label: "Claude Sonnet 4.6 (sólido, rápido)" },
      { id: "claude-haiku-4", label: "Claude Haiku 4 (rápido, económico)" },
    ],
    defaultModel: "claude-sonnet-5",
    supportsAdvisor: true,
    supportsCompare: true,
    accent: "#d97757",
    guide: [
      "Sign in at console.anthropic.com and add credits.",
      "Go to Settings → API keys and create a key.",
      "Copy the key (starts with sk-ant-…).",
      "Paste it here and choose Sonnet 5 (recomendado) u Opus 4.8.",
    ],
  },
  {
    id: "google",
    name: "Google Gemini",
    blurb: "Gemini 3.5 Flash y 3 Pro — lo más nuevo de Google, con búsqueda web nativa.",
    kind: "google",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    needsKey: true,
    keyPrefix: "AIza",
    keyUrl: "https://aistudio.google.com/app/apikey",
    models: [
      { id: "gemini-3.5-flash", label: "Gemini 3.5 Flash (rápido, recomendado)" },
      { id: "gemini-3-pro", label: "Gemini 3 Pro (máxima capacidad)" },
      { id: "gemini-3.1-flash", label: "Gemini 3.1 Flash (sólido)" },
    ],
    defaultModel: "gemini-3.5-flash",
    supportsAdvisor: true,
    supportsCompare: true,
    accent: "#4285f4",
    guide: [
      "Open aistudio.google.com/app/apikey and sign in with Google.",
      "Click \"Create API key\" (a free tier is available).",
      "Copy the key (starts with AIza…).",
      "Paste it here and pick Gemini 3.5 Flash (rápido) o 3 Pro (máxima capacidad).",
    ],
  },
  {
    id: "groq",
    name: "Groq",
    blurb: "Inferencia ultrarrápida con Llama 4 Scout, Qwen 3.6 — hardware Groq LPU.",
    kind: "openai-compat",
    baseUrl: "https://api.groq.com/openai/v1",
    needsKey: true,
    keyPrefix: "gsk_",
    keyUrl: "https://console.groq.com/keys",
    // CONFIRMED DEAD 2026-08-21: "meta-llama/llama-4-scout-17b-16e-instruct"
    // returned model_not_found from Groq. The live list from
    // /api/account/models is authoritative; these are only the fallback shown
    // when we cannot reach the provider.
    models: [
      { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B" },
      { id: "qwen/qwen3-32b", label: "Qwen 3 32B" },
    ],
    defaultModel: "llama-3.3-70b-versatile",
    supportsAdvisor: true,
    supportsCompare: true,
    accent: "#f55036",
    guide: [
      "Create an account at console.groq.com (free to start).",
      "Open console.groq.com/keys and create an API key.",
      "Copy the key (starts with gsk_…).",
      "Paste it here — Llama 4 Scout es el modelo más nuevo en Groq.",
    ],
  },
  {
    id: "mistral",
    name: "Mistral AI",
    blurb: "Mistral Large 3 — modelo europeo de última generación, 675B MoE.",
    kind: "openai-compat",
    baseUrl: "https://api.mistral.ai/v1",
    needsKey: true,
    keyUrl: "https://console.mistral.ai/api-keys",
    models: [
      { id: "mistral-large-3", label: "Mistral Large 3 (recomendado)" },
      { id: "mistral-small-3", label: "Mistral Small 3 (rápido)" },
    ],
    defaultModel: "mistral-large-3",
    supportsAdvisor: true,
    supportsCompare: true,
    accent: "#fa520f",
    guide: [
      "Sign up at console.mistral.ai and add a payment method.",
      "Go to API keys and create a new key.",
      "Copy the key.",
      "Paste it here — Mistral Large 3 es su modelo más potente.",
    ],
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    blurb: "Una clave, cientos de modelos — acceso unificado a todos los proveedores.",
    kind: "openai-compat",
    baseUrl: "https://openrouter.ai/api/v1",
    needsKey: true,
    keyPrefix: "sk-or-",
    keyUrl: "https://openrouter.ai/keys",
    models: [
      { id: "openai/gpt-5.5", label: "GPT-5.5 (OpenAI)" },
      { id: "anthropic/claude-sonnet-5", label: "Claude Sonnet 5 (Anthropic, recomendado)" },
      { id: "anthropic/claude-opus-4.8", label: "Claude Opus 4.8 (Anthropic)" },
      { id: "openai/gpt-5.5-pro", label: "GPT-5.5 Pro (OpenAI)" },
    ],
    defaultModel: "anthropic/claude-sonnet-5",
    supportsAdvisor: true,
    supportsCompare: true,
    accent: "#6467f2",
    guide: [
      "Create an account at openrouter.ai and add credits.",
      "Open openrouter.ai/keys and create a key.",
      "Copy the key (starts with sk-or-…).",
      "Paste it here — Claude Sonnet 5, GPT-5.5 o Llama 4 disponibles.",
    ],
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    blurb: "DeepSeek V4 — modelo chino de código abierto, increíble relación calidad/precio.",
    kind: "openai-compat",
    baseUrl: "https://api.deepseek.com/v1",
    needsKey: true,
    keyPrefix: "sk-",
    keyUrl: "https://platform.deepseek.com/api_keys",
    models: [
      { id: "deepseek-v4-pro", label: "DeepSeek V4 Pro (máxima capacidad)" },
      { id: "deepseek-v4-flash", label: "DeepSeek V4 Flash (rápido, económico)" },
    ],
    defaultModel: "deepseek-v4-flash",
    supportsAdvisor: true,
    supportsCompare: true,
    accent: "#4d6bfe",
    guide: [
      "Sign up at platform.deepseek.com and top up a little credit.",
      "Open the API keys page and create a key.",
      "Copy the key (starts with sk-…).",
      "Paste it here — DeepSeek V4 Flash es rápido y muy barato.",
    ],
  },
  {
    id: "xai",
    name: "xAI (Grok)",
    blurb: "Grok 4.3 — el modelo más nuevo de xAI, con 1M de contexto y visión.",
    kind: "openai-compat",
    baseUrl: "https://api.x.ai/v1",
    needsKey: true,
    keyPrefix: "xai-",
    keyUrl: "https://console.x.ai",
    models: [
      { id: "grok-4.3", label: "Grok 4.3 (último, recomendado)" },
    ],
    defaultModel: "grok-4.3",
    supportsAdvisor: true,
    supportsCompare: true,
    accent: "#1d9bf0",
    guide: [
      "Sign in at console.x.ai and add billing.",
      "Create an API key from the console.",
      "Copy the key (starts with xai-…).",
      "Paste it aquí — Grok 4.3 es el modelo más nuevo con 1M de contexto.",
    ],
  },
  {
    id: "perplexity",
    name: "Perplexity",
    blurb: "Sonar Pro — búsqueda web integrada, ideal para información actualizada.",
    kind: "openai-compat",
    baseUrl: "https://api.perplexity.ai",
    needsKey: true,
    keyPrefix: "pplx-",
    keyUrl: "https://www.perplexity.ai/settings/api",
    models: [
      { id: "sonar-pro", label: "Sonar Pro (recomendado, búsqueda profunda)" },
      { id: "sonar-reasoning-pro", label: "Sonar Reasoning Pro (razonamiento avanzado)" },
      { id: "sonar", label: "Sonar (básico, rápido)" },
    ],
    defaultModel: "sonar-pro",
    supportsAdvisor: true,
    supportsCompare: true,
    accent: "#20808d",
    guide: [
      "Open perplexity.ai/settings/api and add a payment method.",
      "Generate an API key.",
      "Copy the key (starts with pplx-…).",
      "Paste it here — Sonar Pro tiene búsqueda web integrada.",
    ],
  },
]

export const PROVIDERS_BY_ID: Record<string, AiProvider> = Object.fromEntries(
  AI_PROVIDERS.map((p) => [p.id, p]),
)

export function getProvider(id: string | null | undefined): AiProvider | null {
  if (!id) return null
  return PROVIDERS_BY_ID[id] ?? null
}

export type AiFeature = "advisor" | "compare"

export function providersForFeature(feature: AiFeature): AiProvider[] {
  return AI_PROVIDERS.filter((p) =>
    feature === "advisor" ? p.supportsAdvisor : p.supportsCompare,
  )
}

/**
 * Map of deprecated model IDs → their replacements (per-provider).
 * Lets users keep their old settings without breaking when models are retired.
 *
 * CAUTION: a migration is only as good as its target. An entry pointing at a
 * model the vendor no longer serves converts a possibly-valid choice into a
 * definitely-broken one, silently — that is exactly how the Groq entry here
 * behaved before 2026-08-21. A replacement must be a model id verified to
 * exist; when in doubt, delete the entry and let the user re-pick from the
 * live list, which now surfaces a clear error rather than a silent swap.
 */
const MODEL_MIGRATIONS: Record<string, string> = {
  // OpenAI — GPT-4.x series retired Feb 2026
  "gpt-4o-mini": "gpt-5.4-mini",
  "gpt-4o": "gpt-5.5",
  "gpt-4.1-mini": "gpt-5.4-mini",
  // Google Gemini — 1.5/2.0 series shut down June 2026
  "gemini-1.5-flash": "gemini-3.5-flash",
  "gemini-2.0-flash": "gemini-3.5-flash",
  "gemini-1.5-pro": "gemini-3-pro",
  // Anthropic Claude
  "claude-3-5-haiku-latest": "claude-haiku-4",
  "claude-3-5-sonnet-latest": "claude-sonnet-5",
  // DeepSeek — deepseek-chat deprecated July 2026
  "deepseek-chat": "deepseek-v4-flash",
  "deepseek-reasoner": "deepseek-v4-pro",
  // xAI — grok-2/grok-beta retired May 2026
  "grok-2-latest": "grok-4.3",
  "grok-beta": "grok-4.3",
}

/**
 * Shape of a model id we are willing to send to a provider: the tags every
 * vendor and Ollama actually use (`llama3.1:8b`, `qwen/qwen3-32b`,
 * `gpt-5.5-pro`) and nothing that could confuse a URL or a JSON body.
 */
const MODEL_ID_RE = /^[a-zA-Z0-9][a-zA-Z0-9._:\/-]{0,119}$/

export function isPlausibleModelId(model: string): boolean {
  return MODEL_ID_RE.test(model)
}

/**
 * Decide which model id to send for a stored preference.
 *
 * The `models` array is a SUGGESTION list, never an allow-list. It is written
 * by hand, so it goes stale the moment a vendor renames or retires something —
 * and the old behaviour (snap anything unrecognised back to `defaultModel`)
 * turned that staleness into an outage twice: once for Ollama, where the
 * default tag did not exist locally, and once for Groq, where the catalogue's
 * own default no longer existed upstream. Substituting a *different* wrong
 * model hides the problem; passing the user's choice through surfaces a precise
 * `model_not_found` they can act on, and the picker now offers whatever
 * `listProviderModels` reports so the choice is a real one.
 *
 * `defaultModel` is only for "the user has not chosen yet".
 */
export function resolveModel(
  provider: AiProvider,
  model: string | null | undefined,
): string {
  const trimmed = model?.trim()
  if (!trimmed) return provider.defaultModel
  if (provider.models.some((m) => m.id === trimmed)) return trimmed
  // Known rename/retirement: upgrade silently, that mapping is deliberate.
  const replacement = MODEL_MIGRATIONS[trimmed]
  if (replacement && provider.models.some((m) => m.id === replacement)) {
    return replacement
  }
  // Anything else that looks like a model id is the user's explicit choice —
  // most likely picked from the provider's own live list.
  if (isPlausibleModelId(trimmed)) return trimmed
  return provider.defaultModel
}
