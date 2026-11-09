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

  // Tenant routes used to read the principal in a transaction of their own and
  // refuse a deleted or disabled account before the gate ran. The gate now
  // does it, first, so the answers are the same whatever the membership is.
  it.each([
    [null, "ACTIVE", "AUTH_REQUIRED", 401],
    [null, null, "AUTH_REQUIRED", 401],
    ["disabled", "ACTIVE", "ACCOUNT_DISABLED", 403],
    ["disabled", "SUSPENDED", "ACCOUNT_DISABLED", 403],
    ["disabled", null, "ACCOUNT_DISABLED", 403],
    ["unclaimed", "INVITED", "ACCOUNT_DISABLED", 403],
  ] as const)(
    "checks the account before the membership: account %s, membership %s gives %s",
    async (principalStatus, membershipStatus, code, status) => {
      vi.spyOn(membershipRepository, "findMembershipForRequest").mockResolvedValue({
        membership: membershipStatus
          ? {
              id: "membership-id",
              tenantId: "tenant-a-id",
              authPrincipalId: "principal-id",
              status: membershipStatus,
              invitedEmailNormalized: null,
            }
          : null,
        principalStatus,
      });

      await expect(
        requireActiveMembership({
          tx: { $queryRaw: vi.fn() },
          tenantId: "tenant-a-id",
          authPrincipalId: "principal-id",
        }),
      ).rejects.toMatchObject({ code, status });
    },
  );

  it("blocks principals with no membership row", async () => {
    vi.spyOn(membershipRepository, "findMembershipForRequest").mockResolvedValue({
      membership: null,
      principalStatus: "active",
    });

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
