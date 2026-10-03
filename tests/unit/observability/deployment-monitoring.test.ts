import { afterEach, expect, it, vi } from "vitest";
import { validateProductionObservabilityEnv } from "@atlas/observability/env";
const sentry = vi.hoisted(() => ({ init: vi.fn(), captureRequestError: vi.fn() }));
vi.mock("@sentry/nextjs", () => sentry);
vi.mock("../../../backend/apps/api/node_modules/@sentry/nextjs", () => sentry);
vi.mock("../../../frontend/apps/web/node_modules/@sentry/nextjs", () => sentry);
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
  if (app === "backend") await import("../../../backend/apps/api/sentry.server.config");
  else await import("../../../frontend/apps/web/sentry.server.config");
  expect(sentry.init).toHaveBeenCalledWith(
    expect.objectContaining({
      enabled: true,
      dsn: "https://public@sentry.example.test/1",
      release: "release-sha",
    }),
  );
});
