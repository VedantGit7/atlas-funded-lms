import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { enforceProtectedRateLimit, resetRateLimitsForTests } from "@atlas/api/rate-limit";
import {
  MemoryRateLimitStore,
  RateLimitConfigurationError,
  resolveTenantRateLimits,
  setRateLimitStore,
  validateRateLimitConfiguration,
} from "@atlas/api/rate-limit-store";
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
    for (let i = 0; i < 3000; i++)
      await enforceProtectedRateLimit({ ...actor, actorId: `member-${i}` });
    await expect(
      enforceProtectedRateLimit({ ...actor, actorId: "new-member" }),
    ).rejects.toMatchObject({ status: 429 });
    await expect(
      enforceProtectedRateLimit({ ...actor, tenantId: "tenant-b" }),
    ).resolves.toBeUndefined();
  });
});

describe("the tenant ceiling", () => {
  const reader = { ...actor, permission: "course.read", bucket: "tenantRead" };

  it("lets 500 learners active at once through, as in the staging load test", async () => {
    // Run 2 of docs/engineering/staging-load-test-2026-11-07.md: about 5,000
    // reads and 1,260 writes a minute, which the old 4,800 / 1,200 rejected.
    for (let i = 0; i < 5000; i++)
      await enforceProtectedRateLimit({ ...reader, actorId: `learner-${i % 500}` });
    for (let i = 0; i < 1260; i++)
      await enforceProtectedRateLimit({ ...actor, actorId: `learner-${i % 500}` });
  });

  it("follows the deployment's settings", async () => {
    vi.stubEnv("TENANT_RATE_LIMIT_READS_PER_MINUTE", "1000");
    vi.stubEnv("TENANT_RATE_LIMIT_WRITES_PER_MINUTE", "300");
    for (let i = 0; i < 300; i++)
      await enforceProtectedRateLimit({ ...actor, actorId: `member-${i}` });
    await expect(
      enforceProtectedRateLimit({ ...actor, actorId: "new-member" }),
    ).rejects.toMatchObject({ status: 429 });
    for (let i = 0; i < 1000; i++)
      await enforceProtectedRateLimit({ ...reader, actorId: `member-${i}` });
    await expect(
      enforceProtectedRateLimit({ ...reader, actorId: "new-member" }),
    ).rejects.toMatchObject({ status: 429 });
  });

  it.each([
    ["TENANT_RATE_LIMIT_READS_PER_MINUTE", "959"],
    ["TENANT_RATE_LIMIT_READS_PER_MINUTE", "12k"],
    ["TENANT_RATE_LIMIT_WRITES_PER_MINUTE", "239"],
    ["TENANT_RATE_LIMIT_WRITES_PER_MINUTE", "2500.5"],
    ["TENANT_RATE_LIMIT_WRITES_PER_MINUTE", "1000001"],
  ])("refuses to start with %s=%s", (name, value) => {
    vi.stubEnv(name, value);
    try {
      expect(() => validateRateLimitConfiguration()).toThrow(RateLimitConfigurationError);
      expect(() => validateRateLimitConfiguration()).toThrow(new RegExp(name));
    } finally {
      // afterEach resets the store, which validates the settings first.
      vi.stubEnv(name, "");
    }
  });

  it("uses the defaults when the settings are unset or empty", () => {
    expect(resolveTenantRateLimits({})).toEqual({ read: 12_000, write: 3_000 });
    expect(
      resolveTenantRateLimits({
        TENANT_RATE_LIMIT_READS_PER_MINUTE: " ",
        TENANT_RATE_LIMIT_WRITES_PER_MINUTE: "",
      }),
    ).toEqual({ read: 12_000, write: 3_000 });
  });
});
