import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFindMembership = vi.fn();

// `vi.mock` replaces the whole module, so every export the gate calls has to
// be listed. The gate reads the membership and the account's status (audit H6)
// in one call; an active account is assumed here.
vi.mock("../../../backend/packages/membership/src/membership.repository", () => ({
  findMembershipForRequest: async (...args: unknown[]) => {
    const membership: unknown = await mockFindMembership(...args);
    return membership ? { membership, principalStatus: "active" } : null;
  },
}));

import { requireActiveMembership } from "../../../backend/packages/membership/src/membership-gate";

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
