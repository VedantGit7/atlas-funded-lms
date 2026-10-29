import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { validateProductionObservabilityEnv } from "@atlas/observability/env";
const sentry = vi.hoisted(() => ({
  init: vi.fn(),
  captureRequestError: vi.fn(),
  captureRouterTransitionStart: vi.fn(),
}));
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
it("starts browser Sentry from the file Next loads, with build-time values only", async () => {
  // Sentry's sentry.client.config.ts is never loaded by a Turbopack build.
  const web = resolve(import.meta.dirname, "../../../frontend/apps/web");
  expect(existsSync(resolve(web, "sentry.client.config.ts"))).toBe(false);
  vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "https://public@sentry.example.test/1");
  vi.stubEnv("ATLAS_BUILD_APP_ENV", "staging");
  const client = await import("../../../frontend/apps/web/src/instrumentation-client");
  expect(sentry.init).toHaveBeenCalledWith(
    expect.objectContaining({
      enabled: true,
      dsn: "https://public@sentry.example.test/1",
      environment: "staging",
      sendDefaultPii: false,
    }),
  );
  // The release comes from the plugin's build-time injection, not a runtime setting.
  expect(sentry.init.mock.calls[0]?.[0]).not.toHaveProperty("release");
  expect(client.onRouterTransitionStart).toBe(sentry.captureRouterTransitionStart);
});
it("leaves browser Sentry off in a build without a DSN", async () => {
  vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "");
  await import("../../../frontend/apps/web/src/instrumentation-client");
  expect(sentry.init).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }));
});
