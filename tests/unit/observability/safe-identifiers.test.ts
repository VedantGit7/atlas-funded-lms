import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  actorSafeId,
  hashSafeIdentifier,
  tenantSafeId,
} from "@atlas/observability/safe-identifiers";

describe("safe identifiers", () => {
  beforeEach(() => {
    process.env.OBSERVABILITY_HASH_SALT = "test-salt";
  });

  afterEach(() => {
    delete process.env.OBSERVABILITY_HASH_SALT;
  });

  it("hashes tenant and actor ids deterministically", () => {
    const tenantA = tenantSafeId("tenant-a");
    const tenantB = tenantSafeId("tenant-b");
    expect(tenantA).toMatch(/^tenant_[a-f0-9]{32}$/);
    expect(tenantA).not.toBe(tenantB);
    expect(actorSafeId("member-1")).toMatch(/^actor_[a-f0-9]{32}$/);
  });

  it("fails without salt in production validation path", () => {
    delete process.env.OBSERVABILITY_HASH_SALT;
    expect(() => hashSafeIdentifier("tenant", "x")).toThrow(/OBSERVABILITY_HASH_SALT/);
  });
});
