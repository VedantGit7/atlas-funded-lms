import * as Sentry from "@sentry/nextjs";

// Next loads this file in the browser before the app starts. Sentry's older
// sentry.client.config.ts is never loaded by a Turbopack build, so browser
// errors were never reported. Only values fixed in at build time exist here:
// the DSN, ATLAS_BUILD_APP_ENV (next.config.ts) and the release, which the
// Sentry plugin injects from SENTRY_RELEASE ("Publish images" sets it).
function buildSentryOptions() {
  const dsn = process.env["NEXT_PUBLIC_SENTRY_DSN"]?.trim();

  return {
    ...(dsn ? { dsn } : {}),
    enabled: Boolean(dsn),
    environment: process.env["ATLAS_BUILD_APP_ENV"]?.trim() || process.env["NODE_ENV"],
    tracesSampleRate: 0.05,
    sendDefaultPii: false as const,
  };
}

Sentry.init(buildSentryOptions());

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
