import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "shiki",
    "undici",
    "puppeteer-core",
    "@sparticuz/chromium",
    "@puppeteer/browsers",
  ],
  outputFileTracingIncludes: {
    "/api/*": [
      "./fixtures/*.json",
      "./node_modules/@fontsource/*/files/*-latin-*.woff2",
      "./node_modules/@fontsource/noto-emoji/400.css",
      "./node_modules/@fontsource/noto-emoji/files/*-400-normal.woff2",
      "./node_modules/katex/dist/katex.min.css",
      "./node_modules/katex/dist/fonts/*.woff2",
    ],
    "/api/pdf": ["./node_modules/@sparticuz/chromium/bin/**/*"],
  },
};

export default nextConfig;
