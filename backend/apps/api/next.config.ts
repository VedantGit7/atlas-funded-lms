import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withSentryConfig } from "@sentry/nextjs";
import {
  securityHeadersRule,
  scormFramingHeadersRule,
} from "../../../configs/security-headers.mjs";

const apiDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(apiDir, "..", "..", "..");

const nextConfig: NextConfig = {
  distDir: process.env["ATLAS_BROWSER_BUILD"] === "1" ? ".next-e2e" : ".next",
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
  // Next types `headers` as returning a promise; there is nothing to await here.
  headers() {
    return Promise.resolve([securityHeadersRule, scormFramingHeadersRule]);
  },
  allowedDevOrigins: ["127.0.0.1", "*.localhost.test", "*.localhost"],
  experimental: {
    serverActions: {
      bodySizeLimit: "1mb",
    },
    // CI only: see frontend/apps/web/next.config.ts. A Turbopack panic in the persistent
    // cache's restore path aborted a browser-CI dev server; CI runs start cold anyway.
    turbopackFileSystemCacheForDev: process.env["CI"] !== "true",
  },
  transpilePackages: [
    "@atlas/api",
    "@atlas/auth",
    "@atlas/authorization",
    "@atlas/core",
    "@atlas/domain-branding",
    "@atlas/domain-config",
    "@atlas/membership",
    "@atlas/observability",
    "@atlas/tenancy",
  ],
};

export default withSentryConfig(nextConfig, {
  silent: true,
  disableLogger: true,
});
