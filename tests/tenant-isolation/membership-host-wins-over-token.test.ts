import { afterEach, describe, expect, it, vi } from "vitest";
import * as membershipRepository from "../../backend/packages/membership/src/membership.repository";
import { requireActiveMembership } from "../../backend/packages/membership/src/membership-gate";

describe("membership tenant isolation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("checks membership for host tenant, not token claims", async () => {
    const findMembership = vi
      .spyOn(membershipRepository, "findMembershipByPrincipal")
      .mockResolvedValue(null);

    await expect(
      requireActiveMembership({
        tx: { $queryRaw: vi.fn() },
        tenantId: "tenant-b-id",
        authPrincipalId: "principal-with-tenant-a-membership",
      }),
    ).rejects.toMatchObject({
      code: "NO_MEMBERSHIP",
      status: 403,
    });

    expect(findMembership).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant-b-id",
        authPrincipalId: "principal-with-tenant-a-membership",
      }),
    );
  });
});
