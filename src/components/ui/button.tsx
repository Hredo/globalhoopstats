import Link from "next/link"
import type { ComponentProps, ReactNode } from "react"
import { cn } from "@/components/ui/cn"

type Variant = "primary" | "secondary" | "ghost"
type Size = "sm" | "md" | "lg"

const BASE =
  "group/btn relative inline-flex items-center justify-center gap-2 rounded-md border font-semibold transition-[background-color,border-color,color,transform] duration-200 ease-swift active:translate-y-px disabled:pointer-events-none disabled:opacity-50 outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-0"

const VARIANTS: Record<Variant, string> = {
  // ink-950 flips per theme: near-white text on deep orange in light,
  // near-black on hot orange in dark. The inset edge grounds the press.
  primary:
    "border-transparent bg-brand-600 text-ink-950 shadow-[inset_0_-1.5px_0_0_oklch(0_0_0/0.18)] hover:bg-brand-500",
  secondary:
    "border-hairline-strong bg-surface-1 text-ink-100 hover:border-ink-600 hover:text-ink-50",
  ghost:
    "border-transparent text-ink-300 hover:bg-white/[0.05] hover:text-ink-50",
}

const SIZES: Record<Size, string> = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-5 text-sm sm:text-[15px]",
  lg: "h-12 px-6 text-[15px] sm:text-base",
}

function Arrow() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3.5 w-3.5 transition-transform duration-200 ease-swift group-hover/btn:translate-x-1"
      aria-hidden
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  )
}

type CommonProps = {
  variant?: Variant
  size?: Size
  arrow?: boolean
  children: ReactNode
  className?: string
}

function Inner({ children, arrow }: { children: ReactNode; arrow?: boolean }) {
  return (
    <>
      {children}
      {arrow ? <Arrow /> : null}
    </>
  )
}

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  arrow = false,
  className,
  children,
  ...rest
}: CommonProps & { href: string } & Omit<
    ComponentProps<typeof Link>,
    "href" | "className" | "children"
  >) {
  return (
    <Link
      href={href}
      className={cn(BASE, VARIANTS[variant], SIZES[size], className)}
      {...rest}
    >
      <Inner arrow={arrow}>{children}</Inner>
    </Link>
  )
}

export function Button({
  variant = "primary",
  size = "md",
  arrow = false,
  className,
  children,
  ...rest
}: CommonProps & ComponentProps<"button">) {
  return (
    <button
      className={cn(BASE, VARIANTS[variant], SIZES[size], className)}
      {...rest}
    >
      <Inner arrow={arrow}>{children}</Inner>
    </button>
  )
}
