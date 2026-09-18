import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { assertPlatformMfa, assertTenantMfa } from "@atlas/auth/mfa-enforcement";

/**
 * Audit finding H5 — MFA enforcement.
 *
 * `mfa_enabled` was computed on every sign-in, stored on the principal, and
 * never checked anywhere. The platform console — the one surface with
 * cross-tenant reach — was reachable with a password alone.
 *
 * On why enforcing on this value is meaningful rather than theatre: Supabase's
 * `listFactors()` types `data.totp` and `data.phone` as `Factor<K, "verified">[]`
 * and keeps unverified factors in `data.all`, so presence in those arrays *is*
 * verification. An earlier note claimed the predicate could not distinguish
 * pending from verified factors; that was inferred from a lint message rather
 * than the SDK types, and is wrong.
 */

describe("platform MFA (H5)", () => {
  it("rejects a platform operator without a verified factor", () => {
    expect(() => assertPlatformMfa({ mfaEnabled: false, principalId: "p1" })).toThrowError(
      /multi-factor/i,
    );
  });

  it("allows one with a verified factor", () => {
    expect(() => assertPlatformMfa({ mfaEnabled: true, principalId: "p1" })).not.toThrow();
  });

  it("raises MFA_REQUIRED, distinct from PERMISSION_DENIED", () => {
    // The caller has the permission and lacks a factor, so the client can offer
    // enrolment rather than a dead-end denial.
    try {
      assertPlatformMfa({ mfaEnabled: false, principalId: "p1" });
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
      assertTenantMfa({ mfaEnabled: false, required: false, permission: "course.read" }),
    ).not.toThrow();

    expect(() =>
      assertTenantMfa({ mfaEnabled: false, required: true, permission: "role.delete" }),
    ).toThrowError(/multi-factor/i);

    expect(() =>
      assertTenantMfa({ mfaEnabled: true, required: true, permission: "role.delete" }),
    ).not.toThrow();
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
    expect(pipeline).toContain("mfaEnabled: supabaseUser.mfaEnabled");
  });
});
