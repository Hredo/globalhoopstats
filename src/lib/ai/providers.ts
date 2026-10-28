/**
 * Catalogue of AI providers the app can drive for the AI Advisor and AI
 * Compare features. Single source of truth shared by:
 *  - the account "AI & keys" manager (list + key inputs)
 *  - the per-feature engine picker (settings)
 *  - the chat dispatcher (lib/ai/chat.ts)
 *  - the public setup guide (/ai-setup)
 *
 * No secrets and no React here — just static metadata.
 *
 * What is static and what is not: this file decides WHERE a user's key may be
 * sent (`baseUrl`), so it stays in code and changes only through review. Every
 * thing that goes stale on its own — which models exist, which is newest, what
 * they cost — is read live: from the vendor's own /models with the user's key
 * (`ai/models.ts`) and from the public models.dev catalogue (`ai/catalog-live.ts`).
 * `pnpm ai:catalog` diffs this file against models.dev to flag a moved base URL,
 * a retired fallback model or a new provider worth adding.
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
  /** The vendor's own model list / docs page. */
  docsUrl: string
  /** Public price list, when the vendor publishes one. */
  pricingUrl?: string
  /** Provider id on models.dev, when it differs from ours. */
  catalogId?: string
  /**
   * Fallback suggestions, used only when the vendor's live list cannot be
   * read. Never an allow-list — see `resolveModel`.
   */
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

/** The last guide step every live-list provider shares. */
const LIVE_LIST_STEP =
  "Paste it here — the model list is read live from your account."

