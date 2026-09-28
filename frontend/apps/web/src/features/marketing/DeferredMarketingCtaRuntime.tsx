"use client";

import dynamic from "next/dynamic";

// The runtime starts empty, fetches targeting after hydration and only then
// inserts CTAs. Public and learner shells share this same client-only boundary.
export const DeferredMarketingCtaRuntime = dynamic(
  () => import("./MarketingCtaRuntime").then((module) => module.MarketingCtaRuntime),
  { ssr: false },
);
