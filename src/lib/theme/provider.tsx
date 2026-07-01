"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"

export type Theme = "dark" | "light"

/** localStorage key — kept in sync with the no-FOUC script in layout.tsx. */
export const THEME_STORAGE_KEY = "ghs-theme"

type ThemeContextValue = {
  theme: Theme
  setTheme: (next: Theme) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function apply(theme: Theme) {
  const root = document.documentElement
  if (theme === "light") {
    root.setAttribute("data-theme", "light")
  } else {
    root.removeAttribute("data-theme")
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Initialise from the DOM, where the no-FOUC inline script has already set
  // the attribute before paint, so the first client render matches the markup.
  const [theme, setThemeState] = useState<Theme>("dark")

  useEffect(() => {
    let saved: string | null = null
    try {
      saved = localStorage.getItem(THEME_STORAGE_KEY)
    } catch {
      /* storage unavailable */
    }
    // Explicit choice wins; otherwise follow the OS (prefers-color-scheme). This
    // also reconciles the attribute the inline no-FOUC script set pre-paint.
    const initial: Theme =
      saved === "light" || saved === "dark"
        ? saved
        : window.matchMedia("(prefers-color-scheme: light)").matches
          ? "light"
          : "dark"
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setThemeState(initial)
    apply(initial)
  }, [])

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next)
    apply(next)
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next)
    } catch {
      /* storage can be unavailable (private mode); the attribute still flips */
    }
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme(theme === "light" ? "dark" : "light")
  }, [theme, setTheme])

  // Follow the OS theme live, but only until the user makes an explicit choice
  // (once "ghs-theme" is saved, their preference wins over the system).
  useEffect(() => {
    const saved = (() => {
      try {
        return localStorage.getItem(THEME_STORAGE_KEY)
      } catch {
        return null
      }
    })()
    if (saved === "light" || saved === "dark") return
    const mq = window.matchMedia("(prefers-color-scheme: light)")
    const onChange = () => {
      // Bail if the user chose in the meantime.
      try {
        const s = localStorage.getItem(THEME_STORAGE_KEY)
        if (s === "light" || s === "dark") return
      } catch {
        /* ignore */
      }
      const next: Theme = mq.matches ? "light" : "dark"
      setThemeState(next)
      apply(next)
    }
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [])

  // Keep multiple tabs / windows in sync.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== THEME_STORAGE_KEY) return
      const next: Theme = e.newValue === "light" ? "light" : "dark"
      setThemeState(next)
      apply(next)
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [])

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme }),
    [theme, setTheme, toggleTheme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    throw new Error("useTheme must be used within a ThemeProvider")
  }
  return ctx
}
