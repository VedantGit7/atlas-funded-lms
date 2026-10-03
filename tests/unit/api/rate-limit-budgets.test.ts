import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { enforceProtectedRateLimit, resetRateLimitsForTests } from "@atlas/api/rate-limit";
import { MemoryRateLimitStore, setRateLimitStore } from "@atlas/api/rate-limit-store";
const actor = {
  plane: "tenant" as const,
  tenantId: "tenant-a",
  actorId: "member-a",
  permission: "course.update",
  bucket: "tenantMutation",
  requestId: "r",
};
beforeEach(() => {
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("APP_ENV", "development");
  vi.stubEnv("REDIS_URL", "");
  vi.stubEnv("RATE_LIMIT_REDIS_URL", "");
  setRateLimitStore(new MemoryRateLimitStore());
});
afterEach(async () => {
  await resetRateLimitsForTests();
  setRateLimitStore(null);
  vi.unstubAllEnvs();
});
describe("F04 tenant, actor and operation budgets", () => {
  it("permits 60 writes and blocks the next across metadata aliases", async () => {
    for (let i = 0; i < 60; i++) await enforceProtectedRateLimit(actor);
    await expect(
      enforceProtectedRateLimit({ ...actor, bucket: "authenticatedTenantWrite" }),
    ).rejects.toMatchObject({ status: 429 });
    await expect(
      enforceProtectedRateLimit({ ...actor, tenantId: "tenant-b" }),
    ).resolves.toBeUndefined();
    await expect(
      enforceProtectedRateLimit({ ...actor, actorId: "member-b" }),
    ).resolves.toBeUndefined();
  });
  it("limits an actor who rotates operations", async () => {
    for (let i = 0; i < 240; i++)
      await enforceProtectedRateLimit({ ...actor, permission: `operation-${i}` });
    await expect(
      enforceProtectedRateLimit({ ...actor, permission: "another-operation" }),
    ).rejects.toMatchObject({ status: 429 });
  });
  it("limits a tenant even when requests rotate actors", async () => {
    for (let i = 0; i < 1200; i++)
      await enforceProtectedRateLimit({ ...actor, actorId: `member-${i}` });
    await expect(
      enforceProtectedRateLimit({ ...actor, actorId: "new-member" }),
    ).rejects.toMatchObject({ status: 429 });
    await expect(
      enforceProtectedRateLimit({ ...actor, tenantId: "tenant-b" }),
    ).resolves.toBeUndefined();
  });
});
