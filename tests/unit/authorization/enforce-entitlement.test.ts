import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TenantTx } from "@atlas/db";

const findActiveEntitlementByKeyMock = vi.fn();

vi.mock("@atlas/domain-config", () => ({
  findActiveEntitlementByKey: (...args: unknown[]) => findActiveEntitlementByKeyMock(...args),
}));

import { enforceEntitlement } from "@atlas/authorization";
import { EntitlementRequiredError } from "@atlas/authorization";

const tx = { $queryRaw: vi.fn() } as unknown as TenantTx;

const baseArgs = {
  tenantId: "tenant-a",
  requestId: "req_test",
};

describe("enforceEntitlement", () => {
  beforeEach(() => {
    findActiveEntitlementByKeyMock.mockReset();
  });

  it("returns success when no entitlement key is provided", async () => {
    await expect(
      enforceEntitlement(tx, {
        ...baseArgs,
        key: null,
      }),
    ).resolves.toBeUndefined();

    await expect(enforceEntitlement(tx, baseArgs)).resolves.toBeUndefined();

    expect(findActiveEntitlementByKeyMock).not.toHaveBeenCalled();
  });

  it("returns success when an active entitlement exists", async () => {
    findActiveEntitlementByKeyMock.mockResolvedValue({
      key: "community.enable",
      value: true,
      enabled: true,
      expires_at: null,
    });

    await expect(
      enforceEntitlement(tx, {
        ...baseArgs,
        key: "community.enable",
      }),
    ).resolves.toBeUndefined();

    expect(findActiveEntitlementByKeyMock).toHaveBeenCalledWith(tx, "community.enable");
  });

  it("throws ENTITLEMENT_REQUIRED when the entitlement is missing", async () => {
    findActiveEntitlementByKeyMock.mockResolvedValue(null);

    await expect(
      enforceEntitlement(tx, {
        ...baseArgs,
        key: "community.enable",
      }),
    ).rejects.toMatchObject({
      code: "ENTITLEMENT_REQUIRED",
      status: 403,
      entitlementKey: "community.enable",
    });

    await expect(
      enforceEntitlement(tx, {
        ...baseArgs,
        key: "community.enable",
      }),
    ).rejects.toBeInstanceOf(EntitlementRequiredError);
  });

  it("throws ENTITLEMENT_REQUIRED when the entitlement is expired", async () => {
    findActiveEntitlementByKeyMock.mockResolvedValue(null);

    await expect(
      enforceEntitlement(tx, {
        ...baseArgs,
        key: "community.enable",
      }),
    ).rejects.toMatchObject({
      code: "ENTITLEMENT_REQUIRED",
      entitlementKey: "community.enable",
    });
  });

  it("throws ENTITLEMENT_REQUIRED when the entitlement is disabled", async () => {
    findActiveEntitlementByKeyMock.mockResolvedValue(null);

    await expect(
      enforceEntitlement(tx, {
        ...baseArgs,
        key: "gamification.enable",
      }),
    ).rejects.toMatchObject({
      code: "ENTITLEMENT_REQUIRED",
      entitlementKey: "gamification.enable",
    });
  });

  it("never checks plan_name, plan, or subscription fields", () => {
    const enforceSource = readFileSync(
      resolve(import.meta.dirname, "../../../packages/authorization/src/enforce-entitlement.ts"),
      "utf8",
    );
    const repositorySource = readFileSync(
      resolve(
        import.meta.dirname,
        "../../../packages/domain/config/src/repositories/entitlement.repository.ts",
      ),
      "utf8",
    );

    for (const source of [enforceSource, repositorySource]) {
      expect(source).not.toContain("plan_name");
      expect(source).not.toContain("subscription");
      expect(source).not.toMatch(/\bplan\b/i);
    }

    expect(findActiveEntitlementByKeyMock).not.toHaveBeenCalled();
  });
});
