# Globalhoopstats 

Basketball statistics tracking web application — work in progress.

## Summary

`globalhoopstats` is a web application for collecting, aggregating, and displaying basketball statistics for players, teams, and staff from multiple sources (EuroLeague, ACB, NBA, and others). Built with Next.js (App Router), TypeScript, Tailwind CSS, and Drizzle ORM.

## Recent changes (summary)

- Added and improved player search route (`src/app/api/players/search/route.ts`) for more precise searches.
- New backfill and sync scripts in `scripts/` to facilitate historical data import.
- Drizzle migration adjustments and snapshots in `drizzle/` for better reproducibility.
- Extended documentation on OneDrive caveats and local environment recommendations.

## Tech stack

- Frontend: Next.js (App Router) + React + Tailwind CSS
- Language: TypeScript (strict)
- ORM: Drizzle (see `drizzle.config.ts`)
- Package manager: pnpm

## What's included

- Pages and routes for `players`, `teams`, `coaches`, `leagues` and `compare` (see `src/app/`).
- API route for player search at `src/app/api/players/search/route.ts`.
- Reusable components in `src/components/`.
- Data adapters and sync utilities in `src/lib/sources/` and `src/lib/sync/`.
- Scripts for database checks, migrations, and syncing in `scripts/`.

## Current status

Active development. Notable pending tasks:

- Fully automate the migration and seed flow for local environments.
- Implement authentication and access control for admin areas.
- Accessibility improvements and UI tests.
- Observability and error handling for sync jobs.

## Quick start (developer)

Prerequisites: Node.js (LTS recommended), `pnpm`, and a relational database compatible with Drizzle configuration.

1. Install dependencies:

```bash
pnpm install
```

2. Create the local environment file:

```powershell
# PowerShell (Windows)
Copy-Item .env.example .env.local

# macOS / Linux
cp .env.example .env.local
```

3. Configure database connection in `drizzle.config.ts` and update `.env.local`.

4. Apply migrations (see `scripts/` for details). Example:

```bash
pnpm tsx scripts/apply-migrations.ts
```

5. Start development server:

```bash
pnpm dev
```

## Useful scripts

- `pnpm dev` — start development server
- `pnpm build` — build for production
- `pnpm lint` — run ESLint
- `pnpm typecheck` — TypeScript checks
- `pnpm test` — run tests (if configured)

Check the `scripts/` folder for additional utilities like `sync.ts`, `backfill-players.ts`, and DB checks.

## Data sync and sources

Adapters are located in `src/lib/sources/`. Import and refresh tasks are orchestrated from scripts in `scripts/`. Depending on the source, you may need to configure API keys and run some scripts manually.

## Project structure (high level)

- `src/app/` — pages and API routes (App Router)
- `src/components/` — UI components
- `src/lib/` — utilities, sync logic, and DB client
- `scripts/` — maintenance, migrations, and sync
- `drizzle/` — migrations and SQL snapshots

## Development notes / caveats

- OneDrive: If working from OneDrive, you may encounter `readlink()` errors and reparse point files in `.next/`. If you run into issues, delete `.next/` or exclude the folder from OneDrive.
- Recommendation: use a local copy not managed by OneDrive for CI/production environments.

## How to contribute

- Open an issue to discuss major changes or data problems.
- Keep PRs small and focused: migration improvements, adapter tests, or UI fixes.
- For DB changes, provide reproducible migrations and, if applicable, a reduced seed script.

## Contact

- Author: Hugo Redondo Valdés — Hrvaldes22@gmail.com

## License

See `LICENSE.txt` in the repository root for license details.
