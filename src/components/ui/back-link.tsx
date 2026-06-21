"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState, type MouseEvent } from "react"

/**
 * "Back" affordance that returns to the actual previous page via the browser
 * history instead of always jumping to a fixed directory.
 *
 * `fallbackHref` is used as the real anchor target so the control stays
 * crawlable, right-clickable and works without JS — and it's where we send
 * visitors who landed here directly (no in-app history to go back to).
 */
export function BackLink({
  fallbackHref,
  label,
  className,
}: {
  fallbackHref: string
  label: string
  className?: string
}) {
  const router = useRouter()
  const [canGoBack, setCanGoBack] = useState(false)

  useEffect(() => {
    // More than one history entry means there's a previous page to return to.
    setCanGoBack(window.history.length > 1)
  }, [])

  function handleClick(e: MouseEvent<HTMLAnchorElement>) {
    // Leave modified clicks (open in new tab, etc.) and non-primary buttons to
    // the browser so the fallback href still works as a normal link.
    if (
      e.defaultPrevented ||
      e.button !== 0 ||
      e.metaKey ||
      e.ctrlKey ||
      e.shiftKey ||
      e.altKey
    ) {
      return
    }
    if (canGoBack) {
      e.preventDefault()
      router.back()
    }
  }

  return (
    <Link href={fallbackHref} onClick={handleClick} className={className}>
      <span aria-hidden>←</span> {label}
    </Link>
  )
}
