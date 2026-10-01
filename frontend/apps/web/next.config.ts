import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";
import {
  securityHeadersRule,
  scormFramingHeadersRule,
  formFramingHeadersRule,
} from "../../../configs/security-headers.mjs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withSentryConfig } from "@sentry/nextjs";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env["ANALYZE"] === "true",
});

const webSrcDir = path.dirname(fileURLToPath(import.meta.url));

const apiInternalUrl = process.env["API_INTERNAL_URL"] ?? "http://127.0.0.1:3001";

const repoRoot = path.join(webSrcDir, "..", "..", "..");

const nextConfig: NextConfig = {
  distDir:
    process.env["ATLAS_PERF_BUILD"] === "1"
      ? ".next-perf"
      : process.env["ATLAS_BROWSER_BUILD"] === "1"
        ? ".next-e2e"
        : ".next",
  reactStrictMode: true,
  poweredByHeader: false,
  // F7: emit .next/standalone so a deployment carries only the traced files
  // rather than the whole workspace plus node_modules.
  output: "standalone",
  // Tracing defaults to the app directory, which in this monorepo would exclude
  // every @atlas/* workspace package the app imports -- the standalone bundle
  // would build and then fail at runtime on a missing module. The root has to
  // be the repository so the tracer can follow those links.
  outputFileTracingRoot: repoRoot,
  transpilePackages: ["@atlas/design-system"],
  experimental: {
    // Cold API compilation exceeded Next's 30s rewrite deadline in browser CI.
    // Production routes are prebuilt and retain the existing bounded deadline.
    proxyTimeout: process.env["NODE_ENV"] === "development" ? 90_000 : 30_000,
    // Only metadata crosses the web proxy; large uploads use signed object URLs.
    proxyClientMaxBodySize: process.env["NODE_ENV"] === "development" ? "140mb" : "4mb",
    // CI only: browser CI's dev server aborted on a Turbopack panic in the persistent
    // cache's restore path ("Restore of Data for task … failed … Aborting"), killing every
    // journey after it. A CI run starts cold, so the cache buys nothing there; local dev
    // keeps it for fast restarts.
    turbopackFileSystemCacheForDev: process.env["CI"] !== "true",
    serverActions: {
      bodySizeLimit: "1mb",
    },
    // H16. 556 files import from the lucide-react barrel, which pulled the whole
    // icon set into a chunk loaded by 325 routes. Rewriting the barrel to deep
    // imports is the single largest lever on learner first-load weight.
    optimizePackageImports: ["lucide-react", "@atlas/design-system"],
  },
  // Keep framing exceptions after the baseline. The proxy owns per-request
  // document CSP; the SCORM route owns its enforced opaque sandbox policy.
  headers() {
    return Promise.resolve([
      securityHeadersRule,
      scormFramingHeadersRule,
      formFramingHeadersRule,
      {
        source: "/fonts/cormorant-garamond/v21/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      ...[
        "/fonts/plus-jakarta-sans/v12/:path*",
        "/fonts/jetbrains-mono/v24/:path*",
        "/fonts/inter/v20/:path*",
        "/fonts/playfair-display/v40/:path*",
      ].map((source) => ({
        source,
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      })),
    ]);
  },
  // Local dev uses tenant/platform hostnames (see plan/frontend-planning/local-dev-urls.md)
  // instead of bare "localhost", so Next's dev-resource origin check needs these allowed
  // or the HMR websocket gets blocked, which forces Turbopack into repeated full reloads.
  allowedDevOrigins: ["*.localhost.test", "*.localhost"],
  turbopack: {
    resolveAlias: {
      "@": path.join(webSrcDir, "src"),
    },
  },
  async rewrites() {
    return {
      // Business API handlers live exclusively in the backend app.
      // The web proxy stamps trusted tenant/session context before this rewrite.
      beforeFiles: [
        {
          source: "/api/v1/:path*",
          destination: `${apiInternalUrl}/api/v1/:path*`,
        },
      ],
    };
  },
  async redirects() {
    return [
      {
        source: "/moderate/cases",
        destination: "/admin/moderation/cases",
        permanent: false,
      },
      {
        source: "/moderate/cases/:id",
        destination: "/admin/moderation/cases/:id",
        permanent: false,
      },
      {
        source: "/moderate/appeals",
        destination: "/admin/moderation/appeals",
        permanent: false,
      },
    ];
  },
};

export default withSentryConfig(withBundleAnalyzer(nextConfig), {
  silent: true,
  disableLogger: true,
});
