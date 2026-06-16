import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { Suspense } from "react"
import { TwoFactorVerifyForm } from "./form"
import { readSessionUser } from "@/lib/auth/server-user"
import { getT } from "@/lib/i18n/server"

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT()
  return {
    title: t("auth.twoFactorMetaTitle"),
    description: t("auth.twoFactorMetaDescription"),
    robots: { index: false, follow: false },
  }
}

export default async function TwoFactorVerifyPage() {
  const user = await readSessionUser()
  if (user) redirect("/ai-advisor")
  return (
    <Suspense fallback={null}>
      <TwoFactorVerifyForm />
    </Suspense>
  )
}
