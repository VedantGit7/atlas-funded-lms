import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { assertPlatformMfa, assertTenantMfa } from "@atlas/auth/mfa-enforcement";

// Factor enrollment must never stand in for current-session assurance (F01).
function session(sessionAssuranceLevel: "aal1" | "aal2" | null | undefined) {
  return { sessionAssuranceLevel, mfaEnabled: true, principalId: "p1" };
}

describe("platform MFA (H5)", () => {
  it.each(["aal1", null, undefined] as const)("rejects an enrolled operator at %s", (level) => {
    expect(() => assertPlatformMfa(session(level))).toThrowError(/multi-factor/i);
  });

  it("allows a verified AAL2 session", () => {
    expect(() => assertPlatformMfa(session("aal2"))).not.toThrow();
  });

  it("raises MFA_REQUIRED, distinct from PERMISSION_DENIED", () => {
    // The client must complete a challenge for this session.
    try {
      assertPlatformMfa(session("aal1"));
      throw new Error("should have thrown");
    } catch (error) {
      expect((error as { code?: string }).code).toBe("MFA_REQUIRED");
      expect((error as { status?: number }).status).toBe(403);
    }
  });

  it("is enforced after the permission check, not before", () => {
    // Enforcing first would tell a non-operator that the account *would* be
    // allowed, confirming platform membership to anyone who can reach the route.
    const source = readFileSync("backend/packages/auth/src/platform-auth.ts", "utf8");
    const denyIdx = source.indexOf('code: "PERMISSION_DENIED"');
    const mfaIdx = source.indexOf("assertPlatformMfa(");

    expect(denyIdx).toBeGreaterThan(-1);
    expect(mfaIdx).toBeGreaterThan(-1);
    expect(mfaIdx).toBeGreaterThan(denyIdx);
  });
});

describe("tenant MFA (H5)", () => {
  it("only applies when the route declares it", () => {
    expect(() =>
      assertTenantMfa({ ...session(null), required: false, permission: "course.read" }),
    ).not.toThrow();

    expect(() =>
      assertTenantMfa({ ...session("aal1"), required: true, permission: "role.delete" }),
    ).toThrowError(/multi-factor/i);

    expect(() =>
      assertTenantMfa({ ...session("aal2"), required: true, permission: "role.delete" }),
    ).not.toThrow();
  });

  it.each([null, undefined] as const)("denies required MFA when assurance is %s", (level) => {
    expect(() =>
      assertTenantMfa({ ...session(level), required: true, permission: "role.delete" }),
    ).toThrowError(/multi-factor/i);
  });

  it("covers the categories the audit named", () => {
    const declaring = [
      ["tenant-admin destructive", "backend/apps/api/src/app/api/v1/roles/[id]/route.metadata.ts"],
      [
        "role revocation",
        "backend/apps/api/src/app/api/v1/members/[id]/roles/[roleId]/route.metadata.ts",
      ],
      [
        "membership suspension",
        "backend/apps/api/src/app/api/v1/members/[id]/suspend/route.metadata.ts",
      ],
      ["data export", "backend/packages/domain/src/data-rights/data-rights.route-metadata.ts"],
      ["refunds", "backend/packages/domain/src/reports/payments-roster.route-metadata.ts"],
    ] as const;

    for (const [label, file] of declaring) {
      expect(readFileSync(file, "utf8"), label).toContain('mfa: "required"');
    }
  });

  it("is wired into the tenant route pipeline", () => {
    const pipeline = readFileSync("backend/packages/api/src/create-tenant-route.ts", "utf8");

    expect(pipeline).toContain("assertTenantMfa");
    // The flag must reach the pipeline from the session, or every route would
    // read as "no MFA" and the requirement would deny universally.
    expect(pipeline).toContain("sessionAssuranceLevel: supabaseUser.sessionAssuranceLevel");
  });
});
