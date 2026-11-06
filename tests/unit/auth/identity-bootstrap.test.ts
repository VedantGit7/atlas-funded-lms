import { afterEach, describe, expect, it, vi } from "vitest";
import * as membershipRepository from "../../../backend/packages/membership/src/membership.repository";
import { requireActiveMembership } from "../../../backend/packages/membership/src/membership-gate";
import {
  identityBlockMessage,
  identityBlockMessageFromQuery,
  identityBlockQueryValue,
  isIdentityBlockCode,
  safeInvitationErrorMessage,
} from "../../../frontend/apps/web/src/lib/auth-messages";

describe("membership gate refuses disabled accounts (audit H6)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const activeMembership = {
    id: "membership-id",
    tenantId: "tenant-a-id",
    authPrincipalId: "principal-id",
    status: "ACTIVE" as const,
    invitedEmailNormalized: null,
  };

  it.each(["disabled", "unclaimed", null])(
    "blocks an ACTIVE membership whose account is %s",
    async (status) => {
      // Activity is written only for an admitted request: the SQL that does it
      // is covered against Postgres in hot-path-round-trips.test.ts.
      vi.spyOn(membershipRepository, "findMembershipForRequest").mockResolvedValue({
        membership: activeMembership,
        principalStatus: status,
      });

      await expect(
        requireActiveMembership({
          tx: { $queryRaw: vi.fn() },
          tenantId: "tenant-a-id",
          authPrincipalId: "principal-id",
        }),
      ).rejects.toMatchObject({ code: "ACCOUNT_DISABLED", status: 403 });
    },
  );

  it("admits an ACTIVE membership of an active account", async () => {
    vi.spyOn(membershipRepository, "findMembershipForRequest").mockResolvedValue({
      membership: activeMembership,
      principalStatus: "active",
    });

    await expect(
      requireActiveMembership({
        tx: { $queryRaw: vi.fn() },
        tenantId: "tenant-a-id",
        authPrincipalId: "principal-id",
      }),
    ).resolves.toMatchObject({ membershipId: "membership-id", status: "ACTIVE" });
  });
});

describe("sign-in messages for identity refusals", () => {
  it.each([
    "ACCOUNT_DISABLED",
    "EMAIL_NOT_VERIFIED",
    "ACCOUNT_NOT_LINKED",
    "NO_ACTIVE_MEMBERSHIP",
  ] as const)("names the next step for %s and round-trips it through the login URL", (code) => {
    expect(isIdentityBlockCode(code)).toBe(true);
    const message = identityBlockMessage(code);
    expect(message).toBeTruthy();
    expect(identityBlockMessageFromQuery(identityBlockQueryValue(code))).toBe(message);
    expect(safeInvitationErrorMessage(code)).toBe(message);
  });

  it("ignores anything else, so a crafted ?error= cannot inject text", () => {
    expect(isIdentityBlockCode("AUTH_REQUIRED")).toBe(false);
    expect(isIdentityBlockCode("toString")).toBe(false);
    expect(identityBlockMessage(undefined)).toBeNull();
    expect(identityBlockMessageFromQuery("<script>alert(1)</script>")).toBeNull();
    expect(identityBlockMessageFromQuery("oauth")).toBeNull();
  });
});
