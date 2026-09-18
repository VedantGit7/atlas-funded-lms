import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFindMembership = vi.fn();

// `vi.mock` replaces the whole module, so every export the gate calls has to
// be listed. `requireActiveMembership` gained activity tracking
// (touchMembershipLastActive, recordMembershipActiveDay) after this mock was
// written, and the missing exports made the gate throw rather than resolve.
vi.mock("../../../backend/packages/membership/src/membership.repository", () => ({
  findMembershipByPrincipal: (...args: unknown[]) => mockFindMembership(...args),
  touchMembershipLastActive: () => Promise.resolve(),
  recordMembershipActiveDay: () => Promise.resolve(),
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
