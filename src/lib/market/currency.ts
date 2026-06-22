export type CurrencyCode = "EUR" | "USD" | "GBP"

export const CURRENCIES: Record<CurrencyCode, { symbol: string; name: string; locale: string }> = {
  EUR: { symbol: "€", name: "Euro", locale: "es-ES" },
  USD: { symbol: "$", name: "US Dollar", locale: "en-US" },
  GBP: { symbol: "£", name: "British Pound", locale: "en-GB" },
}

const RATES: Record<CurrencyCode, number> = {
  EUR: 1,
  USD: 1.08,
  GBP: 0.86,
}

export function convertEur(value: number, to: CurrencyCode): number {
  if (to === "EUR") return value
  return value * RATES[to]
}

export function formatCurrency(
  value: number | null | undefined,
  currency: CurrencyCode,
): string {
  if (value == null || !Number.isFinite(value)) return "—"
  const converted = convertEur(value, currency)
  const info = CURRENCIES[currency]
  if (Math.abs(converted) >= 1_000_000) {
    const suffix = currency === "EUR" ? " M" : "M"
    return `${info.symbol}${(converted / 1_000_000).toFixed(1)}${suffix}`
  }
  if (Math.abs(converted) >= 1_000) {
    const suffix = currency === "EUR" ? " K" : "K"
    return `${info.symbol}${Math.round(converted / 1_000)}${suffix}`
  }
  return new Intl.NumberFormat(info.locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(converted)
}

export function formatBalance(balance: number): string {
  if (balance >= 1.08) return `+${((balance - 1) * 100).toFixed(0)}%`
  if (balance <= 0.95) return `${((1 - balance) * 100).toFixed(0)}%`
  return "Equilibrado"
}
