import type { Metadata } from "next"
import Link from "next/link"
import { SITE } from "@/lib/site"
import { getLatestSyncTime } from "@/lib/data/sync"
import { formatRelativeAgo } from "@/lib/format-time"
import { getT } from "@/lib/i18n/server"

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getT()
  const es = locale === "es"
  const description = es
    ? "Cómo recoge, normaliza, unifica y actualiza GlobalHoopStats las estadísticas de baloncesto — fuentes, frescura de los datos, identidad entre ligas, valoración de mercado y controles de calidad."
    : "How GlobalHoopStats collects, normalizes, unifies and refreshes basketball statistics — sources, data freshness, cross-league identity, market valuation and quality controls."
  return {
    title: es ? "Metodología y fuentes" : "Methodology & sources",
    description,
    alternates: { canonical: "/methodology" },
    openGraph: {
      title: `${es ? "Metodología" : "Methodology"} · ${SITE.name}`,
      description,
      url: `${SITE.url}/methodology`,
      type: "article",
    },
  }
}

export const revalidate = 600

const sections = [
  { id: "fuentes", labelEn: "Data sources", labelEs: "Fuentes de datos" },
  { id: "frescura", labelEn: "Data freshness", labelEs: "Frescura de los datos" },
  { id: "identidad", labelEn: "Unified cross-league identity", labelEs: "Identidad unificada entre ligas" },
  { id: "valoracion", labelEn: "Market valuation", labelEs: "Valoración de mercado" },
  { id: "calidad", labelEn: "Quality controls", labelEs: "Controles de calidad" },
  { id: "atribucion", labelEn: "Attribution & contact", labelEs: "Atribución y contacto" },
]

const sectionNumbers = ["01", "02", "03", "04", "05", "06"]

export default async function MethodologyPage() {
  const { t, locale } = await getT()
  const es = locale === "es"
  const lastSync = await getLatestSyncTime()

  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <Link
        href="/"
        className="mb-8 inline-flex items-center gap-2 text-sm text-ink-400 transition hover:text-brand-300"
      >
        ← {t("common.home")}
      </Link>

      <header className="mb-12">
        <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">
          {es ? "Documentación" : "Documentation"}
        </p>
        <h1 className="font-display text-4xl font-bold leading-[0.92] tracking-[-0.04em] sm:text-5xl md:text-6xl">
          {es ? "Metodología y fuentes" : "Methodology & sources"}
        </h1>
        <p className="mt-4 text-sm text-ink-400">
          {lastSync
            ? t("common.dataUpdated", { ago: formatRelativeAgo(lastSync, t) })
            : t("common.updatePending")}
        </p>
      </header>

      <div className="mb-16 text-base leading-relaxed text-ink-300">
        <span className="gh-dropcap block">
          {es
            ? "Creemos que la confianza en una plataforma de datos se gana siendo transparente sobre de dónde salen los números, cómo se procesan y cuándo se actualizan. Esta página lo explica."
            : "We believe trust in a data platform is earned by being transparent about where the numbers come from, how they are processed and when they are refreshed. This page explains exactly that."}
        </span>
      </div>

      <div className="mb-16 rounded-2xl border border-hairline bg-surface-1 p-5 sm:p-6">
        <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">
          {es ? "Contenidos" : "Contents"}
        </p>
        <nav className="flex flex-col gap-2">
          {sections.map((s, i) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="group flex items-center gap-3 text-sm text-ink-300 transition hover:text-brand-300"
            >
              <span className="font-mono text-[10px] tracking-widest text-ink-500 transition group-hover:text-brand-400">
                {sectionNumbers[i]}
              </span>
              <span className="h-px flex-1 bg-hairline transition group-hover:bg-brand-500/30" />
              <span>{es ? s.labelEs : s.labelEn}</span>
            </a>
          ))}
        </nav>
      </div>

      {sections.map((s, i) => (
        <section
          key={s.id}
          id={s.id}
          className="mb-10 animate-rise"
          style={{ animationDelay: `${0.1 + i * 0.06}s` }}
        >
          <h2 className="gh-title-rule mb-4 font-display text-2xl font-semibold leading-[1.1] tracking-[-0.02em] sm:text-3xl">
            {es ? s.labelEs : s.labelEn}
          </h2>
          <div className="space-y-3 text-sm leading-relaxed text-ink-300 sm:text-base">
            {renderContent(i, es)}
          </div>
        </section>
      ))}

      <footer className="mt-16 border-t border-hairline pt-8 text-center">
        <p className="text-sm text-ink-400">
          {es ? "¿Dudas o correcciones?" : "Questions or corrections?"}
        </p>
        <Link
          href="/contact"
          className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-brand-400 transition hover:text-brand-300"
        >
          {es ? "Escríbenos" : "Contact us"} →
        </Link>
      </footer>
    </article>
  )
}

function renderContent(index: number, es: boolean) {
  const link = (href: string, text: string) => (
    <Link href={href} className="text-brand-400 underline decoration-1 underline-offset-2 transition hover:text-brand-300">
      {text}
    </Link>
  )
  const mailto = (email: string, text: string) => (
    <a href={`mailto:${email}`} className="text-brand-400 underline decoration-1 underline-offset-2 transition hover:text-brand-300">
      {text}
    </a>
  )

  const all = es ? esContent : enContent
  const section = all[index]
  if (!section) return null

  return section.map((para, pi) => <p key={pi}>{para}</p>)
}

