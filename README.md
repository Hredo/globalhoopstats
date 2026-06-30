<div align="center">

# 🏀 GlobalHoopStats

**Multi-league basketball statistics platform — players, teams, coaches and an AI scouting advisor across European and North American basketball.**

[![Next.js](https://img.shields.io/badge/Next.js-15-000000?logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Drizzle ORM](https://img.shields.io/badge/Drizzle_ORM-Postgres-C5F74F?logo=drizzle&logoColor=black)](https://orm.drizzle.team/)
[![Neon](https://img.shields.io/badge/Neon-Serverless_Postgres-00E599?logo=postgresql&logoColor=white)](https://neon.tech/)
[![PWA](https://img.shields.io/badge/PWA-Serwist-5A0FC8?logo=pwa&logoColor=white)](https://serwist.pages.dev/)
[![License](https://img.shields.io/badge/License-Proprietary-red)](LICENSE.txt)

[**Live site → globalhoopstats.es**](https://globalhoopstats.es)

</div>

---

## Overview

**GlobalHoopStats** aggregates, normalizes and visualizes basketball statistics from multiple competitions into a single, fast, fully bilingual (ES/EN) web application. It unifies players, teams and coaching staff across leagues that publish their data in completely different formats, and layers on top a configurable **AI advisor**, a **trade/market simulator** and exportable reports.

It is built as a production application — not a demo — with real authentication, two-factor auth, transactional email, rate-limiting, encrypted secrets at rest, SEO/structured data and an installable PWA.

### Supported leagues

| Region | Competitions |
| --- | --- |
| 🇪🇺 Europe | EuroLeague |
| 🇪🇸 Spain | ACB (Liga Endesa) · LEB Oro · LEB Plata · EBA |
| 🇺🇸 North America | NBA |

---

## Key features

### 📊 Stats & data
- Unified **players / teams / coaches** directories with per-league stats, bios and identity (logos, colors).
- Side-by-side **player comparison** across leagues.
- **League** overviews and standings-aware team pages.
- **YouTube highlights** surfaced directly on player profiles.
- Export to **PDF, Word and Excel** (jsPDF, `docx`, `xlsx-js-style`).

### 🤖 AI advisor
- Conversational scouting / analysis assistant with downloadable, formatted reports.
- **Bring-your-own-key (BYOK)**: each user configures their own provider; keys are encrypted at rest (AES-256-GCM).
- Local-first by default via **Ollama** (`llama3.1:8b`), with optional hosted providers (e.g. Groq) as a shared fallback.

### 💹 Market & simulation
- **Trade simulator** with player **market valuation** and currency handling.
- **Favorites / shortlists** to build and compare custom player sets.

### 🧩 Platform & UX
- Full **i18n (ES/EN)** with locale-routed pages (`/[locale]`).
- **Installable PWA** with offline-aware service worker (Serwist).
- Smooth motion design (Framer Motion) and an editorial "El Índice" content section.
- SEO baked in: sitemap, `robots`, **OpenGraph** and **JSON-LD** structured data.

### 🔐 Security & accounts
- Email/password auth with HMAC-signed session tokens and **two-factor authentication (2FA)**.
- Password reset and account management flows.
- **Transactional email** pipeline (Resend → Gmail SMTP → console) for welcome, reset, 2FA, contact and waitlist.
- Brute-force / rate-limit defense with proxy-aware client-IP resolution.
- See [`SECURITY.md`](SECURITY.md) for the threat model and reporting policy.

---

## Tech stack

| Layer | Technology |
| --- | --- |
| **Framework** | Next.js 15 (App Router), React 19, TypeScript (strict) |
| **Styling** | Tailwind CSS 4, Framer Motion |
| **Database** | Neon serverless Postgres via `postgres` driver |
| **ORM / migrations** | Drizzle ORM + Drizzle Kit |
| **Auth** | Custom sessions (HMAC), `bcryptjs`, email-code 2FA |
| **Email** | Nodemailer (Resend / Gmail SMTP transports) |
| **AI** | Ollama (local) + OpenAI-compatible providers (BYOK) |
| **Validation** | Zod |
| **PWA** | Serwist (Turbopack-compatible service worker) |
| **Tooling** | pnpm, ESLint, Prettier, Vitest, tsx |

---

## Project structure

```
src/
├─ app/                 # App Router: pages + API routes
│  ├─ [locale]/         # i18n-routed pages (ES/EN)
│  ├─ players/ teams/ coaches/ leagues/ compare/   # core stats views
│  ├─ market/           # trade simulator + valuation
│  ├─ ai-advisor/ ai-setup/                         # AI assistant + BYOK config
│  ├─ account/ login/ register/ 2fa/ reset-password/# auth & accounts
│  ├─ admin/            # internal admin area
│  └─ api/              # REST endpoints (auth, players, market, ai, sync, …)
├─ components/          # reusable UI components
└─ lib/
   ├─ sources/          # per-league data adapters (acb, euroleague, nba, feb)
   ├─ sync/             # ingestion & refresh orchestration
   └─ …                 # db client, auth, email, i18n, utils
scripts/                # data sync, backfills, migrations, maintenance
drizzle/                # SQL migrations & snapshots
```

> 📐 **Deep dive:** for a full architecture & developer guide — data model, ingestion
> pipeline, entity matching, auth/security, AI engine and onboarding recipes — see
> [`docs/ARCHITECTURE.en.md`](docs/ARCHITECTURE.en.md) (English) ·
> [`docs/ARCHITECTURE.es.md`](docs/ARCHITECTURE.es.md) (Español).

---

## Getting started

### Prerequisites
- **Node.js** `>=20 <24`
- **pnpm** `11.x`
- A **Postgres** database (Neon recommended; any Postgres works for local dev)
- *(Optional)* **Ollama** for the local AI advisor — [install](https://ollama.com/download), then `ollama pull llama3.1:8b`

### Installation

```bash
# 1. Install dependencies
pnpm install

# 2. Create your local environment file
cp .env.example .env.local        # macOS / Linux
# Copy-Item .env.example .env.local   # PowerShell (Windows)

# 3. Fill in DATABASE_URL (and any optional keys) in .env.local

# 4. Apply the database schema
pnpm db:push

# 5. Start the dev server (Turbopack)
pnpm dev
```

The app runs at **http://localhost:3000**.

---

## Environment variables

All values are optional for local development (sensible defaults apply); **`SESSION_SECRET`** and **`ENCRYPTION_KEY`** are **required in production** — the app refuses to boot without them. See [`.env.example`](.env.example) for the full, annotated list.

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | ✅ | Neon/Postgres connection string (use the pooled endpoint in prod) |
| `SESSION_SECRET` | prod | HMAC secret for signing session tokens (≥32 chars) |
| `ENCRYPTION_KEY` | prod | AES-256-GCM key for encrypting user AI keys at rest |
| `NEXT_PUBLIC_SITE_URL` | ✅ | Canonical base URL for SEO / sitemap / OG / JSON-LD |
| `YOUTUBE_API_KEY` | optional | YouTube Data API v3 — player highlights |
| `RESEND_API_KEY` / `GMAIL_APP_PASSWORD` | optional | Transactional email transport |
| `OLLAMA_BASE_URL` / `OLLAMA_MODEL` | optional | Local AI advisor configuration |
| `CRON_SECRET` | optional | Protects `/api/cron/*` ingestion endpoints |
| `TRUSTED_PROXY_HOPS` | optional | Reverse-proxy hops for accurate client-IP resolution |

> ⚠️ Never commit `.env` or `.env.local`. Generate secrets with `node -e "console.log(crypto.randomBytes(32).toString('base64'))"`.

---

## Available scripts

### Development
| Command | Description |
| --- | --- |
| `pnpm dev` | Start dev server (Turbopack) |
| `pnpm build` / `pnpm start` | Production build / serve |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | TypeScript (`tsc --noEmit`) |
| `pnpm test` | Vitest test suite |
| `pnpm format` | Prettier |

### Database
| Command | Description |
| --- | --- |
| `pnpm db:generate` | Generate Drizzle migrations |
| `pnpm db:push` | Push schema to the database |
| `pnpm db:studio` | Open Drizzle Studio |
| `pnpm db:dedupe-players` | Deduplicate players spanning multiple leagues |

### Data ingestion
| Command | Description |
| --- | --- |
| `pnpm sync:global` | Sync every supported league |
| `pnpm sync:nba` · `:euroleague` · `:acb` | Sync a single competition |
| `pnpm sync:feb` | Sync all FEB leagues (LEB Oro, LEB Plata, EBA) |
| `pnpm backfill:players` · `:colors` · `:team-identity` · … | Targeted historical backfills |

---

## Data sources & ingestion

Per-league adapters live in [`src/lib/sources/`](src/lib/sources) and normalize each competition's data into a shared schema (`types.ts`). Ingestion is orchestrated from [`scripts/`](scripts) and can run on demand or via a `CRON_SECRET`-protected endpoint. Because players and staff frequently move between leagues, a dedicated deduplication step keeps a single canonical identity per person while preserving per-league stat lines.

---

## Deployment

GlobalHoopStats runs as a long-running **Node.js** server backed by a **Neon serverless Postgres** database. In production, set `SESSION_SECRET`, `ENCRYPTION_KEY`, `DATABASE_URL` (pooled endpoint) and `NEXT_PUBLIC_SITE_URL`, then build with `pnpm build` and serve with `pnpm start`.

---

## License

This project is **proprietary** — © 2026 Hugo Redondo Valdés, all rights reserved. The source is published for portfolio and reference purposes only; reuse, redistribution or deployment requires written permission. See [`LICENSE.txt`](LICENSE.txt).

This is a personal product rather than an open-source project, so external pull requests are not actively solicited. Bug reports and feedback via GitHub issues are welcome.

---

## Author

**Hugo Redondo Valdés** · [GitHub @Hredo](https://github.com/Hredo)

For inquiries, use the contact form at [globalhoopstats.es](https://globalhoopstats.es) or reach out via GitHub.
