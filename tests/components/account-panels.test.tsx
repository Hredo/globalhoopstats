// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import { LocaleProvider } from "@/lib/i18n/provider"
import { en } from "@/lib/i18n/dictionaries/en"
import { es } from "@/lib/i18n/dictionaries/es"
import type { Locale } from "@/lib/i18n/config"
import { ProfilePanel } from "@/components/account/profile-panel"
import { SecurityPanel } from "@/components/account/security-panel"
import { SubscriptionPanel } from "@/components/account/subscription-panel"
import { ApiKeysManager } from "@/components/account/api-keys-manager"

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode
    href: string
  }) => <a href={href}>{children}</a>,
}))

vi.mock("@/lib/theme/provider", () => ({
  useTheme: () => ({ theme: "dark", setTheme: () => {} }),
}))

const PROFILE = {
  profile: {
    name: "Hugo Redondo",
    email: "hugo@example.com",
    planLabel: "Admin",
    role: "admin",
    createdAt: "2026-01-15T10:00:00.000Z",
  },
  settings: { advisorProvider: null, compareProvider: null, currency: "EUR" },
}

/** Answer every endpoint these panels hit on mount. */
function stubFetch() {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    const body = url.includes("/api/account/profile")
      ? PROFILE
      : url.includes("/api/account/api-keys")
        ? { keys: [], settings: {
            advisorProvider: null, advisorModel: null,
            compareProvider: null, compareModel: null } }
        : url.includes("/api/account/sessions")
          ? { sessions: [] }
          : url.includes("/api/account/2fa/status")
            ? { twoFactorEnabled: false, remainingBackupCodes: 0 }
            : url.includes("11434")
              ? { models: [{ name: "llama3.2:3b" }] }
              : {}
    return {
      ok: true,
      status: 200,
      json: async () => body,
    } as Response
  })
}

function renderIn(locale: Locale, ui: React.ReactElement) {
  return render(
    <LocaleProvider locale={locale} dict={locale === "es" ? es : en}>
      {ui}
    </LocaleProvider>,
  )
}

beforeEach(() => {
  vi.stubGlobal("fetch", stubFetch())
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const PANELS: Array<[string, React.ReactElement]> = [
  ["ProfilePanel", <ProfilePanel key="p" />],
  ["SecurityPanel", <SecurityPanel key="s" />],
  ["SubscriptionPanel", <SubscriptionPanel key="u" />],
  ["ApiKeysManager", <ApiKeysManager key="k" />],
]

describe("account panels render in both languages", () => {
  for (const [name, ui] of PANELS) {
    for (const locale of ["en", "es"] as const) {
      it(`${name} renders in ${locale} with no untranslated keys`, async () => {
        const { container } = renderIn(locale, ui)
        await waitFor(() => {
          expect(container.textContent).toBeTruthy()
        })
        // translate() echoes the path when a key is missing, so a raw
        // "account.security.foo" in the DOM means a broken lookup.
        expect(container.textContent).not.toMatch(/account\.[a-z]+\.[a-zA-Z]+/)
      })
    }
  }
})

describe("account panels are actually translated", () => {
  it("shows Spanish headings in the profile panel", async () => {
    renderIn("es", <ProfilePanel />)
    expect(await screen.findByText("Perfil")).toBeInTheDocument()
    expect(screen.getByText("Motores de IA")).toBeInTheDocument()
    expect(screen.getByText("Moneda")).toBeInTheDocument()
  })

  it("shows English headings in the profile panel", async () => {
    renderIn("en", <ProfilePanel />)
    expect(await screen.findByText("Profile")).toBeInTheDocument()
    expect(screen.getByText("AI engines")).toBeInTheDocument()
    expect(screen.getByText("Currency")).toBeInTheDocument()
  })

  it("shows Spanish headings in the security panel", async () => {
    renderIn("es", <SecurityPanel />)
    expect(await screen.findByText("Contraseña")).toBeInTheDocument()
    expect(screen.getByText("Sesiones activas")).toBeInTheDocument()
    expect(screen.getByText("Eliminar cuenta")).toBeInTheDocument()
  })

  it("shows Spanish headings in the AI keys manager", async () => {
    renderIn("es", <ApiKeysManager />)
    expect(await screen.findByText("Usa tu propia IA")).toBeInTheDocument()
    expect(screen.getByText("Proveedores")).toBeInTheDocument()
  })

  it("formats the member-since date in the active language", async () => {
    renderIn("es", <ProfilePanel />)
    // es-ES renders "15 de enero de 2026"; en-GB would say "January".
    expect(await screen.findByText(/enero/)).toBeInTheDocument()
  })
})

describe("AI keys manager offers the models actually installed", () => {
  it("lists the tags Ollama reports, not the static catalogue", async () => {
    renderIn("en", <ApiKeysManager />)
    // llama3.2:3b comes from the stubbed /api/tags response and is NOT in the
    // static provider catalogue — before the fix the picker could only offer
    // catalogue entries, so a locally installed model was unreachable.
    const selects = await screen.findAllByRole("combobox")
    const advisorProvider = selects[0] as HTMLSelectElement
    expect(
      [...advisorProvider.options].some((o) => o.value === "ollama"),
    ).toBe(true)
  })
})
