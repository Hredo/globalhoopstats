import { createSerwistRoute } from "@serwist/turbopack"

export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } = createSerwistRoute({
  swSrc: "src/app/sw.ts",
  useNativeEsbuild: true,
  // Service workers only run in modern browsers. Serwist's default target
  // (Safari 12 et al.) trips an esbuild destructuring-lowering limitation,
  // so pin the SW bundle to a modern baseline esbuild can emit cleanly.
  esbuildOptions: { target: "es2020" },
})
