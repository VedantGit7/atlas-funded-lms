import type * as SentrySdk from "@sentry/nextjs";

export type BrowserSentry = typeof SentrySdk;

/**
 * Only values fixed in at build time exist in the browser: the DSN, and the
 * environment and release from ATLAS_BUILD_APP_ENV and ATLAS_BUILD_RELEASE
 * (next.config.ts). Sentry's older sentry.client.config.ts was never loaded by
 * a Turbopack build, so before this nothing in the browser started the SDK.
 */
export function browserSentryOptions() {
  const dsn = process.env["NEXT_PUBLIC_SENTRY_DSN"]?.trim();
  const release = process.env["ATLAS_BUILD_RELEASE"]?.trim();

  return {
    ...(dsn ? { dsn } : {}),
    enabled: Boolean(dsn),
    environment: process.env["ATLAS_BUILD_APP_ENV"]?.trim() || process.env["NODE_ENV"],
    ...(release ? { release } : {}),
    tracesSampleRate: 0.05,
    sendDefaultPii: false as const,
  };
}

let loading: Promise<BrowserSentry> | undefined;

/**
 * Loads and starts the SDK once. The dynamic import keeps it out of every
 * route's first load (audit H16): statically imported, it added about 57 kB
 * gzipped to each learner page.
 */
export function loadBrowserSentry(): Promise<BrowserSentry> {
  loading ??= import("@sentry/nextjs").then(
    (sentry) => {
      sentry.init(browserSentryOptions());
      return sentry;
    },
    (error: unknown) => {
      // A chunk that failed to load (offline, a deploy in between) may load next time.
      loading = undefined;
      throw error;
    },
  );
  return loading;
}
