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
 * No model names here. Copy that said "GPT-5.5 — OpenAI's latest" was wrong
 * within weeks; which models are newest is shown live next to this text, from
 * models.dev (`ai/catalog-live.ts`).
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

const LIVE_EN =
  "Paste it here — we read your model list live, so you always see the newest ones."
const LIVE_ES =
  "Pégala aquí — leemos tu lista de modelos en directo, así siempre ves los más nuevos."

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
    blurb: "The GPT family, from cheap fast models to OpenAI's flagship.",
    guide: [
      "Create an account at platform.openai.com and add billing.",
      "Open platform.openai.com/api-keys and create a new secret key.",
      "Copy the key (starts with sk-…) — it is shown only once.",
      LIVE_EN,
    ],
  },
  anthropic: {
    blurb:
      "Claude — the strongest option for careful analysis and long reasoning.",
    guide: [
      "Sign in at console.anthropic.com and add credits.",
      "Go to Settings → API keys and create a key.",
      "Copy the key (starts with sk-ant-…).",
      LIVE_EN,
    ],
  },
  google: {
    blurb: "Gemini, with a free tier and native Google Search grounding.",
    guide: [
      "Open aistudio.google.com/app/apikey and sign in with Google.",
      'Click "Create API key" (a free tier is available).',
      "Copy the key (starts with AIza…).",
      LIVE_EN,
    ],
  },
  groq: {
    blurb: "Very fast inference of open models on Groq's own LPU hardware.",
    guide: [
      "Create an account at console.groq.com (free to start).",
      "Open console.groq.com/keys and create an API key.",
      "Copy the key (starts with gsk_…).",
      LIVE_EN,
    ],
  },
  mistral: {
    blurb: "European models from Mistral, hosted in the EU.",
    guide: [
      "Sign up at console.mistral.ai and add a payment method.",
      "Go to API keys and create a new key.",
      "Copy the key.",
      LIVE_EN,
    ],
  },
  openrouter: {
    blurb:
      "One key, hundreds of models — unified access to every major vendor.",
    guide: [
      "Create an account at openrouter.ai and add credits.",
      "Open openrouter.ai/keys and create a key.",
      "Copy the key (starts with sk-or-…).",
      LIVE_EN,
    ],
  },
  deepseek: {
    blurb: "Open-weight DeepSeek models at a very low price per token.",
    guide: [
      "Sign up at platform.deepseek.com and top up a little credit.",
      "Open the API keys page and create a key.",
      "Copy the key (starts with sk-…).",
      LIVE_EN,
    ],
  },
  xai: {
    blurb: "Grok from xAI, with very long context and image input.",
    guide: [
      "Sign in at console.x.ai and add billing.",
      "Create an API key from the console.",
      "Copy the key (starts with xai-…).",
      LIVE_EN,
    ],
  },
  perplexity: {
    blurb: "Sonar — every answer grounded on a live web search.",
    guide: [
      "Open perplexity.ai/settings/api and add a payment method.",
      "Generate an API key.",
      "Copy the key (starts with pplx-…).",
      "Paste it here — Sonar searches the web on every answer.",
    ],
  },
  together: {
    blurb:
      "Hundreds of open models (Llama, Qwen, DeepSeek) served fast and cheap.",
    guide: [
      "Create an account at together.ai and add credit.",
      "Open api.together.xyz/settings/api-keys and create a key.",
      "Copy the key.",
      LIVE_EN,
    ],
  },
  fireworks: {
    blurb: "Fast inference of open models at a good price per token.",
    guide: [
      "Create an account at fireworks.ai and add billing.",
      "Open app.fireworks.ai → Settings → API keys and create a key.",
      "Copy the key.",
      LIVE_EN,
    ],
  },
  cerebras: {
    blurb: "The fastest inference on the market, on Cerebras' own hardware.",
    guide: [
      "Create an account at cloud.cerebras.ai (free tier available).",
      "Create an API key from the dashboard.",
      "Copy the key.",
      LIVE_EN,
    ],
  },
  qwen: {
    blurb: "Qwen models straight from Alibaba, with very long context.",
    guide: [
      "Create an Alibaba Cloud Model Studio account (international region).",
      "Create an API key in the console.",
      "Copy the key.",
      LIVE_EN,
    ],
  },
  moonshot: {
    blurb: "Kimi — very long context and strong reasoning over documents.",
    guide: [
      "Create an account at platform.moonshot.ai and add credit.",
      "Open the API keys page and create a key.",
      "Copy the key.",
      LIVE_EN,
    ],
  },
  zai: {
    blurb: "Zhipu's GLM models, strong at reasoning and very cheap.",
    guide: [
      "Create an account at z.ai and add credit.",
      "Open the API keys page and create a key.",
      "Copy the key.",
      LIVE_EN,
    ],
  },
  sambanova: {
    blurb: "Open models served at very high speed on SambaNova's own hardware.",
    guide: [
      "Create an account at cloud.sambanova.ai.",
      "Create an API key from the dashboard.",
      "Copy the key.",
      LIVE_EN,
    ],
  },
  deepinfra: {
    blurb: "A wide catalogue of open models at very low per-token prices.",
    guide: [
      "Create an account at deepinfra.com and add credit.",
      "Open deepinfra.com/dash/api_keys and create a key.",
      "Copy the key.",
      LIVE_EN,
    ],
  },
  nebius: {
    blurb: "Open models hosted in Europe, with free credit to start.",
    guide: [
      "Create an account at tokenfactory.nebius.com.",
      "Open the API keys page and create a key.",
      "Copy the key.",
      LIVE_EN,
    ],
  },
  scaleway: {
    blurb:
      "Open models served from data centres in France — your data stays in the EU.",
    guide: [
      "Create an account at console.scaleway.com.",
      "Open IAM → API keys and generate a key.",
      "Copy the secret key (not the access key).",
      LIVE_EN,
    ],
  },
  "ollama-cloud": {
    blurb:
      "Large open models run by Ollama in the cloud — no GPU of your own needed.",
    guide: [
      "Sign in at ollama.com.",
      "Open ollama.com/settings/keys and create an API key.",
      "Copy the key.",
      LIVE_EN,
    ],
  },
  nvidia: {
    blurb:
      "Open models on NVIDIA's own endpoints, with free credits for developers.",
    guide: [
      "Sign in at build.nvidia.com.",
      "Open Settings → API keys and generate a key.",
      "Copy the key (starts with nvapi-…).",
      LIVE_EN,
    ],
  },
  huggingface: {
    blurb:
      "One token for the open models served by Hugging Face's partner providers.",
    guide: [
      "Sign in at huggingface.co.",
      "Open Settings → Access tokens and create a token with the “Make calls to Inference Providers” permission.",
      "Copy the token (starts with hf_…).",
      LIVE_EN,
    ],
  },
  novita: {
    blurb:
      "Low-cost access to the newest open models as soon as they are released.",
    guide: [
      "Create an account at novita.ai and add credit.",
      "Open Settings → Key management and create a key.",
      "Copy the key.",
      LIVE_EN,
    ],
  },
  siliconflow: {
    blurb: "Fast, cheap hosting for the Qwen, GLM and DeepSeek families.",
    guide: [
      "Create an account at cloud.siliconflow.com.",
      "Open the API keys page and create a key.",
      "Copy the key (starts with sk-…).",
      LIVE_EN,
    ],
  },
  chutes: {
    blurb: "Decentralised inference of open models, billed per use.",
    guide: [
      "Create an account at chutes.ai.",
      "Open the API page and create a key.",
      "Copy the key.",
      LIVE_EN,
    ],
  },
}

