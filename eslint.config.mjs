import nextConfig from "eslint-config-next"

const eslintConfig = [
  ...nextConfig,
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "drizzle/**",
      "data/**",
      "drizzle.config.ts",
      "next-env.d.ts",
      "scripts/archive/**",
    ],
  },
  {
    files: ["scripts/**/*.ts"],
    rules: {
      "no-console": "off",
    },
  },
  {
    // The React-Compiler-era hooks rules (eslint-plugin-react-hooks v6) flag
    // the mount-time "client-only state after hydration" pattern used across
    // the app (matchMedia, navigator, document.cookie…). Those are deliberate,
    // so surface them as warnings instead of failing the lint; write new code
    // without the pattern where practical.
    // The plugin instance is reused from eslint-config-next (pnpm doesn't
    // hoist it, so it can't be imported directly here).
    plugins: {
      "react-hooks": nextConfig
        .map((c) => c.plugins?.["react-hooks"])
        .find(Boolean),
    },
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
    },
  },
]

export default eslintConfig
