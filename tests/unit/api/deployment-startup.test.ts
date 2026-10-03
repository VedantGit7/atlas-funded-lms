import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { deploymentEnv } from "../../helpers/deployment-env";
vi.mock("@sentry/nextjs", () => ({ init: vi.fn(), captureRequestError: vi.fn() }));
vi.mock("../../../backend/apps/api/node_modules/@sentry/nextjs", () => ({
  init: vi.fn(),
  captureRequestError: vi.fn(),
}));
vi.mock("../../../frontend/apps/web/node_modules/@sentry/nextjs", () => ({
  init: vi.fn(),
  captureRequestError: vi.fn(),
}));
import { register as backendRegister } from "../../../backend/apps/api/src/instrumentation";
import { register as frontendRegister } from "../../../frontend/apps/web/src/instrumentation";

beforeEach(() => {
  for (const [key, value] of Object.entries(deploymentEnv())) vi.stubEnv(key, value);
});
afterEach(() => vi.unstubAllEnvs());
describe("F05 startup rejects incomplete deployment configuration", () => {
  it("requires shared Redis for hosted deployments even when NODE_ENV is misleading", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("APP_ENV", "production ");
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("RATE_LIMIT_REDIS_URL", "");
    await expect(backendRegister()).rejects.toThrow(/REDIS_URL/);
  });
  for (const [name, register] of [
    ["API", backendRegister],
    ["web", frontendRegister],
  ] as const) {
    it.each([
      "APP_ENV",
      "R2_BUCKET_NAME",
      "DATABASE_URL",
      "PLATFORM_DATABASE_URL",
      "APP_URL",
      "PLATFORM_HOST",
      "API_INTERNAL_URL",
      "API_PROXY_SECRET",
      "NEXT_PUBLIC_SUPABASE_URL",
      "SUPABASE_SERVICE_ROLE_KEY",
      "CRON_SECRET",
      "INTERNAL_WORKER_SECRET",
      "LEARNER_BILLING_ENC_KEY",
      "OBSERVABILITY_HASH_SALT",
      "NOTIFICATION_EMAIL_PROVIDER",
      "SMTP_HOST",
      "SMTP_PASSWORD",
      "SENTRY_DSN",
      "RELEASE_SHA",
      "BETTER_STACK_WORKER_HEARTBEAT_URL",
    ])(`${name} fails before serving with missing %s`, async (key) => {
      vi.stubEnv(key, "");
      await expect(register()).rejects.toThrow(
        new RegExp(key === "SENTRY_DSN" ? "SENTRY" : key === "RELEASE_SHA" ? "RELEASE" : key),
      );
    });
    it(`${name} accepts a complete deployment configuration without connecting`, async () => {
      await expect(register()).resolves.toBeUndefined();
    });
    it(`${name} validates actual storage limits before startup`, async () => {
      vi.stubEnv("STORAGE_SIGNED_UPLOAD_TTL_SECONDS", "99999");
      await expect(register()).rejects.toThrow(/STORAGE_SIGNED_UPLOAD_TTL_SECONDS/);
    });
  }
});
