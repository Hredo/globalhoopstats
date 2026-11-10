import { notFound } from "next/navigation"
import { playerPageExists } from "@/lib/data/players"

/**
 * Settles "does this player exist" above the route's loading boundary.
 *
 * `notFound()` thrown from the page lands after `loading.tsx` has already
 * streamed, and by then the status line is sent: every unknown or removed
 * player answered 200 with a "not found" body, which Google files as a soft
 * 404. Thrown from here, nothing has been flushed yet and the response is a
 * real 404.
 */
export default async function PlayerLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  if (!(await playerPageExists(slug))) notFound()
  return children
}
