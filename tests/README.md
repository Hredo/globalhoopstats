# Tests

Unit + security regression suite for Global Hoop Stats. Runs with **Vitest** in
a Node environment — no live database or network is required.

```bash
pnpm test          # run once
pnpm test:watch    # watch mode
```

Config: [`vitest.config.ts`](../vitest.config.ts) (resolves the `@/` alias and
sets throwaway env vars via [`tests/setup.ts`](./setup.ts)).

## What's covered

| Area | File | Focus |
|------|------|-------|
| Session tokens | `unit/session.test.ts` | HMAC sign/verify, tamper & expiry rejection, trust-cookie revocation, cookie flags |
| Passwords | `unit/password.test.ts` | bcrypt round-trip, salt uniqueness, strength policy |
| Secret encryption | `unit/secrets.test.ts` | AES-256-GCM round-trip, tamper detection, masking |
| AI advisor security | `unit/ai-advisor-security.test.ts` | input/output sanitisation, prompt-injection & SSRF guards, IP anti-spoofing, rate limiting |
| Open-redirect guard | `unit/safe-redirect.test.ts` | same-site path allow / external block |
| Env validation | `unit/env.test.ts` | production-secret enforcement, required vars |
| JSON-LD XSS | `unit/json-ld-xss.test.ts` | `</script>` breakout escaping |
| Formatting & i18n | `unit/format.test.ts`, `unit/i18n-config.test.ts` | pure display/locale helpers |
| **SQL injection regression** | `security/sql-injection-regression.test.ts` | scans every `src/**` file to ensure no `sql.raw()` interpolates values; pins the previously-vulnerable routes to the parameterised form |

The SQL-injection guard is the key regression test: it fails the build if anyone
reintroduces `sql.raw(\`... ${value} ...\`)` anywhere under `src/`.
