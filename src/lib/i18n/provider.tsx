"use client"

import { createContext, useContext, useMemo } from "react"
import type { Locale } from "./config"
import type { Messages } from "./dictionaries"
import { translate, type TranslationVars } from "./t"

type LocaleContextValue = {
  locale: Locale
  dict: Messages
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

export function LocaleProvider({
  locale,
  dict,
  children,
}: LocaleContextValue & { children: React.ReactNode }) {
  const value = useMemo(() => ({ locale, dict }), [locale, dict])
  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  )
}

function useLocaleContext(): LocaleContextValue {
  const ctx = useContext(LocaleContext)
  if (!ctx) {
    throw new Error("useLocale/useT must be used within a LocaleProvider")
  }
  return ctx
}

export function useLocale(): Locale {
  return useLocaleContext().locale
}

export type ClientTranslator = (path: string, vars?: TranslationVars) => string

export function useT(): ClientTranslator {
  const { dict } = useLocaleContext()
  return useMemo(
    () => (path: string, vars?: TranslationVars) => translate(dict, path, vars),
    [dict],
  )
}
