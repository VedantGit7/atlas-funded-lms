import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";
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
