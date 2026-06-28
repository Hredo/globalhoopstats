import type { Metadata } from "next"
import Link from "next/link"
import { SITE } from "@/lib/site"
import { getLocale } from "@/lib/i18n/server"

export const metadata: Metadata = {
  title: "Crawler Policy",
  description:
    "How the GlobalHoopStats crawler (GlobalHoopStatsBot) collects publicly available basketball statistics — responsibly, identifiably and at a low request rate.",
  alternates: { canonical: "/bot" },
  openGraph: {
    title: `Crawler Policy · ${SITE.name}`,
    description:
      "How the GlobalHoopStats crawler collects public basketball statistics responsibly.",
    url: `${SITE.url}/bot`,
    type: "article",
  },
}

const USER_AGENT =
  "GlobalHoopStatsBot/1.0 (+https://globalhoopstats.es/bot; data@globalhoopstats.es)"

export default async function BotPolicyPage() {
  const locale = await getLocale()
  const es = locale === "es"
  const lastUpdated = "2026-06-28"

  return (
    <article className="prose-custom mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-2 text-sm text-ink-300 transition hover:text-brand-300"
      >
        ← {es ? "Volver al inicio" : "Back to home"}
      </Link>

      <h1>{es ? "Política del rastreador" : "Crawler Policy"}</h1>
      <p className="text-ink-400">
        {es ? "Última actualización" : "Last updated"}: {lastUpdated}
      </p>

      <p>
        {es
          ? `${SITE.name} agrega estadísticas de baloncesto que son públicas en las webs oficiales de las competiciones. Recogemos esos datos con un rastreador automatizado, identificado y respetuoso. Esta página explica cómo opera y cómo contactar o limitar su acceso.`
          : `${SITE.name} aggregates basketball statistics that are publicly available on competitions' official websites. We collect that data with an identified, well-behaved automated crawler. This page explains how it operates and how to contact us or limit its access.`}
      </p>

      <h2>{es ? "Identificación" : "Identification"}</h2>
      <p>
        {es
          ? "Nuestro rastreador se identifica siempre con esta cadena User-Agent, sin disfrazarse de navegador:"
          : "Our crawler always identifies itself with this User-Agent string and never disguises itself as a browser:"}
      </p>
      <pre className="overflow-x-auto rounded-lg border border-white/10 bg-surface-0/60 p-4 font-mono text-xs">
        {USER_AGENT}
      </pre>

      <h2>{es ? "Buenas prácticas" : "How we behave"}</h2>
      <ul>
        <li>
          {es
            ? "Limitamos la frecuencia: las peticiones a un mismo servidor se serializan y se espacian para no generar carga."
            : "We rate-limit ourselves: requests to a given host are serialized and spaced out to avoid load."}
        </li>
        <li>
          {es
            ? "Respetamos la cabecera Retry-After y los códigos 429/503, reduciendo el ritmo cuando un servidor lo pide."
            : "We honor the Retry-After header and 429/503 responses, backing off when a server asks us to."}
        </li>
        <li>
          {es
            ? "Solo recogemos datos estadísticos de acceso público; no intentamos sortear muros de pago, autenticación ni controles de acceso."
            : "We only collect publicly accessible statistical data; we do not attempt to bypass paywalls, authentication or access controls."}
        </li>
        <li>
          {es
            ? "Atribuimos la procedencia de los datos y añadimos valor (normalización entre ligas, contexto, visualización) en lugar de redistribuir las bases de datos en bruto."
            : "We attribute data provenance and add value (cross-league normalization, context, visualization) rather than redistributing raw databases wholesale."}
        </li>
      </ul>

      <h2>{es ? "Contacto y exclusión" : "Contact & opt-out"}</h2>
      <p>
        {es
          ? "Si gestionas una de nuestras fuentes y quieres ajustar, limitar o detener el acceso de nuestro rastreador —o explorar un acuerdo de datos oficial— escríbenos a "
          : "If you operate one of our sources and want to adjust, limit or stop our crawler's access — or explore an official data agreement — contact us at "}
        <a href="mailto:data@globalhoopstats.es">data@globalhoopstats.es</a>
        {es
          ? ". Atenderemos cualquier petición de exclusión con rapidez."
          : ". We will act on any opt-out request promptly."}
      </p>
    </article>
  )
}
