## What and why

<!-- What changes, and the problem it solves. Link the issue if there is one. -->

## How it was verified

<!-- Commands run, pages checked, before/after screenshots for UI changes. -->

- [ ] `pnpm typecheck`
- [ ] `pnpm lint`
- [ ] `pnpm test`
- [ ] UI changes checked in **light and dark**, **ES and EN**, desktop and phone width

## Checklist

- [ ] Targets `develop` (only `develop` → `master` releases go to `master`)
- [ ] New user-facing strings exist in both ES and EN
- [ ] Behaviour changes update the nearest doc (`docs/`, `DATA-SOURCES.md`) and its test
- [ ] Schema changes go through Drizzle (`pnpm db:push`), and the PR says so — production needs it before deploy
- [ ] Source scraping still goes through `src/lib/sources/fetcher.ts` and the sync quality gate
- [ ] No secrets, `.env*` files or personal data in the diff or in screenshots
