/**
 * Global test setup. Runs before any test module is imported, so the env vars
 * that `src/lib/env.ts` validates are present before that module is loaded.
 * These are throwaway values used only by the unit suite — never real secrets.
 */
// NODE_ENV is typed read-only by Next's env augmentation; cast for assignment.
const env = process.env as Record<string, string | undefined>
env.NODE_ENV ??= "test"
env.DATABASE_URL ??= "postgres://test:test@localhost:5432/test_db"
env.SESSION_SECRET ??= "unit-test-session-secret-at-least-32-chars-long"
env.ENCRYPTION_KEY ??= "unit-test-encryption-key-at-least-32-chars-long"
env.NEXT_PUBLIC_SITE_URL ??= "http://localhost:3000"
