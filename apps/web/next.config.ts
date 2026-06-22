import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
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
