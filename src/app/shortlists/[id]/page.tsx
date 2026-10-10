import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getT } from "@/lib/i18n/server"
import { isUuid } from "@/lib/workspace/http"
import { ShortlistBoard } from "./board"

export const dynamic = "force-dynamic"

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT()
  return { title: t("shortlistsPage.title"), robots: { index: false, follow: false } }
}

export default async function ShortlistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!isUuid(id)) notFound()
  return (
    <div className="pb-16 pt-6">
      <ShortlistBoard id={id} />
    </div>
  )
}
