import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFindInvited = vi.fn();
const mockActivate = vi.fn();
const mockCreateProfile = vi.fn();
const mockWriteAudit = vi.fn();

vi.mock("../../../backend/packages/membership/src/membership.repository", () => ({
  findInvitedMembershipByTokenHash: (...args: unknown[]) => mockFindInvited(...args),
  activateInvitedMembership: (...args: unknown[]) => mockActivate(...args),
}));

vi.mock("../../../backend/packages/membership/src/member-profile.repository", () => ({
  createMemberProfileIfMissing: (...args: unknown[]) => mockCreateProfile(...args),
}));

vi.mock("../../../backend/packages/membership/src/membership-audit.repository", () => ({
  writeMembershipStatusAudit: (...args: unknown[]) => mockWriteAudit(...args),
}));

import { acceptInvitation } from "../../../backend/packages/membership/src/invitation.service";

describe("acceptInvitation", () => {
  beforeEach(() => {
    mockFindInvited.mockReset();
    mockActivate.mockReset();
    mockCreateProfile.mockReset();
    mockWriteAudit.mockReset();
  });

  it("activates invited membership, creates profile, and writes audit", async () => {
    mockFindInvited.mockResolvedValue({
      id: "membership-id",
      tenantId: "tenant-id",
      authPrincipalId: null,
      status: "INVITED",
      invitedEmailNormalized: "member@example.com",
    });
    mockActivate.mockResolvedValue({
      id: "membership-id",
      tenantId: "tenant-id",
      authPrincipalId: "principal-id",
      status: "ACTIVE",
      invitedEmailNormalized: "member@example.com",
    });
    mockCreateProfile.mockResolvedValue({
      id: "profile-id",
      membershipId: "membership-id",
      displayName: null,
      avatarUrl: null,
    });

    const result = await acceptInvitation({
      tx: { $queryRaw: vi.fn() },
      tenantId: "tenant-id",
      requestId: "req_00000000-0000-4000-8000-000000000000",
      input: { token: "invite-token-abcdefghijklmnopqrstuvwxyz123456" },
      principal: {
        id: "principal-id",
        emailNormalized: "member@example.com",
      },
    });

    expect(result.membership).toEqual({
      id: "membership-id",
      status: "ACTIVE",
    });
    expect(result.profile.id).toBe("profile-id");
    expect(mockWriteAudit).toHaveBeenCalledOnce();
  });

  it("returns safe invalid invitation for unknown token", async () => {
    mockFindInvited.mockResolvedValue(null);

    await expect(
      acceptInvitation({
        tx: { $queryRaw: vi.fn() },
        tenantId: "tenant-id",
        requestId: "req_00000000-0000-4000-8000-000000000000",
        input: { token: "invite-token-abcdefghijklmnopqrstuvwxyz123456" },
        principal: {
          id: "principal-id",
          emailNormalized: "member@example.com",
        },
      }),
    ).rejects.toMatchObject({
      code: "INVALID_INVITATION",
      status: 404,
    });
  });

  it("rejects email mismatch without leaking invite details", async () => {
    mockFindInvited.mockResolvedValue({
      id: "membership-id",
      tenantId: "tenant-id",
      authPrincipalId: null,
      status: "INVITED",
      invitedEmailNormalized: "invited@example.com",
    });

    await expect(
      acceptInvitation({
        tx: { $queryRaw: vi.fn() },
        tenantId: "tenant-id",
        requestId: "req_00000000-0000-4000-8000-000000000000",
        input: { token: "invite-token-abcdefghijklmnopqrstuvwxyz123456" },
        principal: {
          id: "principal-id",
          emailNormalized: "other@example.com",
        },
      }),
    ).rejects.toMatchObject({
      // Was INVALID_INVITATION/404. A dedicated INVITATION_EMAIL_MISMATCH/403
      // was added deliberately — it is a declared member of AtlasErrorCode — so
      // a user signed in with the wrong account gets an actionable message
      // rather than "invitation not found". The unknown-token case above still
      // returns the safe 404, which is where token non-disclosure matters.
      code: "INVITATION_EMAIL_MISMATCH",
      status: 403,
    });

    // The non-leak property this test is named for, stated explicitly so a
    // future copy change cannot put the invited address in front of whoever
    // happens to hold the token.
    const rejection = await acceptInvitation({
      tx: { $queryRaw: vi.fn() },
      tenantId: "tenant-id",
      requestId: "req_00000000-0000-4000-8000-000000000000",
      input: { token: "invite-token-abcdefghijklmnopqrstuvwxyz123456" },
      principal: { id: "principal-id", emailNormalized: "other@example.com" },
    }).catch((error: unknown) => error);

    expect(String((rejection as { message?: string }).message)).not.toContain(
      "invited@example.com",
    );
  });
});
