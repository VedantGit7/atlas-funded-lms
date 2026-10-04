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
import {
  REQUIRED_MIN_PASSWORD_LENGTH,
  evaluateSupabaseAuthConfig,
} from "../../../scripts/security/verify-supabase-auth-config.mjs";

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
      vi.spyOn(membershipRepository, "findMembershipByPrincipal").mockResolvedValue(
        activeMembership,
      );
      vi.spyOn(membershipRepository, "findPrincipalGlobalStatus").mockResolvedValue(status);
      const touch = vi.spyOn(membershipRepository, "touchMembershipLastActive");

      await expect(
        requireActiveMembership({
          tx: { $queryRaw: vi.fn() },
          tenantId: "tenant-a-id",
          authPrincipalId: "principal-id",
        }),
      ).rejects.toMatchObject({ code: "ACCOUNT_DISABLED", status: 403 });
      expect(touch).not.toHaveBeenCalled();
    },
  );

  it("admits an ACTIVE membership of an active account", async () => {
    vi.spyOn(membershipRepository, "findMembershipByPrincipal").mockResolvedValue(activeMembership);
    vi.spyOn(membershipRepository, "findPrincipalGlobalStatus").mockResolvedValue("active");
    vi.spyOn(membershipRepository, "touchMembershipLastActive").mockResolvedValue(undefined);
    vi.spyOn(membershipRepository, "recordMembershipActiveDay").mockResolvedValue(undefined);

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
  it.each(["ACCOUNT_DISABLED", "EMAIL_NOT_VERIFIED", "ACCOUNT_REVIEW_REQUIRED"] as const)(
    "names the next step for %s and round-trips it through the login URL",
    (code) => {
      expect(isIdentityBlockCode(code)).toBe(true);
      const message = identityBlockMessage(code);
      expect(message).toBeTruthy();
      expect(identityBlockMessageFromQuery(identityBlockQueryValue(code))).toBe(message);
      expect(safeInvitationErrorMessage(code)).toBe(message);
    },
  );

  it("ignores anything else, so a crafted ?error= cannot inject text", () => {
    expect(isIdentityBlockCode("AUTH_REQUIRED")).toBe(false);
    expect(isIdentityBlockCode("toString")).toBe(false);
    expect(identityBlockMessage(undefined)).toBeNull();
    expect(identityBlockMessageFromQuery("<script>alert(1)</script>")).toBeNull();
    expect(identityBlockMessageFromQuery("oauth")).toBeNull();
  });
});

describe("hosted Supabase Auth policy check", () => {
  const compliant = {
    mailer_autoconfirm: false,
    password_min_length: REQUIRED_MIN_PASSWORD_LENGTH,
    security_update_password_require_reauthentication: true,
    password_hibp_enabled: true,
  };

  it("accepts a compliant project", () => {
    expect(evaluateSupabaseAuthConfig(compliant)).toEqual({ errors: [], warnings: [] });
  });

  it.each([
    ["mailer_autoconfirm", true],
    ["password_min_length", 6],
    ["password_min_length", undefined],
    ["security_update_password_require_reauthentication", false],
  ])("rejects %s = %s", (key, value) => {
    const { errors } = evaluateSupabaseAuthConfig({ ...compliant, [key]: value });
    expect(errors).toHaveLength(1);
  });

  it("warns, and only fails when asked, without Supabase leaked-password protection", () => {
    const config = { ...compliant, password_hibp_enabled: false };
    expect(evaluateSupabaseAuthConfig(config)).toMatchObject({
      errors: [],
      warnings: [expect.any(String)],
    });
    expect(evaluateSupabaseAuthConfig(config, { requireHibp: true }).errors).toHaveLength(1);
  });
});
