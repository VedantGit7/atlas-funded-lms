import * as Sentry from "@sentry/nextjs";

function buildSentryOptions() {
  const dsn = process.env["NEXT_PUBLIC_SENTRY_DSN"]?.trim() || process.env["SENTRY_DSN"]?.trim();
  const release = process.env["RELEASE_VERSION"]?.trim() || process.env["RELEASE_SHA"]?.trim();

  return {
    ...(dsn ? { dsn } : {}),
    enabled: Boolean(dsn),
    environment:
      process.env["RELEASE_ENV"]?.trim() ||
      process.env["APP_ENV"]?.trim() ||
      process.env["NODE_ENV"],
    ...(release ? { release } : {}),
    tracesSampleRate: Number(process.env["SENTRY_TRACES_SAMPLE_RATE"]?.trim() || "0.05"),
    sendDefaultPii: false as const,
  };
}

Sentry.init(buildSentryOptions());
