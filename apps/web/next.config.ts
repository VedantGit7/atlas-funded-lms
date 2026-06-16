import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ["@atlas/auth", "@atlas/core", "@atlas/tenancy"],
};

export default nextConfig;
