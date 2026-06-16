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
  const title = t("auth.loginMetaTitle")
  const description = t("auth.loginMetaDescription")
  return {
    title,
    description,
    robots: { index: false, follow: false },
    alternates: { canonical: "/login" },
    openGraph: {
      title: `${title} · ${SITE.name}`,
      description,
      url: `${SITE.url}/login`,
      type: "website",
    },
  }
}

export default async function LoginPage() {
  const user = await readSessionUser()
  if (user) redirect("/ai-advisor")
  const stats = await getGlobalLeagueCounts()
  return (
    <Suspense fallback={null}>
      <AuthForm variant="login" stats={stats} />
    </Suspense>
  )
}
