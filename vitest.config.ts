import { defineConfig } from "vitest/config"
import { fileURLToPath } from "node:url"

export default defineConfig({
  // Use the automatic JSX runtime so components that don't import React
  // (Next.js style) render in tests without "React is not defined".
  esbuild: {
    jsx: "automatic",
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    globals: false,
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    setupFiles: ["tests/setup.ts", "tests/setup-components.ts"],
    // bcrypt hashing at cost 12 is intentionally slow; give the suite room.
    testTimeout: 20_000,
  },
})
