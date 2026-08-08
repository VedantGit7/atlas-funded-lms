import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFindMembership = vi.fn();
const mockInsertMembership = vi.fn();
const mockCreateProfile = vi.fn();
const mockAssignLearnerRole = vi.fn();

vi.mock("../../../backend/packages/membership/src/membership.repository", () => ({
  findMembershipByPrincipal: (...args: unknown[]) => mockFindMembership(...args),
  insertActiveSelfServiceMembership: (...args: unknown[]) => mockInsertMembership(...args),
}));

vi.mock("../../../backend/packages/membership/src/member-profile.repository", () => ({
  createMemberProfileIfMissing: (...args: unknown[]) => mockCreateProfile(...args),
}));

vi.mock("@atlas/access", () => ({
  assignDefaultLearnerRole: (...args: unknown[]) => mockAssignLearnerRole(...args),
}));

import { ensureSelfServiceLearnerMembership } from "../../../backend/packages/membership/src/self-service-membership";

const tx = { $queryRaw: vi.fn() } as never;

const baseArgs = {
  tx,
  tenantId: "tenant-id",
  authPrincipalId: "principal-id",
  email: "learner@example.com",
};

function membership(status: string, id = "existing-membership") {
  return {
    id,
    tenantId: "tenant-id",
    authPrincipalId: "principal-id",
    status,
    invitedEmailNormalized: "learner@example.com",
  };
}

describe("ensureSelfServiceLearnerMembership", () => {
  beforeEach(() => {
    mockFindMembership.mockReset();
    mockInsertMembership.mockReset();
    mockCreateProfile.mockReset();
    mockAssignLearnerRole.mockReset();
  });

  it("creates an ACTIVE membership, assigns the learner role, and creates the profile", async () => {
    mockFindMembership.mockResolvedValueOnce(null);
    mockInsertMembership.mockResolvedValue({ id: "new-membership" });
    mockCreateProfile.mockResolvedValue({
      id: "profile-id",
      membershipId: "new-membership",
      displayName: "New Learner",
      avatarUrl: null,
    });

    const result = await ensureSelfServiceLearnerMembership({
      ...baseArgs,
      displayName: "New Learner",
    });

    expect(result).toEqual({ membershipId: "new-membership", created: true });
    expect(mockInsertMembership).toHaveBeenCalledOnce();
    expect(mockAssignLearnerRole).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: "tenant-id", membershipId: "new-membership" }),
    );
    expect(mockCreateProfile).toHaveBeenCalledWith(
      expect.objectContaining({ membershipId: "new-membership", displayName: "New Learner" }),
    );
  });

  it("never reactivates or touches a SUSPENDED membership", async () => {
    mockFindMembership.mockResolvedValueOnce(membership("SUSPENDED"));

    const result = await ensureSelfServiceLearnerMembership(baseArgs);

    expect(result).toEqual({ membershipId: "existing-membership", created: false });
    expect(mockInsertMembership).not.toHaveBeenCalled();
    expect(mockAssignLearnerRole).not.toHaveBeenCalled();
    expect(mockCreateProfile).not.toHaveBeenCalled();
  });

  it("leaves an INVITED membership for the invitation acceptance flow", async () => {
    mockFindMembership.mockResolvedValueOnce(membership("INVITED"));

    const result = await ensureSelfServiceLearnerMembership(baseArgs);

    expect(result).toEqual({ membershipId: "existing-membership", created: false });
    expect(mockInsertMembership).not.toHaveBeenCalled();
    expect(mockAssignLearnerRole).not.toHaveBeenCalled();
  });

  it("is a no-op (created: false) when the membership already exists and is ACTIVE", async () => {
    mockFindMembership.mockResolvedValueOnce(membership("ACTIVE"));

    const result = await ensureSelfServiceLearnerMembership(baseArgs);

    expect(result).toEqual({ membershipId: "existing-membership", created: false });
    expect(mockInsertMembership).not.toHaveBeenCalled();
  });

  it("handles a concurrent insert race by re-reading the membership without granting again", async () => {
    // No membership at read time, but the insert loses the race (conflict -> null).
    mockFindMembership
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(membership("ACTIVE", "raced-membership"));
    mockInsertMembership.mockResolvedValue(null);

    const result = await ensureSelfServiceLearnerMembership(baseArgs);

    expect(result).toEqual({ membershipId: "raced-membership", created: false });
    expect(mockAssignLearnerRole).not.toHaveBeenCalled();
    expect(mockCreateProfile).not.toHaveBeenCalled();
  });
});
