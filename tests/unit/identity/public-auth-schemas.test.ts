import { describe, expect, it } from "vitest";
import {
  PublicLoginRequestSchema,
  PublicSignupRequestSchema,
  PublicAuthResponseSchema,
  rejectClientTenantId,
  resolvePublicAuthStatus,
  resolveRoleHomePath,
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
        password: "password123",
        displayName: "Atlas User",
        inviteToken: "a".repeat(32),
      }).displayName,
    ).toBe("Atlas User");
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

  it("resolves role home by privilege", () => {
    expect(resolveRoleHomePath(["learner", "admin"])).toBe("/admin");
    expect(resolveRoleHomePath(["instructor"])).toBe("/studio");
    expect(resolveRoleHomePath(["moderator"])).toBe("/moderate");
    expect(resolveRoleHomePath(["learner"])).toBe("/");
  });
});
