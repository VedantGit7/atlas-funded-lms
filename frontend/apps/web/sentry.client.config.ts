import * as Sentry from "@sentry/nextjs";

function buildSentryOptions() {
  const dsn = process.env["NEXT_PUBLIC_SENTRY_DSN"];
  const release = process.env["RELEASE_VERSION"] ?? process.env["RELEASE_SHA"];

  return {
    ...(dsn ? { dsn } : {}),
    enabled: Boolean(dsn),
    environment: process.env["RELEASE_ENV"] ?? process.env["APP_ENV"] ?? process.env["NODE_ENV"],
    ...(release ? { release } : {}),
    tracesSampleRate: Number(process.env["SENTRY_TRACES_SAMPLE_RATE"] ?? "0.05"),
    sendDefaultPii: false as const,
  };
}

Sentry.init(buildSentryOptions());