export const AI_PROVIDERS: AiProvider[] = [
  {
    id: "ollama",
    name: "Ollama (local)",
    blurb:
      "Any model you have installed on your own machine. Private, no key, no cost.",
    kind: "local",
    baseUrl: "http://localhost:11434/v1",
    needsKey: false,
    keyUrl: "https://ollama.com/download",
    docsUrl: "https://ollama.com/library",
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
    blurb: "The GPT family, from the cheapest fast models to the flagship.",
    kind: "openai",
    baseUrl: "https://api.openai.com/v1",
    needsKey: true,
    keyPrefix: "sk-",
    keyUrl: "https://platform.openai.com/api-keys",
    docsUrl: "https://platform.openai.com/docs/models",
    pricingUrl: "https://openai.com/api/pricing/",
    models: [
      { id: "gpt-6.1-terra", label: "GPT-6.1 Terra" },
      { id: "gpt-6.1-sol", label: "GPT-6.1 Sol" },
      { id: "gpt-6-luna", label: "GPT-6 Luna" },
    ],
    defaultModel: "gpt-6.1-terra",
    supportsAdvisor: true,
    supportsCompare: true,
    accent: "#10a37f",
    guide: [
      "Create an account at platform.openai.com and add billing.",
      "Open platform.openai.com/api-keys and create a new secret key.",
      "Copy the key (starts with sk-…) — it is shown only once.",
      LIVE_LIST_STEP,
    ],
  },
  {
    id: "anthropic",
    name: "Anthropic (Claude)",
    blurb:
      "Claude — the strongest option for careful analysis and long reasoning.",
    kind: "anthropic",
    baseUrl: "https://api.anthropic.com",
    needsKey: true,
    keyPrefix: "sk-ant-",
    keyUrl: "https://console.anthropic.com/settings/keys",
    docsUrl: "https://docs.anthropic.com/en/docs/about-claude/models",
    pricingUrl: "https://www.anthropic.com/pricing#api",
    models: [
      { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5" },
      { id: "claude-opus-5-5", label: "Claude Opus 5.5" },
      { id: "claude-haiku-5-5", label: "Claude Haiku 5.5" },
    ],
    defaultModel: "claude-sonnet-5-5",
    supportsAdvisor: true,
    supportsCompare: true,
    accent: "#d97757",
    guide: [
      "Sign in at console.anthropic.com and add credits.",
      "Go to Settings → API keys and create a key.",
      "Copy the key (starts with sk-ant-…).",
      LIVE_LIST_STEP,
    ],
  },
  {
    id: "google",
    name: "Google Gemini",
    blurb: "Gemini, with a free tier and native Google Search grounding.",
    kind: "google",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    needsKey: true,
    keyPrefix: "AIza",
    keyUrl: "https://aistudio.google.com/app/apikey",
    docsUrl: "https://ai.google.dev/gemini-api/docs/models",
    pricingUrl: "https://ai.google.dev/gemini-api/docs/pricing",
    models: [
      { id: "gemini-flash-latest", label: "Gemini Flash (latest)" },
      { id: "gemini-4-argon", label: "Gemini 4 Argon" },
      { id: "gemini-3.8-flash", label: "Gemini 3.8 Flash" },
    ],
    defaultModel: "gemini-flash-latest",
    supportsAdvisor: true,
    supportsCompare: true,
    accent: "#4285f4",
    guide: [
      "Open aistudio.google.com/app/apikey and sign in with Google.",
      'Click "Create API key" (a free tier is available).',
      "Copy the key (starts with AIza…).",
      LIVE_LIST_STEP,
    ],
  },
  {
    id: "groq",
    name: "Groq",
    blurb: "Very fast inference of open models on Groq's own LPU hardware.",
    kind: "openai-compat",
    baseUrl: "https://api.groq.com/openai/v1",
    needsKey: true,
    keyPrefix: "gsk_",
    keyUrl: "https://console.groq.com/keys",
    docsUrl: "https://console.groq.com/docs/models",
    pricingUrl: "https://groq.com/pricing",
    // CONFIRMED DEAD 2026-08-21: "meta-llama/llama-4-scout-17b-16e-instruct"
    // returned model_not_found from Groq. The live list from
    // /api/account/models is authoritative; these are only the fallback shown
    // when we cannot reach the provider.
    models: [
      { id: "openai/gpt-oss-120b", label: "GPT OSS 120B" },
      { id: "qwen/qwen3.8-27b", label: "Qwen 3.8 27B" },
      { id: "openai/gpt-oss-20b", label: "GPT OSS 20B" },
    ],
    defaultModel: "openai/gpt-oss-120b",
    supportsAdvisor: true,
    supportsCompare: true,
    accent: "#f55036",
    guide: [
      "Create an account at console.groq.com (free to start).",
      "Open console.groq.com/keys and create an API key.",
      "Copy the key (starts with gsk_…).",
      LIVE_LIST_STEP,
    ],
  },
  {
    id: "mistral",
    name: "Mistral AI",
    blurb: "European models from Mistral, hosted in the EU.",
    kind: "openai-compat",
    baseUrl: "https://api.mistral.ai/v1",
    needsKey: true,
    keyUrl: "https://console.mistral.ai/api-keys",
    docsUrl: "https://docs.mistral.ai/getting-started/models/",
    pricingUrl: "https://mistral.ai/pricing#api-pricing",
    models: [
      { id: "mistral-medium-latest", label: "Mistral Medium (latest)" },
      { id: "mistral-large-4", label: "Mistral Large 4" },
      { id: "mistral-small-latest", label: "Mistral Small (latest)" },
    ],
    defaultModel: "mistral-medium-latest",
    supportsAdvisor: true,
    supportsCompare: true,
    accent: "#fa520f",
    guide: [
      "Sign up at console.mistral.ai and add a payment method.",
      "Go to API keys and create a new key.",
      "Copy the key.",
      LIVE_LIST_STEP,
    ],
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    blurb:
      "One key, hundreds of models — unified access to every major vendor.",
    kind: "openai-compat",
    baseUrl: "https://openrouter.ai/api/v1",
    needsKey: true,
    keyPrefix: "sk-or-",
    keyUrl: "https://openrouter.ai/keys",
    docsUrl: "https://openrouter.ai/models",
    models: [
      {
        id: "anthropic/claude-sonnet-5.5",
        label: "Claude Sonnet 5.5 (Anthropic)",
      },
      { id: "openai/gpt-6.1-terra", label: "GPT-6.1 Terra (OpenAI)" },
      { id: "google/gemini-4-argon", label: "Gemini 4 Argon (Google)" },
      { id: "x-ai/grok-4.7", label: "Grok 4.7 (xAI)" },
    ],
    defaultModel: "anthropic/claude-sonnet-5.5",
    supportsAdvisor: true,
    supportsCompare: true,
    accent: "#6467f2",
    guide: [
      "Create an account at openrouter.ai and add credits.",
      "Open openrouter.ai/keys and create a key.",
      "Copy the key (starts with sk-or-…).",
      LIVE_LIST_STEP,
    ],
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    blurb: "Open-weight DeepSeek models at a very low price per token.",
    kind: "openai-compat",
    baseUrl: "https://api.deepseek.com/v1",
    needsKey: true,
    keyPrefix: "sk-",
    keyUrl: "https://platform.deepseek.com/api_keys",
    docsUrl: "https://api-docs.deepseek.com/quick_start/pricing",
    pricingUrl: "https://api-docs.deepseek.com/quick_start/pricing",
    models: [
      { id: "deepseek-flash", label: "DeepSeek Flash" },
      { id: "deepseek-v4-pro", label: "DeepSeek V4 Pro" },
    ],
    defaultModel: "deepseek-flash",
    supportsAdvisor: true,
    supportsCompare: true,
    accent: "#4d6bfe",
    guide: [
      "Sign up at platform.deepseek.com and top up a little credit.",
      "Open the API keys page and create a key.",
      "Copy the key (starts with sk-…).",
      LIVE_LIST_STEP,
    ],
  },
  {
    id: "xai",
    name: "xAI (Grok)",
    blurb: "Grok, with very long context and image input.",
    kind: "openai-compat",
    baseUrl: "https://api.x.ai/v1",
    needsKey: true,
    keyPrefix: "xai-",
    keyUrl: "https://console.x.ai",
    docsUrl: "https://docs.x.ai/docs/models",
    models: [
      { id: "grok-4.7", label: "Grok 4.7" },
      { id: "grok-4.3", label: "Grok 4.3" },
    ],
    defaultModel: "grok-4.7",
    supportsAdvisor: true,
    supportsCompare: true,
    accent: "#1d9bf0",
    guide: [
      "Sign in at console.x.ai and add billing.",
      "Create an API key from the console.",
      "Copy the key (starts with xai-…).",
      LIVE_LIST_STEP,
    ],
  },
  {
    id: "perplexity",
    name: "Perplexity",
    blurb: "Sonar — answers grounded on a live web search.",
    kind: "openai-compat",
    baseUrl: "https://api.perplexity.ai",
    needsKey: true,
    keyPrefix: "pplx-",
    keyUrl: "https://www.perplexity.ai/settings/api",
    docsUrl: "https://docs.perplexity.ai/getting-started/models",
    pricingUrl: "https://docs.perplexity.ai/getting-started/pricing",
    models: [
      { id: "sonar-pro", label: "Sonar Pro" },
      { id: "sonar-reasoning-pro", label: "Sonar Reasoning Pro" },
      { id: "sonar", label: "Sonar" },
    ],
    defaultModel: "sonar-pro",
    supportsAdvisor: true,
    supportsCompare: true,
    accent: "#20808d",
    guide: [
      "Open perplexity.ai/settings/api and add a payment method.",
      "Generate an API key.",
      "Copy the key (starts with pplx-…).",
      "Paste it here — Sonar searches the web on every answer.",
    ],
  },
  // ---------------------------------------------------------------------
  // Everything below is OpenAI-compatible and serves a live /models list, so
  // these entries carry NO hand-written model catalogue on purpose. The
  // picker and `resolveBestModel` read the vendor's own list and rank it, and
  // `defaultModel` is only the fallback of last resort for when that list
  // cannot be fetched at all. Writing model ids here is what went stale twice
  // and broke the AI both times.
  // ---------------------------------------------------------------------
  {
    id: "together",
    name: "Together AI",
    blurb:
      "Hundreds of open models (Llama, Qwen, DeepSeek) served fast and cheap.",
    kind: "openai-compat",
    baseUrl: "https://api.together.xyz/v1",
    needsKey: true,
    keyUrl: "https://api.together.xyz/settings/api-keys",
    docsUrl: "https://docs.together.ai/docs/serverless-models",
    pricingUrl: "https://www.together.ai/pricing",
    catalogId: "togetherai",
    models: [],
    defaultModel: "deepseek-ai/DeepSeek-V4.1-Flash",
    supportsAdvisor: true,
    supportsCompare: true,
    accent: "#0f6fff",
    guide: [
      "Create an account at together.ai and add credit.",
      "Open api.together.xyz/settings/api-keys and create a key.",
      "Copy the key.",
      LIVE_LIST_STEP,
    ],
  },
  {
    id: "fireworks",
    name: "Fireworks AI",
    blurb: "Fast inference of open models at a good price per token.",
    kind: "openai-compat",
    baseUrl: "https://api.fireworks.ai/inference/v1",
    needsKey: true,
    keyUrl: "https://app.fireworks.ai/settings/users/api-keys",
    docsUrl: "https://fireworks.ai/models",
    pricingUrl: "https://fireworks.ai/pricing",
    catalogId: "fireworks-ai",
    models: [],
    defaultModel: "accounts/fireworks/models/deepseek-v4p1-flash-1017",
    supportsAdvisor: true,
    supportsCompare: true,
    accent: "#ff5a1f",
    guide: [
      "Create an account at fireworks.ai and add billing.",
      "Open app.fireworks.ai → Settings → API keys and create a key.",
      "Copy the key.",
      LIVE_LIST_STEP,
    ],
  },
  {
    id: "cerebras",
    name: "Cerebras",
    blurb: "The fastest inference on the market, on Cerebras' own hardware.",
    kind: "openai-compat",
    baseUrl: "https://api.cerebras.ai/v1",
    needsKey: true,
    keyUrl: "https://cloud.cerebras.ai",
    docsUrl: "https://inference-docs.cerebras.ai/models/overview",
    pricingUrl: "https://www.cerebras.ai/pricing",
    models: [],
    defaultModel: "gpt-oss-120b",
    supportsAdvisor: true,
    supportsCompare: true,
    accent: "#f26722",
    guide: [
      "Create an account at cloud.cerebras.ai (free tier available).",
      "Create an API key from the dashboard.",
      "Copy the key.",
      LIVE_LIST_STEP,
    ],
  },
  {
    id: "qwen",
    name: "Alibaba Qwen",
    blurb: "Qwen models straight from Alibaba, with very long context.",
    kind: "openai-compat",
    baseUrl: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
    needsKey: true,
    keyUrl: "https://modelstudio.console.alibabacloud.com",
    docsUrl: "https://www.alibabacloud.com/help/en/model-studio/models",
    catalogId: "alibaba",
    models: [],
    defaultModel: "qwen-plus",
    supportsAdvisor: true,
    supportsCompare: true,
    accent: "#615ced",
    guide: [
      "Create an Alibaba Cloud Model Studio account (international region).",
      "Create an API key in the console.",
      "Copy the key.",
      LIVE_LIST_STEP,
    ],
  },
  {
    id: "moonshot",
    name: "Moonshot (Kimi)",
    blurb: "Kimi — very long context and strong reasoning over documents.",
    kind: "openai-compat",
    baseUrl: "https://api.moonshot.ai/v1",
    needsKey: true,
    keyUrl: "https://platform.moonshot.ai/console/api-keys",
    docsUrl: "https://platform.moonshot.ai/docs/pricing/chat",
    catalogId: "moonshotai",
    models: [],
    defaultModel: "kimi-k3",
    supportsAdvisor: true,
    supportsCompare: true,
    accent: "#1f2937",
    guide: [
      "Create an account at platform.moonshot.ai and add credit.",
      "Open the API keys page and create a key.",
      "Copy the key.",
      LIVE_LIST_STEP,
    ],
  },
  {
    id: "zai",
    name: "Z.AI (GLM)",
    blurb: "Zhipu's GLM models, strong at reasoning and very cheap.",
    kind: "openai-compat",
    baseUrl: "https://api.z.ai/api/paas/v4",
    needsKey: true,
    keyUrl: "https://z.ai/manage-apikey/apikey-list",
    docsUrl: "https://docs.z.ai/guides/overview/pricing",
    models: [],
    defaultModel: "glm-5.3",
    supportsAdvisor: true,
    supportsCompare: true,
    accent: "#3b6cf6",
    guide: [
      "Create an account at z.ai and add credit.",
      "Open the API keys page and create a key.",
      "Copy the key.",
      LIVE_LIST_STEP,
    ],
  },
  {
    id: "sambanova",
    name: "SambaNova",
    blurb: "Open models served at very high speed on SambaNova's own hardware.",
    kind: "openai-compat",
    baseUrl: "https://api.sambanova.ai/v1",
    needsKey: true,
    keyUrl: "https://cloud.sambanova.ai/apis",
    docsUrl:
      "https://docs.sambanova.ai/cloud/docs/get-started/supported-models",
    models: [],
    defaultModel: "gpt-oss-120b",
    supportsAdvisor: true,
    supportsCompare: true,
    accent: "#ee3d24",
    guide: [
      "Create an account at cloud.sambanova.ai.",
      "Create an API key from the dashboard.",
      "Copy the key.",
      LIVE_LIST_STEP,
    ],
  },
  {
    id: "deepinfra",
    name: "DeepInfra",
    blurb: "A wide catalogue of open models at very low per-token prices.",
    kind: "openai-compat",
    baseUrl: "https://api.deepinfra.com/v1/openai",
    needsKey: true,
    keyUrl: "https://deepinfra.com/dash/api_keys",
    docsUrl: "https://deepinfra.com/models",
    pricingUrl: "https://deepinfra.com/pricing",
    models: [],
    defaultModel: "deepseek-ai/DeepSeek-V4.1-Flash",
    supportsAdvisor: true,
    supportsCompare: true,
    accent: "#3d5afe",
    guide: [
      "Create an account at deepinfra.com and add credit.",
      "Open deepinfra.com/dash/api_keys and create a key.",
      "Copy the key.",
      LIVE_LIST_STEP,
    ],
  },
  {
    id: "nebius",
    name: "Nebius Token Factory",
    blurb: "Open models hosted in Europe, with free credit to start.",
    kind: "openai-compat",
    // Moved from api.studio.nebius.com when AI Studio became Token Factory.
    baseUrl: "https://api.tokenfactory.nebius.com/v1",
    needsKey: true,
    keyUrl: "https://tokenfactory.nebius.com",
    docsUrl: "https://docs.tokenfactory.nebius.com/",
    models: [],
    defaultModel: "deepseek-ai/DeepSeek-V4.1-Flash-1017",
    supportsAdvisor: true,
    supportsCompare: true,
    accent: "#00d4a0",
    guide: [
      "Create an account at tokenfactory.nebius.com.",
      "Open the API keys page and create a key.",
      "Copy the key.",
      LIVE_LIST_STEP,
    ],
  },
  {
    id: "scaleway",
    name: "Scaleway",
    blurb:
      "Open models served from data centres in France — EU data residency.",
    kind: "openai-compat",
    baseUrl: "https://api.scaleway.ai/v1",
    needsKey: true,
    keyUrl: "https://console.scaleway.com/iam/api-keys",
    docsUrl: "https://www.scaleway.com/en/docs/generative-apis/",
    pricingUrl: "https://www.scaleway.com/en/pricing/model-as-a-service/",
    models: [],
    defaultModel: "qwen3.8-27b",
    supportsAdvisor: true,
    supportsCompare: true,
    accent: "#4f0599",
    guide: [
      "Create an account at console.scaleway.com.",
      "Open IAM → API keys and generate a key (use the secret key).",
      "Copy the secret key.",
      LIVE_LIST_STEP,
    ],
  },
  {
    id: "ollama-cloud",
    name: "Ollama Cloud",
    blurb: "Large open models run by Ollama in the cloud — no GPU of your own.",
    kind: "openai-compat",
    baseUrl: "https://ollama.com/v1",
    needsKey: true,
    keyUrl: "https://ollama.com/settings/keys",
    docsUrl: "https://docs.ollama.com/cloud",
    pricingUrl: "https://ollama.com/pricing",
    models: [],
    defaultModel: "glm-5.3",
    supportsAdvisor: true,
    supportsCompare: true,
    accent: "#6b7280",
    guide: [
      "Sign in at ollama.com.",
      "Open ollama.com/settings/keys and create an API key.",
      "Copy the key.",
      LIVE_LIST_STEP,
    ],
  },
  {
    id: "nvidia",
    name: "NVIDIA NIM",
    blurb:
      "Open models on NVIDIA's own endpoints, with free credits for developers.",
    kind: "openai-compat",
    baseUrl: "https://integrate.api.nvidia.com/v1",
    needsKey: true,
    keyPrefix: "nvapi-",
    keyUrl: "https://build.nvidia.com/settings/api-keys",
    docsUrl: "https://build.nvidia.com/models",
    models: [],
    defaultModel: "deepseek-ai/deepseek-v4.1-flash",
    supportsAdvisor: true,
    supportsCompare: true,
    accent: "#76b900",
    guide: [
      "Sign in at build.nvidia.com.",
      "Open Settings → API keys and generate a key.",
      "Copy the key (starts with nvapi-…).",
      LIVE_LIST_STEP,
    ],
  },
  {
    id: "huggingface",
    name: "Hugging Face",
    blurb:
      "One token for the open models served by Hugging Face's partner providers.",
    kind: "openai-compat",
    baseUrl: "https://router.huggingface.co/v1",
    needsKey: true,
    keyPrefix: "hf_",
    keyUrl: "https://huggingface.co/settings/tokens",
    docsUrl: "https://huggingface.co/docs/inference-providers",
    pricingUrl: "https://huggingface.co/pricing",
    models: [],
    defaultModel: "deepseek-ai/DeepSeek-V4.1-Flash",
    supportsAdvisor: true,
    supportsCompare: true,
    accent: "#ffcc4d",
    guide: [
      "Sign in at huggingface.co.",
      "Open Settings → Access tokens and create a token with the “Make calls to Inference Providers” permission.",
      "Copy the token (starts with hf_…).",
      LIVE_LIST_STEP,
    ],
  },
  {
    id: "novita",
    name: "Novita AI",
    blurb:
      "Low-cost access to the newest open models, Kimi and MiniMax included.",
    kind: "openai-compat",
    baseUrl: "https://api.novita.ai/openai",
    needsKey: true,
    keyUrl: "https://novita.ai/settings/key-management",
    docsUrl: "https://novita.ai/models",
    pricingUrl: "https://novita.ai/pricing",
    catalogId: "novita-ai",
    models: [],
    defaultModel: "deepseek/deepseek-v4.1-flash-1017",
    supportsAdvisor: true,
    supportsCompare: true,
    accent: "#23d57c",
    guide: [
      "Create an account at novita.ai and add credit.",
      "Open Settings → Key management and create a key.",
      "Copy the key.",
      LIVE_LIST_STEP,
    ],
  },
  {
    id: "siliconflow",
    name: "SiliconFlow",
    blurb: "Fast, cheap hosting for Qwen, GLM and DeepSeek.",
    kind: "openai-compat",
    baseUrl: "https://api.siliconflow.com/v1",
    needsKey: true,
    keyPrefix: "sk-",
    keyUrl: "https://cloud.siliconflow.com/account/ak",
    docsUrl: "https://cloud.siliconflow.com/models",
    models: [],
    defaultModel: "zai-org/GLM-5.3",
    supportsAdvisor: true,
    supportsCompare: true,
    accent: "#7c3aed",
    guide: [
      "Create an account at cloud.siliconflow.com.",
      "Open the API keys page and create a key.",
      "Copy the key (starts with sk-…).",
      LIVE_LIST_STEP,
    ],
  },
  {
    id: "chutes",
    name: "Chutes",
    blurb: "Decentralised inference of open models, billed per use.",
    kind: "openai-compat",
    baseUrl: "https://llm.chutes.ai/v1",
    needsKey: true,
    keyUrl: "https://chutes.ai/app/api",
    docsUrl: "https://chutes.ai/app",
    models: [],
    defaultModel: "zai-org/GLM-5.3",
    supportsAdvisor: true,
    supportsCompare: true,
    accent: "#0ea5e9",
    guide: [
      "Create an account at chutes.ai.",
      "Open the API page and create a key.",
      "Copy the key.",
      LIVE_LIST_STEP,
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

/** The provider's id on models.dev. */
export function catalogIdFor(provider: AiProvider): string {
  return provider.catalogId ?? provider.id
}

/**
 * The page for one model. Each vendor lays out its docs differently, so this
 * is a template per vendor; where no reliable per-model page exists it falls
 * back to the vendor's model list, which always does, rather than a guessed
 * URL that would 404.
 */
export function modelPageUrl(provider: AiProvider, modelId: string): string {
  const id = encodeURIComponent(modelId)
  switch (provider.id) {
    case "openai":
      return `https://platform.openai.com/docs/models/${id}`
    case "openrouter":
      return `https://openrouter.ai/${modelId.split("/").map(encodeURIComponent).join("/")}`
    case "groq":
      return `https://console.groq.com/docs/model/${id}`
    case "xai":
      return `https://docs.x.ai/docs/models/${id}`
    case "huggingface":
      return `https://huggingface.co/${modelId.split("/").map(encodeURIComponent).join("/")}`
    case "nvidia":
      return `https://build.nvidia.com/search?q=${id}`
    case "ollama":
    case "ollama-cloud":
      return `https://ollama.com/library/${encodeURIComponent(modelId.split(":")[0])}`
    default:
      return provider.docsUrl
  }
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
 *
 * Targets last checked against models.dev on 2026-10-28.
 */
const MODEL_MIGRATIONS: Record<string, string> = {
  // OpenAI — GPT-4.x series retired Feb 2026
  "gpt-4o-mini": "gpt-6-luna",
  "gpt-4o": "gpt-6.1-terra",
  "gpt-4.1-mini": "gpt-6-luna",
  // Google Gemini — 1.5/2.0 shut down June 2026; the 3.x ids below were
  // written into this catalogue without ever existing upstream.
  "gemini-1.5-flash": "gemini-flash-latest",
  "gemini-2.0-flash": "gemini-flash-latest",
  "gemini-1.5-pro": "gemini-4-argon",
  "gemini-3-pro": "gemini-4-argon",
  "gemini-3.1-flash": "gemini-flash-latest",
  // Anthropic Claude — ids use hyphens; the dotted ones never existed.
  "claude-3-5-haiku-latest": "claude-haiku-5-5",
  "claude-3-5-sonnet-latest": "claude-sonnet-5-5",
  "claude-opus-4.8": "claude-opus-5-5",
  "claude-sonnet-4.6": "claude-sonnet-5-5",
  "claude-haiku-4": "claude-haiku-5-5",
  // DeepSeek — deepseek-chat deprecated July 2026, v4-flash October 2026
  "deepseek-chat": "deepseek-flash",
  "deepseek-reasoner": "deepseek-v4-pro",
  "deepseek-v4-flash": "deepseek-flash",
  // xAI — grok-2/grok-beta retired May 2026
  "grok-2-latest": "grok-4.7",
  "grok-beta": "grok-4.7",
  // Mistral — the "3" ids were never served under those names
  "mistral-large-3": "mistral-large-4",
  "mistral-small-3": "mistral-small-latest",
  // Groq — Llama 3.3 deprecated, Qwen 3 32B withdrawn
  "llama-3.3-70b-versatile": "openai/gpt-oss-120b",
  "qwen/qwen3-32b": "qwen/qwen3.8-27b",
  // OpenRouter mirrors the vendor ids with dots
  "anthropic/claude-sonnet-5": "anthropic/claude-sonnet-5.5",
  "anthropic/claude-opus-4.8": "anthropic/claude-sonnet-5.5",
  "openai/gpt-5.5": "openai/gpt-6.1-terra",
  "openai/gpt-5.5-pro": "openai/gpt-6.1-terra",
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
