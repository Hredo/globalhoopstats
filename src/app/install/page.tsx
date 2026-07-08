import type { Metadata } from "next"
import { MobileInstall } from "@/components/marketing/mobile-install"
import { getT } from "@/lib/i18n/server"

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT()
  return {
    title: t("home.mobileInstall.titleA"),
    description: t("home.mobileInstall.description"),
  }
}

export default function InstallPage() {
  return <MobileInstall />
}
