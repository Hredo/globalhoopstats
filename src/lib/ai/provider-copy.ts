/**
 * Per-provider prose (one-line blurb + "how to connect" steps) in each
 * supported language.
 *
 * This lives outside `providers.ts` on purpose: that module is the machine-
 * readable catalogue (ids, base URLs, model lists) imported by the chat
 * dispatcher and by client components, and it should stay free of display
 * copy. It also used to hold a blurb in Spanish next to guide steps in
 * English, so the setup guide read as broken in whichever language you picked.
 *
 * Keyed by provider id. `providerCopy` falls back to the catalogue's own text
 * when an id has no entry here, so adding a provider never renders blank.
 */
import type { Locale } from "@/lib/i18n/config"
import { getProvider } from "@/lib/ai/providers"

export type ProviderCopy = {
  blurb: string
  guide: string[]
}

const EN: Record<string, ProviderCopy> = {
  ollama: {
    blurb:
      "Any model you have installed on your own machine. Private, no key, no cost.",
    guide: [
      "Install the Ollama app from ollama.com/download.",
      "Pull a model in your terminal, e.g. ollama pull llama3.1:8b",
      "Make sure Ollama is running (the app, or `ollama serve`).",
      "Pick “Ollama (local)” here — we detect it automatically, no key needed, and the model list shows what you actually have installed.",
    ],
  },
  openai: {
    blurb: "GPT-5.5 — OpenAI's most capable model, with a 1M-token context.",
    guide: [
      "Create an account at platform.openai.com and add billing.",
      "Open platform.openai.com/api-keys and create a new secret key.",
      "Copy the key (starts with sk-…) — it is shown only once.",
      "Paste it here and pick a model.",
    ],
  },
  anthropic: {
    blurb:
      "Claude Sonnet 5 and Opus 4.8 — the strongest option for analysis and long reasoning.",
    guide: [
      "Sign in at console.anthropic.com and add credits.",
      "Go to Settings → API keys and create a key.",
      "Copy the key (starts with sk-ant-…).",
      "Paste it here and choose Sonnet 5 (recommended) or Opus 4.8.",
    ],
  },
  google: {
    blurb:
      "Gemini 3.5 Flash and 3 Pro — Google's latest, with native web search.",
    guide: [
      "Open aistudio.google.com/app/apikey and sign in with Google.",
      'Click "Create API key" (a free tier is available).',
      "Copy the key (starts with AIza…).",
      "Paste it here and pick Gemini 3.5 Flash (fast) or 3 Pro (most capable).",
    ],
  },
  groq: {
    blurb:
      "Extremely fast inference on Groq LPU hardware — Llama 4 Scout, Qwen 3.6.",
    guide: [
      "Create an account at console.groq.com (free to start).",
      "Open console.groq.com/keys and create an API key.",
      "Copy the key (starts with gsk_…).",
      "Paste it here — Llama 4 Scout is the newest model on Groq.",
    ],
  },
  mistral: {
    blurb: "Mistral Large 3 — a European frontier model, 675B MoE.",
    guide: [
      "Sign up at console.mistral.ai and add a payment method.",
      "Go to API keys and create a new key.",
      "Copy the key.",
      "Paste it here — Mistral Large 3 is their most capable model.",
    ],
  },
  openrouter: {
    blurb:
      "One key, hundreds of models — unified access to every major provider.",
    guide: [
      "Create an account at openrouter.ai and add credits.",
      "Open openrouter.ai/keys and create a key.",
      "Copy the key (starts with sk-or-…).",
      "Paste it here — Claude Sonnet 5, GPT-5.5 and Llama 4 are all available.",
    ],
  },
  deepseek: {
    blurb: "DeepSeek V4 — open-weight models with outstanding value for money.",
    guide: [
      "Sign up at platform.deepseek.com and top up a little credit.",
      "Open the API keys page and create a key.",
      "Copy the key (starts with sk-…).",
      "Paste it here — DeepSeek V4 Flash is fast and very cheap.",
    ],
  },
  xai: {
    blurb: "Grok 4.3 — xAI's newest model, 1M-token context with vision.",
    guide: [
      "Sign in at console.x.ai and add billing.",
      "Create an API key from the console.",
      "Copy the key (starts with xai-…).",
      "Paste it here — Grok 4.3 is the newest model, with a 1M-token context.",
    ],
  },
  perplexity: {
    blurb: "Sonar Pro — built-in web search, ideal for up-to-date information.",
    guide: [
      "Open perplexity.ai/settings/api and add a payment method.",
      "Generate an API key.",
      "Copy the key (starts with pplx-…).",
      "Paste it here — Sonar Pro has web search built in.",
    ],
  },
  together: {
    blurb:
      "Hundreds of open models (Llama, Qwen, DeepSeek) served fast and cheap.",
    guide: [
      "Create an account at together.ai and add credit.",
      "Open api.together.xyz/settings/api-keys and create a key.",
      "Copy the key.",
      "Paste it here — we read your model list live, so you always see the newest.",
    ],
  },
  fireworks: {
    blurb:
      "Fast inference on open models, at a good price per token.",
    guide: [
      "Create an account at fireworks.ai and add billing.",
      "Open fireworks.ai/account/api-keys and create a key.",
      "Copy the key.",
      "Paste it here — we read your model list live, so you always see the newest.",
    ],
  },
  cerebras: {
    blurb:
      "The fastest inference on the market, on their own hardware.",
    guide: [
      "Create an account at cloud.cerebras.ai (a free tier is available).",
      "Create an API key from the dashboard.",
      "Copy the key.",
      "Paste it here — we read your model list live, so you always see the newest.",
    ],
  },
  qwen: {
    blurb:
      "The Qwen models straight from Alibaba, with very long context.",
    guide: [
      "Create an Alibaba Cloud Model Studio account (international region).",
      "Create an API key in the console.",
      "Copy the key.",
      "Paste it here — we read your model list live, so you always see the newest.",
    ],
  },
  moonshot: {
    blurb:
      "Kimi — very long context and strong reasoning over documents.",
    guide: [
      "Create an account at platform.moonshot.ai and add credit.",
      "Open the API keys page and create a key.",
      "Copy the key.",
      "Paste it here — we read your model list live, so you always see the newest.",
    ],
  },
  zai: {
    blurb:
      "GLM models from Zhipu — strong reasoning, very cheap per token.",
    guide: [
      "Create an account at z.ai and add credit.",
      "Open the API keys page and create a key.",
      "Copy the key.",
      "Paste it here — we read your model list live, so you always see the newest.",
    ],
  },
  sambanova: {
    blurb:
      "Open models served at very high speed on their own hardware.",
    guide: [
      "Create an account at cloud.sambanova.ai.",
      "Create an API key from the dashboard.",
      "Copy the key.",
      "Paste it here — we read your model list live, so you always see the newest.",
    ],
  },
  deepinfra: {
    blurb:
      "A wide catalogue of open models with very low per-token prices.",
    guide: [
      "Create an account at deepinfra.com and add credit.",
      "Open deepinfra.com/dash/api_keys and create a key.",
      "Copy the key.",
      "Paste it here — we read your model list live, so you always see the newest.",
    ],
  },
  nebius: {
    blurb:
      "Open models hosted in Europe, with a free tier to get started.",
    guide: [
      "Create an account at studio.nebius.com.",
      "Open Settings → API keys and create a key.",
      "Copy the key.",
      "Paste it here — we read your model list live, so you always see the newest.",
    ],
  },
}

