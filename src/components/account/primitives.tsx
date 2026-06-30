import type { ReactNode } from "react"
import { cn } from "@/components/ui/cn"

export function AccountSection({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string
  description?: string
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-white/5 bg-gradient-to-b from-ink-800/65 to-ink-900/65 p-5 shadow-sm backdrop-blur-sm sm:p-6",
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-400/60" />
            <h2 className="font-display text-base font-semibold text-ink-50 sm:text-lg">
              {title}
            </h2>
          </div>
          {description ? (
            <p className="mt-1.5 max-w-prose text-[13px] leading-relaxed text-ink-400">
              {description}
            </p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children ? <div className="mt-5 space-y-4">{children}</div> : null}
    </section>
  )
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string
  htmlFor?: string
  hint?: string
  error?: string | null
  children: ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label
          htmlFor={htmlFor}
          className="block text-[11px] font-semibold uppercase tracking-widest text-ink-400"
        >
          {label}
        </label>
        {hint ? (
          <span className="text-[10px] text-ink-500">{hint}</span>
        ) : null}
      </div>
      {children}
      {error ? (
        <p className="flex items-center gap-1 text-xs text-red-300">
          <svg className="h-3 w-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4m0 4h.01" />
          </svg>
          {error}
        </p>
      ) : null}
    </div>
  )
}

export function TextInput({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full rounded-xl border border-white/10 bg-ink-900/60 px-3.5 py-2.5 text-sm text-ink-50 outline-none transition-all duration-200 placeholder:text-ink-600 hover:border-white/20 focus:border-brand-500/60 focus:bg-ink-800/80 focus:shadow-[0_0_0_3px_rgba(245,158,11,0.12)] disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  )
}

export function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "w-full appearance-none rounded-xl border border-white/10 bg-ink-900/60 px-3.5 py-2.5 text-sm text-ink-50 outline-none transition-all duration-200 hover:border-white/20 focus:border-brand-500/60 disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  )
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
  description?: string
  disabled?: boolean
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl px-3 py-3 transition hover:bg-white/[0.02]">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink-100">{label}</p>
        {description ? (
          <p className="mt-0.5 text-[12px] leading-relaxed text-ink-500">
            {description}
          </p>
        ) : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative mt-0.5 inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900 disabled:cursor-not-allowed disabled:opacity-50",
          checked
            ? "bg-brand-500"
            : "bg-white/10",
        )}
      >
        <span
          className={cn(
            "inline-block h-4 w-4 transform rounded-full bg-[#fff] shadow transition-transform duration-200",
            checked ? "translate-x-5" : "translate-x-0.5",
          )}
        />
      </button>
    </div>
  )
}

export function StatusNote({
  type,
  children,
}: {
  type: "success" | "error" | "info"
  children: ReactNode
}) {
  const styles: Record<typeof type, { container: string; icon: ReactNode }> = {
    success: {
      container: "border-emerald-500/25 bg-emerald-500/8 text-emerald-200",
      icon: (
        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    error: {
      container: "border-red-500/25 bg-red-500/8 text-red-200",
      icon: (
        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <circle cx="12" cy="12" r="10" />
          <path d="M15 9l-6 6m0-6l6 6" />
        </svg>
      ),
    },
    info: {
      container: "border-brand-500/25 bg-brand-500/8 text-brand-100",
      icon: (
        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4m0-4h.01" />
        </svg>
      ),
    },
  }
  const s = styles[type]
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-xl border px-4 py-3 text-[13px] leading-relaxed",
        s.container,
      )}
      role={type === "error" ? "alert" : "status"}
    >
      {s.icon}
      <span>{children}</span>
    </div>
  )
}

export function FieldRow({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2">{children}</div>
}
