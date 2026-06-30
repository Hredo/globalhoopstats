import { createSerwistRoute } from "@serwist/turbopack"

export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } = createSerwistRoute({
  swSrc: "src/app/sw.ts",
  // SW bundler, chosen per-platform:
  //  - Linux (Hostinger's auto-deploy build): use esbuild-WASM. The native
  //    esbuild platform binary (@esbuild/linux-*) was not available in their
  //    build/runtime, so the SW route compiled with native esbuild threw and
  //    `/serwist/sw.js` 500'd in production. WASM has no per-platform binary and
  //    runs on any arch, so the build prerenders the SW reliably there.
  //  - Windows (local dev): use native esbuild. esbuild-WASM rejects Windows
  //    drive paths ("C:\\…") as non-absolute (it reads process.cwd() as its
  //    working dir and serwist doesn't expose absWorkingDir), so WASM can't
  //    build here; the native binary is present and works.
  useNativeEsbuild: process.platform === "win32",
  // Service workers only run in modern browsers. Serwist's default target
  // (Safari 12 et al.) trips an esbuild destructuring-lowering limitation,
  // so pin the SW bundle to a modern baseline esbuild can emit cleanly.
  esbuildOptions: { target: "es2020" },
})
