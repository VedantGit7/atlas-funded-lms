import * as Sentry from "@sentry/nextjs";

// Request tracing is off unless a rate above zero is set. Sentry turns tracing
// on whenever tracesSampleRate is present, even as 0, and then builds spans for
// every request: about 31% of API CPU in the staging load test
// (docs/engineering/staging-load-test-2026-11-07.md). Errors are still reported.
function buildSentryOptions() {
  const tracesSampleRate = Number(process.env["SENTRY_TRACES_SAMPLE_RATE"]?.trim() || "0");
  const dsn = process.env["NEXT_PUBLIC_SENTRY_DSN"] ?? process.env["SENTRY_DSN"];
  const release = process.env["RELEASE_VERSION"] ?? process.env["RELEASE_SHA"];

  return {
    ...(dsn ? { dsn } : {}),
    enabled: Boolean(dsn),
    environment: process.env["RELEASE_ENV"] ?? process.env["APP_ENV"] ?? process.env["NODE_ENV"],
    ...(release ? { release } : {}),
    ...(tracesSampleRate > 0 ? { tracesSampleRate } : {}),
    sendDefaultPii: false as const,
  };
}

Sentry.init(buildSentryOptions());
