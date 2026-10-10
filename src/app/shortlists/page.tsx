import type { Metadata } from "next"
import { DirectoryHero } from "@/components/ui/directory-hero"
import { getT } from "@/lib/i18n/server"
import { ShortlistsClient } from "./client"

export const dynamic = "force-dynamic"

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT()
  return { title: t("shortlistsPage.title"), robots: { index: false, follow: false } }
}

export default async function ShortlistsPage() {
  const { t } = await getT()
  return (
    <div className="pb-16">
      <DirectoryHero
        eyebrow={t("shortlistsPage.eyebrow")}
        title={t("shortlistsPage.title")}
        description={t("shortlistsPage.lede")}
      />
      <ShortlistsClient />
    </div>
  )
}
