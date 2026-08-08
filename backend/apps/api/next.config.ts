import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  allowedDevOrigins: ["127.0.0.1", "*.localhost.test", "*.localhost"],
  experimental: {
    serverActions: {
      bodySizeLimit: "110mb",
    },
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
