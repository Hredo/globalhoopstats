import type { Metadata } from "next"
import { PlaybookApp } from "@/components/playbook/playbook-app"
import { JsonLd } from "@/components/marketing/json-ld"
import { SITE } from "@/lib/site"
import { getT } from "@/lib/i18n/server"

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT()
  const title = t("playbook.metaTitle")
  const description = t("playbook.metaDescription")
  return {
    title,
    description,
    keywords: [
      "basketball playbook",
      "basketball play designer",
      "animated basketball plays",
      "basketball play diagram maker",
      "AI basketball play analysis",
      "pizarra de baloncesto online",
      "jugadas de baloncesto animadas",
      "diseñador de jugadas baloncesto",
    ],
    alternates: { canonical: "/playbook" },
    openGraph: {
      title: `${title} · ${SITE.name}`,
      description,
      url: `${SITE.url}/playbook`,
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} · ${SITE.name}`,
      description,
    },
  }
}

export default async function PlaybookPage() {
  const { t } = await getT()
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebApplication",
          name: t("playbook.metaTitle"),
          url: `${SITE.url}/playbook`,
          description: t("playbook.metaDescription"),
          applicationCategory: "SportsApplication",
          operatingSystem: "Web",
          offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
          featureList: [
            "Animated frame-by-frame play editor",
            "100+ professional set templates",
            "Real rosters from six leagues",
            "AI tactical analysis",
            "Photo import from whiteboard diagrams",
            "PNG and JSON export",
          ],
          publisher: { "@type": "Organization", name: SITE.name, url: SITE.url },
        }}
      />
      <h1 className="sr-only">{t("playbook.page.title")}</h1>
      <p className="sr-only">{t("playbook.page.description")}</p>
      <PlaybookApp />
    </>
  )
}