const enContent: React.ReactNode[][] = [
  [
    "We aggregate statistics that are publicly available on each competition\u2019s official website. We cover the NBA, EuroLeague, ACB (Liga Endesa) and Spain\u2019s FEB ladder: Primera FEB, Segunda FEB and Tercera FEB. Each competition is collected by its own adapter that normalizes its format into a shared model.",
    <>
      We collect the data with an identified, respectful crawler (rate-limited, honoring servers\u2019 headers, public data only). The details are on our{" "}
      <Link href="/bot" className="text-brand-400 underline decoration-1 underline-offset-2 transition hover:text-brand-300">crawler policy</Link>.
    </>,
  ],
  [
    "Data is synced automatically every night. On each league, player and team you\u2019ll see a \u201cData updated \u2026\u201d stamp showing when that information was last synced, so you always know how recent what you\u2019re looking at is.",
  ],
  [
    "Players and coaches move between leagues (a player may go from Tercera FEB to Primera FEB to the ACB). We keep a single profile per person and connect their stat lines from each competition, instead of creating duplicate profiles. This lets you compare and follow an entire career coherently.",
  ],
  [
    "The market valuation is an estimate computed from statistics, not an official transaction figure. It is derived from performance (production, efficiency, minutes) and league context. We present it as an indicative estimate and it should not be read as a real transfer price.",
  ],
  [
    "Before a sync is published, every batch passes a quality check. If a collection looks broken (empty, mostly blank, or a sharp drop versus the last good sync), it is rejected and the previous good data is kept rather than overwritten. We prefer slightly older but correct data over new but broken data.",
  ],
  [
    <>
      GlobalHoopStats is not affiliated with or endorsed by the NBA, EuroLeague, ACB, FEB or any club. Names, logos and images are the property of their owners and are used for informational purposes. For any correction, data question or removal request, contact us at{" "}
      <a href="mailto:data@globalhoopstats.es" className="text-brand-400 underline decoration-1 underline-offset-2 transition hover:text-brand-300">data@globalhoopstats.es</a>{" "}
      or via the{" "}
      <Link href="/contact" className="text-brand-400 underline decoration-1 underline-offset-2 transition hover:text-brand-300">contact page</Link>.
    </>,
  ],
]

const esContent: React.ReactNode[][] = [
  [
    "Agregamos estadísticas que son de acceso público en las webs oficiales de cada competición. Cubrimos NBA, EuroLeague, ACB (Liga Endesa) y el escalafón FEB de España: Primera FEB, Segunda FEB y Tercera FEB. Cada competición se recoge con un adaptador propio que normaliza su formato a un modelo común.",
    <>
      Recogemos los datos con un rastreador identificado y respetuoso (límite de frecuencia, respeto a las cabeceras de los servidores y solo datos públicos). Los detalles están en nuestra{" "}
      <Link href="/bot" className="text-brand-400 underline decoration-1 underline-offset-2 transition hover:text-brand-300">política del rastreador</Link>.
    </>,
  ],
  [
    "Los datos se sincronizan automáticamente cada noche. En cada liga, jugador y equipo verás un sello de \u201cDatos actualizados \u2026\u201d que indica cuándo se sincronizó por última vez esa información, para que sepas siempre cómo de reciente es lo que estás viendo.",
  ],
  [
    "Los jugadores y entrenadores se mueven entre ligas (un jugador puede pasar de Tercera FEB a Primera FEB y a la ACB). Mantenemos una única ficha por persona y conectamos sus líneas estadísticas de cada competición, en lugar de crear perfiles duplicados. Esto permite comparar y seguir una carrera completa de forma coherente.",
  ],
  [
    "La valoración de mercado es una estimación calculada a partir de las estadísticas, no una cifra oficial de transacciones. Se deriva del rendimiento (producción, eficiencia, minutos) y del contexto de la liga. La presentamos como una estimación orientativa y no debe interpretarse como un precio real de traspaso.",
  ],
  [
    "Antes de publicar una sincronización, cada lote pasa por un control de calidad. Si una recogida parece rota (vacía, mayoritariamente en blanco, o con una caída brusca respecto a la última sincronización correcta), se rechaza y se conserva el dato bueno anterior, en lugar de sobrescribirlo. Preferimos un dato algo más antiguo pero correcto a uno nuevo y roto.",
  ],
  [
    <>
      GlobalHoopStats no está afiliado ni respaldado por la NBA, EuroLeague, ACB, FEB ni ningún club. Los nombres, logos e imágenes son propiedad de sus titulares y se usan con fines informativos. Para cualquier corrección, duda sobre los datos o solicitud de retirada, escríbenos a{" "}
      <a href="mailto:data@globalhoopstats.es" className="text-brand-400 underline decoration-1 underline-offset-2 transition hover:text-brand-300">data@globalhoopstats.es</a>{" "}
      o desde la{" "}
      <Link href="/contact" className="text-brand-400 underline decoration-1 underline-offset-2 transition hover:text-brand-300">página de contacto</Link>.
    </>,
  ],
]
