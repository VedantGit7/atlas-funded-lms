import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TenantTx } from "@atlas/db";

const findActiveEntitlementByKeyMock = vi.fn();
const canMock = vi.fn();

vi.mock("@atlas/domain-config", async () => {
  // The gate now reads value_json on every call, so the parse is real here:
  // mocking it would hide whether `{ enabled: false }` actually denies.
  const { parseEntitlementValue } = (await vi.importActual(
    "@atlas/domain-config/schemas/entitlement-value",
  )) as {
    parseEntitlementValue: (raw: unknown) => {
      enabled: boolean;
      limit: number | null;
      period: string;
    };
  };
  return {
    parseEntitlementValue,
    findActiveEntitlementByKey: (...args: unknown[]) => findActiveEntitlementByKeyMock(...args),
  };
});

vi.mock("@atlas/authorization", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    can: (...args: unknown[]) => canMock(...args),
  };
});

import { toSafeErrorEnvelope } from "@atlas/api";
import { runProtectedTenantRoutePipeline } from "@atlas/api/create-tenant-route";
import { EntitlementRequiredError } from "@atlas/authorization";

describe("entitlement before can", () => {
  beforeEach(() => {
    findActiveEntitlementByKeyMock.mockReset();
    canMock.mockReset();
  });

  it("returns 403 ENTITLEMENT_REQUIRED before can() when entitlement is missing", async () => {
    findActiveEntitlementByKeyMock.mockResolvedValue(null);

    let error: unknown;

    try {
      await runProtectedTenantRoutePipeline({
        tx: { $queryRaw: vi.fn() } as unknown as TenantTx,
        ctx: {
          tenantId: "tenant-a",
          requestId: "req_test",
          actorMembershipId: "admin-a",
        },
        metadata: {
          permission: "community.moderate",
          entitlement: "community.enable",
          rateLimit: "authenticatedTenantRead",
          audit: "none",
          idempotency: "none",
        },
        params: {},
        input: undefined,
      });
      expect.unreachable("expected entitlement enforcement to fail");
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(EntitlementRequiredError);
    expect(error).toMatchObject({
      code: "ENTITLEMENT_REQUIRED",
      status: 403,
      entitlementKey: "community.enable",
    });
    expect(canMock).not.toHaveBeenCalled();

    const envelope = toSafeErrorEnvelope(error, "req_test");

    expect(envelope.status).toBe(403);
    expect(envelope.body.error).toEqual({
      code: "ENTITLEMENT_REQUIRED",
      message: "This feature is not enabled for this tenant.",
      requestId: "req_test",
    });
  });
});
