import type { Metadata, Viewport } from "next"
import { Fraunces, Hanken_Grotesk, Space_Mono } from "next/font/google"
import { Navbar } from "@/components/layout/navbar"
import { CourtMarkings } from "@/components/ui/court-markings"
import { Footer } from "@/components/layout/footer"
import { LazyCommandPalette } from "@/components/players/lazy-command-palette"
import { CookieConsent } from "@/components/layout/cookie-consent"
import { JsonLd } from "@/components/marketing/json-ld"
import { SerwistGate } from "@/components/layout/serwist-gate"
import { PageTracker } from "@/components/admin/page-tracker"
import { AnnouncementNotices } from "@/components/layout/announcement-notices"
import { ensureOverridesLoaded } from "@/lib/admin/init-overrides"
import { SITE, SEO_KEYWORDS, SITE_SOCIAL } from "@/lib/site"
import { getLocale } from "@/lib/i18n/server"
import { getDictionary } from "@/lib/i18n/dictionaries"
import { LocaleProvider } from "@/lib/i18n/provider"
import { ThemeProvider } from "@/lib/theme/provider"
import { ThemeToggleFab } from "@/components/layout/theme-toggle-fab"
import { THEME_INIT_SCRIPT } from "@/lib/theme/init-script"
import "./globals.css"

// Body — Hanken Grotesk: a warm, humanist grotesque that reads clean at small
// sizes and holds up in dense stat tables. Replaces Geist.
const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans-loaded",
  display: "swap",
})

// Display — Fraunces: a variable "old-style" serif with optical sizing. Gives the
// almanac / editorial "El Índice" voice to big headlines. High contrast, soft
// terminals, dialed toward a sharper, more editorial cut via axis settings.
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display-loaded",
  display: "swap",
  axes: ["opsz", "SOFT", "WONK"],
})

// Mono — Space Mono: a slightly quirky, wide monospace for tickers, eyebrows and
// tabular data cues. Reinforces the ledger/almanac feel over a neutral mono.
const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-mono-loaded",
  display: "swap",
})

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  const dict = getDictionary(locale)
  const title = `${SITE.name} — ${dict.metadata.tagline}`
  const description = dict.metadata.description
  const verification: NonNullable<Metadata["verification"]> = {}
  if (process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION) {
    verification.google = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
  }
  if (process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION) {
    verification.other = {
      "msvalidate.01": process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION,
    }
  }
  return {
  metadataBase: new URL(SITE.url),
  title: {
    default: title,
    template: `%s · ${SITE.name}`,
  },
  description,
  keywords: SEO_KEYWORDS,
  applicationName: SITE.name,
  authors: [{ name: SITE.author, url: SITE.url }],
  creator: SITE.author,
  publisher: SITE.author,
  alternates: {
    canonical: "/",
  },
  category: "Sports Analytics",
  classification: "Sports, Analytics, Basketball",
  openGraph: {
    type: "website",
    locale: locale === "es" ? "es_ES" : "en_US",
    url: SITE.url,
    siteName: SITE.name,
    title,
    description,
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    creator: SITE.twitter,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  verification: Object.keys(verification).length > 0 ? verification : undefined,
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
  icons: {
    icon: [
      { url: "/icon", type: "image/png", sizes: "32x32" },
      { url: "/icon-192", type: "image/png", sizes: "192x192" },
      { url: "/icon-512", type: "image/png", sizes: "512x512" },
    ],
    apple: [
      { url: "/icon-192", sizes: "192x192", type: "image/png" },
      { url: "/icon-512", sizes: "512x512", type: "image/png" },
    ],
  },
  manifest: "/manifest.webmanifest",
  other: {
    // Standard key (Chrome/Android). Silences the "apple-… is deprecated" console warning.
    "mobile-web-app-capable": "yes",
    // Kept for older iOS Safari, which only honours the apple-prefixed key.
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
  },
  }
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#1a1612" },
    { media: "(prefers-color-scheme: light)", color: "#1a1612" },
  ],
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const locale = await getLocale()
  const dict = getDictionary(locale)
  await ensureOverridesLoaded()
  return (
    <html
      lang={locale}
      data-scroll-behavior="smooth"
      className={`${hanken.variable} ${fraunces.variable} ${spaceMono.variable}`}
      suppressHydrationWarning
    >
      <link rel="preconnect" href="https://cdn.nba.com" />
      <link rel="preconnect" href="https://upload.wikimedia.org" />
      <link rel="preconnect" href="https://cdn.ssref.net" />
      <link rel="preconnect" href="https://i.ytimg.com" />
      <link rel="dns-prefetch" href="//imagenes.feb.es" />
      <link rel="dns-prefetch" href="//www.acb.com" />
      <body className="font-sans" suppressHydrationWarning>
        {/* Runs before paint to apply the saved theme (no dark→light flash).
            Lives as the first body node — a raw <script> may not be a direct
            child of <html>, and this still executes before content renders. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <div
          aria-hidden
          className="court-backdrop pointer-events-none fixed inset-0 -z-10 flex items-center justify-center overflow-hidden"
        >
          <CourtMarkings
            variant="floor"
            tone="oklch(0.92 0.03 74 / 0.1)"
            className="h-auto w-[min(1180px,150vw)] max-w-none"
          />
        </div>
        <LocaleProvider locale={locale} dict={dict}>
        <ThemeProvider>
        <SerwistGate>
        <PageTracker />
        <JsonLd
          data={[
            {
              "@context": "https://schema.org",
              "@type": "Organization",
              name: SITE.name,
              url: SITE.url,
              logo: `${SITE.url}/icon`,
              description: SITE.description,
              sameAs: SITE_SOCIAL,
              contactPoint: [
                {
                  "@type": "ContactPoint",
                  email: SITE.contact,
                  contactType: "customer support",
                  availableLanguage: ["English", "Spanish"],
                },
              ],
            },
            {
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: SITE.name,
              url: SITE.url,
              description: SITE.description,
              inLanguage: locale,
              potentialAction: {
                "@type": "SearchAction",
                target: `${SITE.url}/players?q={search_term_string}`,
                "query-input": "required name=search_term_string",
              },
            },
          ]}
        />
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[200] focus:rounded-md focus:bg-brand-500 focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-ink-950"
        >
          {dict.common.skipToContent}
        </a>
        <Navbar />
        <ThemeToggleFab />
        <AnnouncementNotices />
        <main id="main" className="mx-auto min-h-dvh max-w-7xl px-4 sm:px-6">
          {children}
        </main>
        <LazyCommandPalette />
        <Footer />
        <CookieConsent />
        </SerwistGate>
        </ThemeProvider>
        </LocaleProvider>
      </body>
    </html>
  )
}
