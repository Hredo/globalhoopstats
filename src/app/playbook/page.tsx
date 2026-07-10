import type { Metadata } from "next"
import { PlaybookApp } from "@/components/playbook/playbook-app"
import { SITE } from "@/lib/site"
import { getT } from "@/lib/i18n/server"

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT()
  const title = t("playbook.metaTitle")
  const description = t("playbook.metaDescription")
  return {
    title,
    description,
    alternates: { canonical: "/playbook" },
    openGraph: {
      title: `${title} · ${SITE.name}`,
      description,
      url: `${SITE.url}/playbook`,
    },
  }
}

export default function PlaybookPage() {
  return <PlaybookApp />
}
