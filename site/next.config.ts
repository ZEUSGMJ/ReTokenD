import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pure static one-pager: exports to site/out, deployable anywhere.
  output: "export",
  images: {
    unoptimized: true,
  },
  // Don't infer the repo root from the parent lockfile — the root app's
  // proxy.ts/middleware must not leak into this build.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
