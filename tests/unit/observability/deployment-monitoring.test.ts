import { afterEach, expect, it, vi } from "vitest";
import { validateProductionObservabilityEnv } from "@atlas/observability/env";
const sentry = vi.hoisted(() => ({
  init: vi.fn(),
  captureRequestError: vi.fn(),
  SentryContextManager: vi.fn(),
}));
const otel = vi.hoisted(() => ({ context: { setGlobalContextManager: vi.fn() } }));
vi.mock("@sentry/nextjs", () => sentry);
vi.mock("../../../backend/apps/api/node_modules/@sentry/nextjs", () => sentry);
vi.mock("../../../frontend/apps/web/node_modules/@sentry/nextjs", () => sentry);
vi.mock("@opentelemetry/api", () => otel);
vi.mock("../../../backend/apps/api/node_modules/@opentelemetry/api", () => otel);
vi.mock("../../../frontend/apps/web/node_modules/@opentelemetry/api", () => otel);
const loadConfig = (app: string) =>
  app === "backend"
    ? import("../../../backend/apps/api/sentry.server.config")
    : import("../../../frontend/apps/web/sentry.server.config");
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  vi.clearAllMocks();
});
it("does not let RELEASE_ENV hide production monitoring requirements", () => {
  expect(
    validateProductionObservabilityEnv({
      NODE_ENV: "production",
      APP_ENV: "development",
      RELEASE_ENV: "development",
    }),
  ).toMatchObject({ ok: false });
});
it.each(["backend", "frontend"])("uses configured fallback Sentry settings in %s", async (app) => {
  vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "");
  vi.stubEnv("SENTRY_DSN", "https://public@sentry.example.test/1");
  vi.stubEnv("RELEASE_VERSION", "");
  vi.stubEnv("RELEASE_SHA", "release-sha");
  await loadConfig(app);
  expect(sentry.init).toHaveBeenCalledWith(
    expect.objectContaining({
      enabled: true,
      dsn: "https://public@sentry.example.test/1",
      release: "release-sha",
    }),
  );
});

it.each(["backend", "frontend"])(
  "with tracing off, leaves out Sentry's tracer but keeps its context manager in %s",
  async (app) => {
    vi.stubEnv("SENTRY_TRACES_SAMPLE_RATE", "0");
    await loadConfig(app);
    const options = sentry.init.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(options["skipOpenTelemetrySetup"]).toBe(true);
    expect(options).not.toHaveProperty("tracesSampleRate");
    expect(otel.context.setGlobalContextManager).toHaveBeenCalledTimes(1);
    expect(otel.context.setGlobalContextManager.mock.calls[0]?.[0]).toBeInstanceOf(
      sentry.SentryContextManager,
    );
  },
);
it.each(["backend", "frontend"])(
  "with tracing on, lets Sentry set up OpenTelemetry itself in %s",
  async (app) => {
    vi.stubEnv("SENTRY_TRACES_SAMPLE_RATE", "0.05");
    await loadConfig(app);
    const options = sentry.init.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(options["tracesSampleRate"]).toBe(0.05);
    expect(options["skipOpenTelemetrySetup"]).toBe(false);
    expect(otel.context.setGlobalContextManager).not.toHaveBeenCalled();
  },
);
