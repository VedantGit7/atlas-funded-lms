import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Audit finding H7 — platform operators in the database, not in env config.
 *
 * Cross-tenant access was an email string match against
 * `PLATFORM_OPERATOR_ASSIGNMENTS`. Granting or revoking the highest privilege in
 * the product required a deploy, and left no record of who granted it, when, or
 * why. Anyone who could set an environment variable could grant themselves
 * `super_admin` — a much lower bar than writing to the database.
 *
 * Grants are rows in `platform_operators` now, with revocation as a soft revoke
 * so the history survives. Verified live: grant resolves, revoke takes effect
 * immediately, the revoked row is retained, a re-grant does not collide, and
 * `atlas_app` can read the table but not write it.
 */

const MIGRATION = "backend/prisma/migrations/20260819130000_101_platform_operators/migration.sql";

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
}

describe("platform operators (H7)", () => {
  it("resolves from the database before consulting env config", () => {
    const source = stripComments(
      readFileSync("backend/packages/auth/src/platform-auth.ts", "utf8"),
    );

    const dbLookup = source.indexOf("findActivePlatformOperator");
    const envLookup = source.indexOf("PLATFORM_OPERATOR_ASSIGNMENTS");

    expect(dbLookup, "database lookup must exist").toBeGreaterThan(-1);
    expect(envLookup, "env break-glass must still exist").toBeGreaterThan(-1);
    // Order matters: if env were consulted first, a database revocation could be
    // silently overridden by stale deploy config.
    expect(dbLookup).toBeLessThan(envLookup);
  });

  it("logs loudly whenever the env break-glass path grants access", () => {
    const source = readFileSync("backend/packages/auth/src/platform-auth.ts", "utf8");

    expect(source).toContain("structuredLogger.warn");
    expect(source).toContain("platform.operator.break_glass");
  });

  it("keeps grant history instead of deleting revoked rows", () => {
    const migration = readFileSync(MIGRATION, "utf8");

    expect(migration).toContain("revoked_at");
    expect(migration).toContain("revoked_by_principal_id");
    expect(migration).toContain("grant_reason");
    // Re-granting must not collide with a principal's own revoked rows.
    expect(migration).toMatch(/UNIQUE INDEX[\s\S]*?WHERE revoked_at IS NULL/);
  });

  it("lets the tenant app role read the table but never write it", () => {
    const migration = readFileSync(MIGRATION, "utf8");

    // `requirePlatformPrincipal` runs inside `withGlobalDb` as atlas_app, so the
    // read is required; the write would be the escalation this table exists to
    // make auditable.
    expect(migration).toContain("GRANT SELECT ON platform_operators TO atlas_app");
    expect(migration).toMatch(/REVOKE INSERT, UPDATE, DELETE ON platform_operators FROM atlas_app/);
    // Revocation is a soft revoke, so nothing should be able to hard-delete.
    expect(migration).toContain("REVOKE DELETE ON platform_operators FROM atlas_platform");
  });

  it("constrains role keys at the schema level", () => {
    const migration = readFileSync(MIGRATION, "utf8");

    expect(migration).toContain("platform_operators_role_key_valid");
    for (const role of ["super_admin", "operations", "support"]) {
      expect(migration, role).toContain(`'${role}'`);
    }
  });
});
