import type { Metadata } from "next"
import { ContactForm } from "./form"
import { SITE } from "@/lib/site"
import { getT } from "@/lib/i18n/server"

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT()
  const title = t("contact.metaTitle")
  const description = t("contact.metaDescription", { name: SITE.name })
  return {
    title,
    description,
    alternates: { canonical: "/contact" },
    openGraph: {
      title: `${title} · ${SITE.name}`,
      description,
      url: `${SITE.url}/contact`,
    },
  }
}

export default function ContactPage() {
  return <ContactForm />
}
