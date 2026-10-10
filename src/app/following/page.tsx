import type { Metadata } from "next"
import { DirectoryHero } from "@/components/ui/directory-hero"
import { getT } from "@/lib/i18n/server"
import { FollowingClient } from "./client"

export const dynamic = "force-dynamic"

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT()
  // Personal page: never indexed.
  return { title: t("followingPage.title"), robots: { index: false, follow: false } }
}

export default async function FollowingPage() {
  const { t } = await getT()
  return (
    <div className="pb-16">
      <DirectoryHero
        eyebrow={t("followingPage.eyebrow")}
        title={t("followingPage.title")}
        description={t("followingPage.lede")}
      />
      <FollowingClient />
    </div>
  )
}