const ES: Record<string, ProviderCopy> = {
  ollama: {
    blurb:
      "Cualquier modelo que tengas instalado en tu máquina. Privado, sin clave y sin coste.",
    guide: [
      "Instala la app de Ollama desde ollama.com/download.",
      "Descarga un modelo en tu terminal, por ejemplo: ollama pull llama3.1:8b",
      "Asegúrate de que Ollama está en marcha (la app, o `ollama serve`).",
      "Elige «Ollama (local)» aquí — lo detectamos solo, sin clave, y la lista muestra los modelos que tienes instalados.",
    ],
  },
  openai: {
    blurb:
      "La familia GPT, desde modelos rápidos y baratos hasta el buque insignia de OpenAI.",
    guide: [
      "Crea una cuenta en platform.openai.com y añade un método de pago.",
      "Abre platform.openai.com/api-keys y crea una clave secreta.",
      "Copia la clave (empieza por sk-…) — solo se muestra una vez.",
      LIVE_ES,
    ],
  },
  anthropic: {
    blurb:
      "Claude — la opción más sólida para análisis cuidadosos y razonamientos largos.",
    guide: [
      "Entra en console.anthropic.com y añade crédito.",
      "Ve a Settings → API keys y crea una clave.",
      "Copia la clave (empieza por sk-ant-…).",
      LIVE_ES,
    ],
  },
  google: {
    blurb: "Gemini, con plan gratuito y búsqueda de Google integrada.",
    guide: [
      "Abre aistudio.google.com/app/apikey e inicia sesión con Google.",
      "Pulsa «Create API key» (hay plan gratuito).",
      "Copia la clave (empieza por AIza…).",
      LIVE_ES,
    ],
  },
  groq: {
    blurb:
      "Inferencia ultrarrápida de modelos abiertos sobre el hardware LPU de Groq.",
    guide: [
      "Crea una cuenta en console.groq.com (gratis para empezar).",
      "Abre console.groq.com/keys y crea una clave.",
      "Copia la clave (empieza por gsk_…).",
      LIVE_ES,
    ],
  },
  mistral: {
    blurb: "Los modelos europeos de Mistral, alojados en la UE.",
    guide: [
      "Regístrate en console.mistral.ai y añade un método de pago.",
      "Ve a API keys y crea una clave.",
      "Copia la clave.",
      LIVE_ES,
    ],
  },
  openrouter: {
    blurb:
      "Una clave, cientos de modelos — acceso unificado a todos los grandes proveedores.",
    guide: [
      "Crea una cuenta en openrouter.ai y añade crédito.",
      "Abre openrouter.ai/keys y crea una clave.",
      "Copia la clave (empieza por sk-or-…).",
      LIVE_ES,
    ],
  },
  deepseek: {
    blurb: "Modelos abiertos de DeepSeek a un precio por token muy bajo.",
    guide: [
      "Regístrate en platform.deepseek.com y recarga un poco de saldo.",
      "Abre la página de API keys y crea una clave.",
      "Copia la clave (empieza por sk-…).",
      LIVE_ES,
    ],
  },
  xai: {
    blurb: "Grok de xAI, con contexto muy largo y entrada de imágenes.",
    guide: [
      "Entra en console.x.ai y añade un método de pago.",
      "Crea una clave desde la consola.",
      "Copia la clave (empieza por xai-…).",
      LIVE_ES,
    ],
  },
  perplexity: {
    blurb: "Sonar — cada respuesta se apoya en una búsqueda web en directo.",
    guide: [
      "Abre perplexity.ai/settings/api y añade un método de pago.",
      "Genera una clave.",
      "Copia la clave (empieza por pplx-…).",
      "Pégala aquí — Sonar busca en la web en cada respuesta.",
    ],
  },
  together: {
    blurb:
      "Cientos de modelos abiertos (Llama, Qwen, DeepSeek) servidos rápido y barato.",
    guide: [
      "Crea una cuenta en together.ai y añade crédito.",
      "Abre api.together.xyz/settings/api-keys y crea una clave.",
      "Copia la clave.",
      LIVE_ES,
    ],
  },
  fireworks: {
    blurb: "Inferencia rápida de modelos abiertos con buen precio por token.",
    guide: [
      "Crea una cuenta en fireworks.ai y añade un método de pago.",
      "Abre app.fireworks.ai → Settings → API keys y crea una clave.",
      "Copia la clave.",
      LIVE_ES,
    ],
  },
  cerebras: {
    blurb: "La inferencia más rápida del mercado, sobre hardware propio.",
    guide: [
      "Crea una cuenta en cloud.cerebras.ai (hay plan gratuito).",
      "Crea una clave desde el panel.",
      "Copia la clave.",
      LIVE_ES,
    ],
  },
  qwen: {
    blurb: "Los modelos Qwen directamente de Alibaba, con contexto muy largo.",
    guide: [
      "Crea una cuenta de Alibaba Cloud Model Studio (región internacional).",
      "Crea una clave en la consola.",
      "Copia la clave.",
      LIVE_ES,
    ],
  },
  moonshot: {
    blurb: "Kimi — contexto muy largo y buen razonamiento sobre documentos.",
    guide: [
      "Crea una cuenta en platform.moonshot.ai y añade crédito.",
      "Abre la página de API keys y crea una clave.",
      "Copia la clave.",
      LIVE_ES,
    ],
  },
  zai: {
    blurb:
      "Los modelos GLM de Zhipu, fuertes en razonamiento y muy económicos.",
    guide: [
      "Crea una cuenta en z.ai y añade crédito.",
      "Abre la página de API keys y crea una clave.",
      "Copia la clave.",
      LIVE_ES,
    ],
  },
  sambanova: {
    blurb:
      "Modelos abiertos servidos a muy alta velocidad sobre hardware propio.",
    guide: [
      "Crea una cuenta en cloud.sambanova.ai.",
      "Crea una clave desde el panel.",
      "Copia la clave.",
      LIVE_ES,
    ],
  },
  deepinfra: {
    blurb:
      "Catálogo amplio de modelos abiertos con precios por token muy bajos.",
    guide: [
      "Crea una cuenta en deepinfra.com y añade crédito.",
      "Abre deepinfra.com/dash/api_keys y crea una clave.",
      "Copia la clave.",
      LIVE_ES,
    ],
  },
  nebius: {
    blurb:
      "Modelos abiertos alojados en Europa, con crédito gratuito para empezar.",
    guide: [
      "Crea una cuenta en tokenfactory.nebius.com.",
      "Abre la página de API keys y crea una clave.",
      "Copia la clave.",
      LIVE_ES,
    ],
  },
  scaleway: {
    blurb:
      "Modelos abiertos servidos desde centros de datos en Francia — tus datos no salen de la UE.",
    guide: [
      "Crea una cuenta en console.scaleway.com.",
      "Abre IAM → API keys y genera una clave.",
      "Copia la clave secreta (no la de acceso).",
      LIVE_ES,
    ],
  },
  "ollama-cloud": {
    blurb:
      "Modelos abiertos grandes ejecutados por Ollama en la nube — sin necesitar GPU propia.",
    guide: [
      "Inicia sesión en ollama.com.",
      "Abre ollama.com/settings/keys y crea una clave.",
      "Copia la clave.",
      LIVE_ES,
    ],
  },
  nvidia: {
    blurb:
      "Modelos abiertos en los servidores de NVIDIA, con créditos gratis para desarrolladores.",
    guide: [
      "Inicia sesión en build.nvidia.com.",
      "Abre Settings → API keys y genera una clave.",
      "Copia la clave (empieza por nvapi-…).",
      LIVE_ES,
    ],
  },
  huggingface: {
    blurb:
      "Un solo token para los modelos abiertos que sirven los proveedores asociados de Hugging Face.",
    guide: [
      "Inicia sesión en huggingface.co.",
      "Abre Settings → Access tokens y crea un token con el permiso «Make calls to Inference Providers».",
      "Copia el token (empieza por hf_…).",
      LIVE_ES,
    ],
  },
  novita: {
    blurb: "Acceso barato a los modelos abiertos más nuevos en cuanto salen.",
    guide: [
      "Crea una cuenta en novita.ai y añade crédito.",
      "Abre Settings → Key management y crea una clave.",
      "Copia la clave.",
      LIVE_ES,
    ],
  },
  siliconflow: {
    blurb: "Alojamiento rápido y barato de las familias Qwen, GLM y DeepSeek.",
    guide: [
      "Crea una cuenta en cloud.siliconflow.com.",
      "Abre la página de API keys y crea una clave.",
      "Copia la clave (empieza por sk-…).",
      LIVE_ES,
    ],
  },
  chutes: {
    blurb: "Inferencia descentralizada de modelos abiertos, pagando por uso.",
    guide: [
      "Crea una cuenta en chutes.ai.",
      "Abre la página de API y crea una clave.",
      "Copia la clave.",
      LIVE_ES,
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
export function providerCopy(providerId: string, locale: Locale): ProviderCopy {
  const pack = BY_LOCALE[locale] ?? EN
  const entry = pack[providerId] ?? EN[providerId]
  if (entry) return entry
  const fallback = getProvider(providerId)
  return {
    blurb: fallback?.blurb ?? "",
    guide: fallback?.guide ?? [],
  }
}
