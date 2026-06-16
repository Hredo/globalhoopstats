import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { ForgotPasswordForm } from "./form"
import { readSessionUser } from "@/lib/auth/server-user"
import { getT } from "@/lib/i18n/server"

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT()
  return {
    title: t("auth.forgotMetaTitle"),
    description: t("auth.forgotMetaDescription"),
    robots: { index: false, follow: false },
  }
}

export default async function ForgotPasswordPage() {
  const user = await readSessionUser()
  if (user) redirect("/account")
  return <ForgotPasswordForm />
}
