import { afterEach, expect, it, vi } from "vitest";
const start = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("health server started");
  }),
);
vi.mock("../../../backend/apps/api/src/worker/outbox-sweep", () => ({ runOutboxSweep: vi.fn() }));
vi.mock("../../../backend/apps/api/src/worker/worker-health", () => ({
  createHealthState: vi.fn(),
  startHealthServer: start,
}));
vi.mock("@atlas/api/tenant-usage-meter", () => ({ flushTenantUsageMeter: vi.fn() }));
import { main } from "../../../backend/apps/api/src/worker/main";
afterEach(() => vi.unstubAllEnvs());
it("rejects worker configuration before opening readiness or processing events", async () => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("APP_ENV", "");
  vi.stubEnv("RATE_LIMIT_REDIS_URL", "rediss://redis.example.test");
  await expect(main()).rejects.toThrow(/APP_ENV/);
  expect(start).not.toHaveBeenCalled();
});
