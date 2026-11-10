import { notFound } from "next/navigation"
import { teamPageExists } from "@/lib/data/teams"

/**
 * Settles "does this team exist" above the route's loading boundary, so a
 * missing club answers a real 404 instead of a 200 whose body says "not
 * found". See the player layout for the mechanism.
 */
export default async function TeamLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ league: string; slug: string }>
}) {
  const { league, slug } = await params
  if (!(await teamPageExists(league, slug))) notFound()
  return children
}
