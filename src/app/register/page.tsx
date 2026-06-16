import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { Suspense } from "react"
import { AuthForm } from "@/components/auth/auth-form"
import { readSessionUser } from "@/lib/auth/server-user"
import { getGlobalLeagueCounts } from "@/lib/data/leagues"
import { SITE } from "@/lib/site"
import { getT } from "@/lib/i18n/server"

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT()
  const title = t("auth.registerMetaTitle")
  const description = t("auth.registerMetaDescription")
  return {
    title,
    description,
    robots: { index: false, follow: false },
    alternates: { canonical: "/register" },
    openGraph: {
      title: `${title} · ${SITE.name}`,
      description,
      url: `${SITE.url}/register`,
      type: "website",
    },
  }
}

export default async function RegisterPage() {
  const user = await readSessionUser()
  if (user) redirect("/ai-advisor")
  const stats = await getGlobalLeagueCounts()
  return (
    <Suspense fallback={null}>
      <AuthForm variant="register" stats={stats} />
    </Suspense>
  )
}
