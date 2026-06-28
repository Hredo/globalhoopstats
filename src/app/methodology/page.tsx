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

export default async function MethodologyPage() {
  const { t, locale } = await getT()
  const es = locale === "es"
  const lastSync = await getLatestSyncTime()

  return (
    <article className="prose-custom mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-2 text-sm text-ink-300 transition hover:text-brand-300"
      >
        ← {t("common.home")}
      </Link>

      <h1>{es ? "Metodología y fuentes" : "Methodology & sources"}</h1>
      <p className="text-ink-400">
        {lastSync
          ? t("common.dataUpdated", { ago: formatRelativeAgo(lastSync, t) })
          : t("common.updatePending")}
      </p>

      <p>
        {es
          ? "Creemos que la confianza en una plataforma de datos se gana siendo transparente sobre de dónde salen los números, cómo se procesan y cuándo se actualizan. Esta página lo explica."
          : "We believe trust in a data platform is earned by being transparent about where the numbers come from, how they are processed and when they are refreshed. This page explains exactly that."}
      </p>

      <h2>{es ? "1. Fuentes de datos" : "1. Data sources"}</h2>
      <p>
        {es
          ? "Agregamos estadísticas que son de acceso público en las webs oficiales de cada competición. Cubrimos NBA, EuroLeague, ACB (Liga Endesa) y el escalafón FEB de España: LEB Oro, LEB Plata y EBA. Cada competición se recoge con un adaptador propio que normaliza su formato a un modelo común."
          : "We aggregate statistics that are publicly available on each competition's official website. We cover the NBA, EuroLeague, ACB (Liga Endesa) and Spain's FEB ladder: LEB Oro, LEB Plata and EBA. Each competition is collected by its own adapter that normalizes its format into a shared model."}
      </p>
      <p>
        {es
          ? "Recogemos los datos con un rastreador identificado y respetuoso (límite de frecuencia, respeto a las cabeceras de los servidores y solo datos públicos). Los detalles están en nuestra "
          : "We collect the data with an identified, respectful crawler (rate-limited, honoring servers' headers, public data only). The details are on our "}
        <Link href="/bot">{es ? "política del rastreador" : "crawler policy"}</Link>.
      </p>

      <h2>{es ? "2. Frescura de los datos" : "2. Data freshness"}</h2>
      <p>
        {es
          ? "Los datos se sincronizan automáticamente cada noche. En cada liga, jugador y equipo verás un sello de “Datos actualizados …” que indica cuándo se sincronizó por última vez esa información, para que sepas siempre cómo de reciente es lo que estás viendo."
          : "Data is synced automatically every night. On each league, player and team you'll see a “Data updated …” stamp showing when that information was last synced, so you always know how recent what you're looking at is."}
      </p>

      <h2>
        {es
          ? "3. Identidad unificada entre ligas"
          : "3. Unified cross-league identity"}
      </h2>
      <p>
        {es
          ? "Los jugadores y entrenadores se mueven entre ligas (un jugador puede pasar de EBA a LEB y a la ACB). Mantenemos una única ficha por persona y conectamos sus líneas estadísticas de cada competición, en lugar de crear perfiles duplicados. Esto permite comparar y seguir una carrera completa de forma coherente."
          : "Players and coaches move between leagues (a player may go from EBA to LEB to the ACB). We keep a single profile per person and connect their stat lines from each competition, instead of creating duplicate profiles. This lets you compare and follow an entire career coherently."}
      </p>

      <h2>{es ? "4. Valoración de mercado" : "4. Market valuation"}</h2>
      <p>
        {es
          ? "La valoración de mercado es una estimación calculada a partir de las estadísticas, no una cifra oficial de transacciones. Se deriva del rendimiento (producción, eficiencia, minutos) y del contexto de la liga. La presentamos como una estimación orientativa y no debe interpretarse como un precio real de traspaso."
          : "The market valuation is an estimate computed from statistics, not an official transaction figure. It is derived from performance (production, efficiency, minutes) and league context. We present it as an indicative estimate and it should not be read as a real transfer price."}
      </p>

      <h2>{es ? "5. Controles de calidad" : "5. Quality controls"}</h2>
      <p>
        {es
          ? "Antes de publicar una sincronización, cada lote pasa por un control de calidad. Si una recogida parece rota (vacía, mayoritariamente en blanco, o con una caída brusca respecto a la última sincronización correcta), se rechaza y se conserva el dato bueno anterior, en lugar de sobrescribirlo. Preferimos un dato algo más antiguo pero correcto a uno nuevo y roto."
          : "Before a sync is published, every batch passes a quality check. If a collection looks broken (empty, mostly blank, or a sharp drop versus the last good sync), it is rejected and the previous good data is kept rather than overwritten. We prefer slightly older but correct data over new but broken data."}
      </p>

      <h2>{es ? "6. Atribución y contacto" : "6. Attribution & contact"}</h2>
      <p>
        {es
          ? "GlobalHoopStats no está afiliado ni respaldado por la NBA, EuroLeague, ACB, FEB ni ningún club. Los nombres, logos e imágenes son propiedad de sus titulares y se usan con fines informativos. Para cualquier corrección, duda sobre los datos o solicitud de retirada, escríbenos a "
          : "GlobalHoopStats is not affiliated with or endorsed by the NBA, EuroLeague, ACB, FEB or any club. Names, logos and images are the property of their owners and are used for informational purposes. For any correction, data question or removal request, contact us at "}
        <a href="mailto:data@globalhoopstats.es">data@globalhoopstats.es</a>
        {es ? " o desde la " : " or via the "}
        <Link href="/contact">{es ? "página de contacto" : "contact page"}</Link>.
      </p>
    </article>
  )
}
