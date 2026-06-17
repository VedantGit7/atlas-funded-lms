import type { NextConfig } from "next";

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
    "@atlas/tenancy",
  ],
};

export default nextConfig;
