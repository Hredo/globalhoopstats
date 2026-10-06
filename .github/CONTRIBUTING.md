# Contributing

GlobalHoopStats is a proprietary product with public source (see [LICENSE.txt](../LICENSE.txt)).
Bug reports and data corrections are very welcome; code contributions are accepted only
by prior agreement with the owner, so please open an issue before writing a large change.

## Branches

- `master` — what runs on [globalhoopstats.es](https://globalhoopstats.es). Protected: it only
  receives pull requests from `develop`, merged by the owner.
- `develop` — integration branch. Feature work happens on short-lived branches
  (`feat/…`, `fix/…`, `security/…`, `chore/…`) that open a pull request against it.

## Before opening a pull request

```bash
pnpm install
pnpm typecheck   # the primary correctness gate
pnpm lint
pnpm test        # unit, component and security regression tests
```

CI runs the same four checks (plus a production dependency audit) on every pull request,
and [CODEOWNERS](CODEOWNERS) requests the owner's review automatically.

Commits follow [Conventional Commits](https://www.conventionalcommits.org/) in English
(`feat:`, `fix:`, `chore:`, `docs:`, `test:`…).

## Rules that are easy to break silently

These are explained in [docs/ARCHITECTURE.en.md](../docs/ARCHITECTURE.en.md); in short:

1. A FEB person (Primera/Segunda/Tercera FEB) is **never** merged with an ACB, EuroLeague
   or NBA professional, even with an identical name.
2. All source HTTP goes through `src/lib/sources/fetcher.ts` — identifiable, serialized,
   rate-limited. No direct `fetch` from an adapter, no browser disguise.
3. Sync writes pass the quality gate (`src/lib/sync/quality-gate.ts`); a broken scrape must
   never overwrite good data.
4. Every user-facing string exists in Spanish and English.
5. Production ships build artifacts only — anything that must run in production has to
   work from the built app, not from a script.

## Security

Never report a vulnerability in a public issue — see [SECURITY.md](../SECURITY.md).
