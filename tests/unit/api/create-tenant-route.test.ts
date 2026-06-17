import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TenantTx } from "@atlas/db";

const resource = {
  type: "membership_collection",
  id: "tenant-a",
  tenantId: "tenant-a",
  tenantScoped: true as const,
  ownerMembershipId: null,
  relationships: {},
};

const { callOrder, enforceEntitlementMock, loadResourceMock, canMock } = vi.hoisted(() => {
  const callOrder: string[] = [];

  return {
    callOrder,
    enforceEntitlementMock: vi.fn(async () => {
      callOrder.push("entitlement");
    }),
    loadResourceMock: vi.fn(async () => {
      callOrder.push("resource");
      return resource;
    }),
    canMock: vi.fn(async () => {
      callOrder.push("can");
      return {
        allowed: true,
        permission: "membership.read",
        reason: "ALLOWED",
        matchedRoleKeys: ["admin"],
        bypassedResourcePredicate: true,
      };
    }),
  };
});

vi.mock("@atlas/authorization", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    enforceEntitlement: enforceEntitlementMock,
    can: canMock,
  };
});

vi.mock("../../../packages/api/src/load-resource-ref", () => ({
  loadResourceRefOrDefault: loadResourceMock,
}));

vi.mock("../../../packages/authorization/src/authorization-errors", () => ({
  toAuthorizationError: vi.fn((decision) => new Error(decision.reason)),
  permissionDenied: vi.fn(),
}));

import { runProtectedTenantRoutePipeline } from "@atlas/api/create-tenant-route";
import { EntitlementRequiredError } from "@atlas/authorization";

describe("protected tenant route pipeline", () => {
  beforeEach(() => {
    callOrder.length = 0;
    enforceEntitlementMock.mockClear();
    loadResourceMock.mockClear();
    canMock.mockClear();
  });

  it("runs entitlement, resource loading, and can() in order", async () => {
    const tx = { $queryRaw: vi.fn() } as unknown as TenantTx;

    const result = await runProtectedTenantRoutePipeline({
      tx,
      ctx: {
        tenantId: "tenant-a",
        requestId: "req_test",
        actorMembershipId: "member-a",
      },
      metadata: {
        permission: "membership.read",
        entitlement: "community.enable",
        rateLimit: "authenticatedTenantRead",
        audit: "none",
        idempotency: "none",
      },
      params: {},
      input: undefined,
    });

    expect(result).toBe(resource);
    expect(callOrder).toEqual(["entitlement", "resource", "can"]);
    expect(enforceEntitlementMock).toHaveBeenCalledWith(tx, {
      tenantId: "tenant-a",
      key: "community.enable",
      requestId: "req_test",
    });
    expect(canMock).toHaveBeenCalledWith({
      tx,
      actor: {
        tenantId: "tenant-a",
        membershipId: "member-a",
      },
      permission: "membership.read",
      resource,
      ctx: {
        tenantId: "tenant-a",
        requestId: "req_test",
      },
    });
  });

  it("propagates entitlement failures before can()", async () => {
    enforceEntitlementMock.mockRejectedValueOnce(new EntitlementRequiredError("community.enable"));

    await expect(
      runProtectedTenantRoutePipeline({
        tx: { $queryRaw: vi.fn() } as unknown as TenantTx,
        ctx: {
          tenantId: "tenant-a",
          requestId: "req_test",
          actorMembershipId: "member-a",
        },
        metadata: {
          permission: "membership.read",
          entitlement: "community.enable",
          rateLimit: "authenticatedTenantRead",
          audit: "none",
          idempotency: "none",
        },
        params: {},
        input: undefined,
      }),
    ).rejects.toBeInstanceOf(EntitlementRequiredError);

    expect(canMock).not.toHaveBeenCalled();
  });
});
