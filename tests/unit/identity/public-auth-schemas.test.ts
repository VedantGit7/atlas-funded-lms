import { describe, expect, it } from "vitest";
import {
  PublicLoginRequestSchema,
  PublicSignupRequestSchema,
  PublicAuthResponseSchema,
  rejectClientTenantId,
  resolvePublicAuthStatus,
  resolveRoleHomePath,
  resolvePostInviteRedirect,
  resolveRedirectForAuthStatus,
} from "@atlas/domain-identity";

describe("public auth schemas", () => {
  it("validates login request", () => {
    expect(
      PublicLoginRequestSchema.parse({
        email: "User@Example.com",
        password: "password123",
      }),
    ).toEqual({
      email: "user@example.com",
      password: "password123",
    });
  });

  it("rejects client tenant_id on login", () => {
    expect(() =>
      PublicLoginRequestSchema.parse({
        email: "user@example.com",
        password: "password123",
        tenant_id: "spoofed",
      }),
    ).toThrow();
  });

  it("validates signup request with displayName and invite token", () => {
    expect(
      PublicSignupRequestSchema.parse({
        email: "user@example.com",
        displayName: "Atlas User",
        inviteToken: "a".repeat(32),
        acceptTerms: true,
      }).displayName,
    ).toBe("Atlas User");
  });

  it("refuses a sign-up without the 'I agree' box ticked (launch plan 5.7)", () => {
    const base = { email: "user@example.com", displayName: "Atlas User" };
    expect(PublicSignupRequestSchema.safeParse(base).success).toBe(false);
    expect(PublicSignupRequestSchema.safeParse({ ...base, acceptTerms: false }).success).toBe(
      false,
    );
    expect(PublicSignupRequestSchema.safeParse({ ...base, acceptTerms: "true" }).success).toBe(
      false,
    );
  });

  it("refuses a password at sign-up: it is chosen from the emailed link", () => {
    expect(
      PublicSignupRequestSchema.safeParse({
        email: "user@example.com",
        password: "password123",
        displayName: "Atlas User",
      }).success,
    ).toBe(false);
  });

  it("validates auth response envelope", () => {
    expect(
      PublicAuthResponseSchema.parse({
        data: {
          status: "AUTHENTICATED",
          redirectTo: "/admin",
        },
      }),
    ).toBeTruthy();
  });
});

describe("public auth ui helpers", () => {
  it("rejects tenantId in arbitrary bodies", () => {
    expect(() => rejectClientTenantId({ tenantId: "x" })).toThrow("Invalid request");
  });

  it("maps ACTIVE membership to authenticated redirect", () => {
    const status = resolvePublicAuthStatus({
      authenticated: true,
      verificationRequired: false,
      mfaEnabled: false,
      membershipStatus: "ACTIVE",
    });
    expect(status).toBe("AUTHENTICATED");
    expect(resolveRedirectForAuthStatus(status, "/admin")).toBe("/admin");
  });

  it("maps invited membership to invite acceptance", () => {
    const status = resolvePublicAuthStatus({
      authenticated: true,
      verificationRequired: false,
      mfaEnabled: false,
      membershipStatus: "INVITED",
    });
    expect(status).toBe("INVITED_MEMBERSHIP");
    expect(resolveRedirectForAuthStatus(status, null)).toBe("/invite/accept");
  });

  it("sends someone who hasn't agreed to the Terms to the join page (launch plan 5.7)", () => {
    for (const membershipStatus of [null, "ACTIVE"] as const) {
      const status = resolvePublicAuthStatus({
        authenticated: true,
        verificationRequired: false,
        mfaEnabled: false,
        membershipStatus,
        termsRequired: true,
      });
      expect(status).toBe("TERMS_REQUIRED");
      expect(resolveRedirectForAuthStatus(status, "/admin")).toBe("/join");
    }
  });

  it("asks for the second factor before the Terms, and leaves invitations to their page", () => {
    const base = { authenticated: true, verificationRequired: false, termsRequired: true };
    expect(resolvePublicAuthStatus({ ...base, mfaEnabled: true, membershipStatus: "ACTIVE" })).toBe(
      "MFA_REQUIRED",
    );
    expect(
      resolvePublicAuthStatus({ ...base, mfaEnabled: false, membershipStatus: "INVITED" }),
    ).toBe("INVITED_MEMBERSHIP");
    expect(
      resolvePublicAuthStatus({ ...base, mfaEnabled: false, membershipStatus: "SUSPENDED" }),
    ).toBe("NO_ACTIVE_MEMBERSHIP");
  });

  it("resolves role home by privilege", () => {
    expect(resolveRoleHomePath(["learner", "admin"])).toBe("/admin");
    expect(resolveRoleHomePath(["instructor"])).toBe("/studio");
    expect(resolveRoleHomePath(["moderator"])).toBe("/moderate");
    expect(resolveRoleHomePath(["learner"])).toBe("/");
  });

  it("routes privileged invite completions through MFA setup when needed", () => {
    expect(
      resolvePostInviteRedirect({
        roleHome: "/admin",
        mfaEnabled: false,
      }),
    ).toBe("/invite/security?next=%2Fadmin");

    expect(
      resolvePostInviteRedirect({
        roleHome: "/",
        mfaEnabled: false,
      }),
    ).toBe("/");
  });
});
