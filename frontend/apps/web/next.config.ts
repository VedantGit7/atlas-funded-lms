import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";
import { securityHeadersRule } from "../../../configs/security-headers.mjs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withSentryConfig } from "@sentry/nextjs";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env["ANALYZE"] === "true",
});

const webSrcDir = path.dirname(fileURLToPath(import.meta.url));

const apiInternalUrl = process.env["API_INTERNAL_URL"] ?? "http://127.0.0.1:3001";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ["@atlas/design-system"],
  experimental: {
    // API requests are rewritten to the backend; raise proxy buffers for uploads.
    proxyClientMaxBodySize: "110mb",
    serverActions: {
      bodySizeLimit: "110mb",
    },
    // H16. 556 files import from the lucide-react barrel, which pulled the whole
    // icon set into a chunk loaded by 325 routes. Rewriting the barrel to deep
    // imports is the single largest lever on learner first-load weight.
    optimizePackageImports: ["lucide-react"],
  },
  // H2. configs/security-headers.mjs describes itself as shared by both Next
  // apps and was wired into the API only -- so the app that actually serves HTML
  // to browsers sent no CSP, no X-Frame-Options and no HSTS. Clickjacking of
  // /admin and /studio, and the second line of defence against both stored-XSS
  // vectors, depended on this being here rather than on the JSON API.
  headers() {
    return Promise.resolve([securityHeadersRule]);
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
      // Run before filesystem routes so mirrored `app/api/v1/**/route.ts` files
      // do not shadow the canonical backend handlers in dev.
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
