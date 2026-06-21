"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { motion } from "framer-motion"
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll"
import { TeamCardElegant } from "@/components/teams/team-card-elegant"
import { useT, useLocale } from "@/lib/i18n/provider"

type Team = Parameters<typeof TeamCardElegant>[0]["team"]

type PageResult = {
  items: Team[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

type Props = {
  initial: PageResult
  query: string
  league: string
  sort: string
  order: string
}

export function TeamsInfiniteView({
  initial,
  query,
  league,
  sort,
  order,
}: Props) {
  const [pages, setPages] = useState<PageResult[]>([initial])
  const [loading, setLoading] = useState(false)
  const isFirstRender = useRef(true)
  const t = useT()
  const locale = useLocale()
  const numberLocale = locale === "es" ? "es-ES" : "en-US"

  const current = pages[pages.length - 1]
  const items = pages
    .flatMap((p) => p.items)
    .filter(
      (t, i, self) => self.findIndex((s) => s.id === t.id) === i,
    )
  const hasMore = current.page < current.totalPages

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    setPages([initial])
  }, [initial])

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return
    setLoading(true)
    const next = current.page + 1
    const params = new URLSearchParams({
      league,
      sort,
      order,
      page: String(next),
      pageSize: String(current.pageSize),
    })
    if (query) params.set("q", query)
    try {
      const res = await fetch(`/api/teams/list?${params.toString()}`)
      if (!res.ok) throw new Error("Failed to load")
      const data = (await res.json()) as PageResult
      setPages((prev) => [...prev, data])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [current, hasMore, loading, league, sort, order, query])

  const sentinelRef = useInfiniteScroll({
    onIntersect: loadMore,
    enabled: hasMore && !loading,
    rootMargin: "0px 0px 400px 0px",
  })

  if (items.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
        className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] py-16 text-center"
      >
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white/[0.04] ring-1 ring-hairline">
          <svg
            aria-hidden
            className="h-6 w-6 text-ink-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M16.24 7.76a6 6 0 0 1 0 8.48M7.76 7.76a6 6 0 0 0 0 8.48M8.46 3.54a10 10 0 0 0 0 16.92M15.54 3.54a10 10 0 0 1 0 16.92" />
          </svg>
        </div>
        <p className="font-display text-lg font-semibold text-ink-50">
          {t("directory.emptyTeamsTitle")}
        </p>
        <p className="mt-1 text-sm text-ink-400">
          {t("directory.emptyTeamsHint")}
        </p>
      </motion.div>
    )
  }

  return (
    <div>
      <motion.ul
        initial="hidden"
        animate="show"
        variants={{
          hidden: {},
          show: { transition: { staggerChildren: 0.025, delayChildren: 0.05 } },
        }}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4"
      >
        {items.map((t) => (
          <motion.li
            key={t.id}
            layout
            variants={{
              hidden: { opacity: 0, y: 8 },
              show: { opacity: 1, y: 0 },
            }}
            transition={{ duration: 0.35, ease: "easeOut", layout: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } }}
          >
            <TeamCardElegant team={t} />
          </motion.li>
        ))}
      </motion.ul>

      <div ref={sentinelRef} aria-hidden className="h-1 w-full" />

      <div className="mt-10 flex flex-col items-center gap-3">
        {hasMore ? (
          <button
            type="button"
            onClick={loadMore}
            disabled={loading}
            className="group inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-6 py-2.5 text-sm font-medium text-ink-100 transition hover:border-brand-400/40 hover:text-ink-50 disabled:opacity-50"
          >
            {loading ? (
              <>
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-brand-400 border-t-transparent" />
                {t("directory.loading")}
              </>
            ) : (
              <>
                {t("directory.loadMore")}
                <svg
                  aria-hidden
                  className="h-3.5 w-3.5 transition group-hover:translate-y-0.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 5v14M5 12l7 7 7-7" />
                </svg>
              </>
            )}
          </button>
        ) : (
          <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500">
            {t("directory.endResults", {
              n: current.total.toLocaleString(numberLocale),
              unit:
                current.total === 1
                  ? t("directory.result")
                  : t("directory.results"),
            })}
          </p>
        )}
      </div>
    </div>
  )
}
