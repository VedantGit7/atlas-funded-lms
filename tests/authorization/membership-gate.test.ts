import { afterEach, describe, expect, it, vi } from "vitest";
import * as membershipRepository from "../../backend/packages/membership/src/membership.repository";
import { requireActiveMembership } from "../../backend/packages/membership/src/membership-gate";

describe("membership gate authorization", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    ["INVITED", "MEMBERSHIP_PENDING"],
    ["SUSPENDED", "MEMBERSHIP_SUSPENDED"],
    ["REMOVED", "MEMBERSHIP_REMOVED"],
  ] as const)("blocks %s membership with %s", async (status, code) => {
    vi.spyOn(membershipRepository, "findMembershipForRequest").mockResolvedValue({
      membership: {
        id: "membership-id",
        tenantId: "tenant-a-id",
        authPrincipalId: "principal-id",
        status,
        invitedEmailNormalized: null,
      },
      principalStatus: "active",
    });

    await expect(
      requireActiveMembership({
        tx: { $queryRaw: vi.fn() },
        tenantId: "tenant-a-id",
        authPrincipalId: "principal-id",
      }),
    ).rejects.toMatchObject({
      code,
      status: 403,
    });
  });

  it("blocks principals with no membership row", async () => {
    vi.spyOn(membershipRepository, "findMembershipForRequest").mockResolvedValue(null);

    await expect(
      requireActiveMembership({
        tx: { $queryRaw: vi.fn() },
        tenantId: "tenant-a-id",
        authPrincipalId: "principal-id",
      }),
    ).rejects.toMatchObject({
      code: "NO_MEMBERSHIP",
      status: 403,
    });
  });
});