const ES: Record<string, ProviderCopy> = {
  ollama: {
    blurb:
      "Cualquier modelo que tengas instalado en tu máquina. Privado, sin clave, sin coste.",
    guide: [
      "Instala la aplicación Ollama desde ollama.com/download.",
      "Descarga un modelo en tu terminal, p. ej. ollama pull llama3.1:8b",
      "Asegúrate de que Ollama está en marcha (la app, o `ollama serve`).",
      "Elige “Ollama (local)” aquí — lo detectamos automáticamente, sin clave, y la lista de modelos muestra los que tienes instalados de verdad.",
    ],
  },
  openai: {
    blurb:
      "GPT-5.5 — el modelo más avanzado de OpenAI, con 1M de contexto.",
    guide: [
      "Crea una cuenta en platform.openai.com y añade facturación.",
      "Abre platform.openai.com/api-keys y crea una clave secreta.",
      "Copia la clave (empieza por sk-…) — solo se muestra una vez.",
      "Pégala aquí y elige un modelo.",
    ],
  },
  anthropic: {
    blurb:
      "Claude Sonnet 5 y Opus 4.8 — la opción más potente para análisis y razonamiento largo.",
    guide: [
      "Inicia sesión en console.anthropic.com y añade crédito.",
      "Ve a Settings → API keys y crea una clave.",
      "Copia la clave (empieza por sk-ant-…).",
      "Pégala aquí y elige Sonnet 5 (recomendado) u Opus 4.8.",
    ],
  },
  google: {
    blurb:
      "Gemini 3.5 Flash y 3 Pro — lo más nuevo de Google, con búsqueda web nativa.",
    guide: [
      "Abre aistudio.google.com/app/apikey e inicia sesión con Google.",
      'Pulsa "Create API key" (hay un plan gratuito disponible).',
      "Copia la clave (empieza por AIza…).",
      "Pégala aquí y elige Gemini 3.5 Flash (rápido) o 3 Pro (máxima capacidad).",
    ],
  },
  groq: {
    blurb:
      "Inferencia ultrarrápida con hardware Groq LPU — Llama 4 Scout, Qwen 3.6.",
    guide: [
      "Crea una cuenta en console.groq.com (gratis para empezar).",
      "Abre console.groq.com/keys y crea una clave API.",
      "Copia la clave (empieza por gsk_…).",
      "Pégala aquí — Llama 4 Scout es el modelo más nuevo en Groq.",
    ],
  },
  mistral: {
    blurb: "Mistral Large 3 — modelo europeo de última generación, 675B MoE.",
    guide: [
      "Regístrate en console.mistral.ai y añade un método de pago.",
      "Ve a API keys y crea una clave nueva.",
      "Copia la clave.",
      "Pégala aquí — Mistral Large 3 es su modelo más potente.",
    ],
  },
  openrouter: {
    blurb:
      "Una clave, cientos de modelos — acceso unificado a todos los proveedores.",
    guide: [
      "Crea una cuenta en openrouter.ai y añade crédito.",
      "Abre openrouter.ai/keys y crea una clave.",
      "Copia la clave (empieza por sk-or-…).",
      "Pégala aquí — tienes Claude Sonnet 5, GPT-5.5 y Llama 4 disponibles.",
    ],
  },
  deepseek: {
    blurb:
      "DeepSeek V4 — modelos de pesos abiertos con una relación calidad/precio excelente.",
    guide: [
      "Regístrate en platform.deepseek.com y añade algo de crédito.",
      "Abre la página de claves API y crea una clave.",
      "Copia la clave (empieza por sk-…).",
      "Pégala aquí — DeepSeek V4 Flash es rápido y muy barato.",
    ],
  },
  xai: {
    blurb: "Grok 4.3 — el modelo más nuevo de xAI, 1M de contexto y visión.",
    guide: [
      "Inicia sesión en console.x.ai y añade facturación.",
      "Crea una clave API desde la consola.",
      "Copia la clave (empieza por xai-…).",
      "Pégala aquí — Grok 4.3 es el modelo más nuevo, con 1M de contexto.",
    ],
  },
  perplexity: {
    blurb:
      "Sonar Pro — búsqueda web integrada, ideal para información actualizada.",
    guide: [
      "Abre perplexity.ai/settings/api y añade un método de pago.",
      "Genera una clave API.",
      "Copia la clave (empieza por pplx-…).",
      "Pégala aquí — Sonar Pro tiene búsqueda web integrada.",
    ],
  },
  together: {
    blurb:
      "Cientos de modelos abiertos (Llama, Qwen, DeepSeek) servidos rápido y barato.",
    guide: [
      "Crea una cuenta en together.ai y añade crédito.",
      "Abre api.together.xyz/settings/api-keys y crea una clave.",
      "Copia la clave.",
      "Pégala aquí — leemos tu lista de modelos en directo, así siempre ves los más nuevos.",
    ],
  },
  fireworks: {
    blurb:
      "Inferencia rápida de modelos abiertos, con buen precio por token.",
    guide: [
      "Crea una cuenta en fireworks.ai y añade facturación.",
      "Abre fireworks.ai/account/api-keys y crea una clave.",
      "Copia la clave.",
      "Pégala aquí — leemos tu lista de modelos en directo, así siempre ves los más nuevos.",
    ],
  },
  cerebras: {
    blurb:
      "La inferencia más rápida del mercado, sobre hardware propio.",
    guide: [
      "Crea una cuenta en cloud.cerebras.ai (hay plan gratuito).",
      "Crea una clave API desde el panel.",
      "Copia la clave.",
      "Pégala aquí — leemos tu lista de modelos en directo, así siempre ves los más nuevos.",
    ],
  },
  qwen: {
    blurb:
      "Los modelos Qwen directamente de Alibaba, con contexto muy largo.",
    guide: [
      "Crea una cuenta de Alibaba Cloud Model Studio (región internacional).",
      "Crea una clave API en la consola.",
      "Copia la clave.",
      "Pégala aquí — leemos tu lista de modelos en directo, así siempre ves los más nuevos.",
    ],
  },
  moonshot: {
    blurb:
      "Kimi — contexto muy largo y buen razonamiento sobre documentos.",
    guide: [
      "Crea una cuenta en platform.moonshot.ai y añade crédito.",
      "Abre la página de claves API y crea una clave.",
      "Copia la clave.",
      "Pégala aquí — leemos tu lista de modelos en directo, así siempre ves los más nuevos.",
    ],
  },
  zai: {
    blurb:
      "Modelos GLM de Zhipu — fuertes en razonamiento y muy económicos.",
    guide: [
      "Crea una cuenta en z.ai y añade crédito.",
      "Abre la página de claves API y crea una clave.",
      "Copia la clave.",
      "Pégala aquí — leemos tu lista de modelos en directo, así siempre ves los más nuevos.",
    ],
  },
  sambanova: {
    blurb:
      "Modelos abiertos servidos a muy alta velocidad sobre hardware propio.",
    guide: [
      "Crea una cuenta en cloud.sambanova.ai.",
      "Crea una clave API desde el panel.",
      "Copia la clave.",
      "Pégala aquí — leemos tu lista de modelos en directo, así siempre ves los más nuevos.",
    ],
  },
  deepinfra: {
    blurb:
      "Catálogo amplio de modelos abiertos con precios por token muy bajos.",
    guide: [
      "Crea una cuenta en deepinfra.com y añade crédito.",
      "Abre deepinfra.com/dash/api_keys y crea una clave.",
      "Copia la clave.",
      "Pégala aquí — leemos tu lista de modelos en directo, así siempre ves los más nuevos.",
    ],
  },
  nebius: {
    blurb:
      "Modelos abiertos alojados en Europa, con plan gratuito para empezar.",
    guide: [
      "Crea una cuenta en studio.nebius.com.",
      "Abre Ajustes → API keys y crea una clave.",
      "Copia la clave.",
      "Pégala aquí — leemos tu lista de modelos en directo, así siempre ves los más nuevos.",
    ],
  },
}

const BY_LOCALE: Record<Locale, Record<string, ProviderCopy>> = {
  en: EN,
  es: ES,
}

/**
 * Display copy for a provider. Falls back to the catalogue's own strings so a
 * newly added provider still renders something rather than nothing.
 */
export function providerCopy(
  providerId: string,
  locale: Locale,
): ProviderCopy {
  const pack = BY_LOCALE[locale] ?? EN
  const entry = pack[providerId] ?? EN[providerId]
  if (entry) return entry
  const fallback = getProvider(providerId)
  return {
    blurb: fallback?.blurb ?? "",
    guide: fallback?.guide ?? [],
  }
}
