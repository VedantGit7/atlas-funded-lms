import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFindMembership = vi.fn();

vi.mock("../../../packages/membership/src/membership.repository", () => ({
  findMembershipByPrincipal: (...args: unknown[]) => mockFindMembership(...args),
}));

import { requireActiveMembership } from "../../../packages/membership/src/membership-gate";

describe("GET /me membership gate", () => {
  beforeEach(() => {
    mockFindMembership.mockReset();
  });

  it("allows ACTIVE membership", async () => {
    mockFindMembership.mockResolvedValue({
      id: "membership-id",
      tenantId: "tenant-a-id",
      authPrincipalId: "principal-id",
      status: "ACTIVE",
      invitedEmailNormalized: null,
    });

    await expect(
      requireActiveMembership({
        tx: { $queryRaw: vi.fn() },
        tenantId: "tenant-a-id",
        authPrincipalId: "principal-id",
      }),
    ).resolves.toMatchObject({
      membershipId: "membership-id",
      status: "ACTIVE",
    });
  });

  it("blocks missing membership", async () => {
    mockFindMembership.mockResolvedValue(null);

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
