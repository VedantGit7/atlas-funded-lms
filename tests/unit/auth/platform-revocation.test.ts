import { afterEach, describe, expect, it, vi } from "vitest";
import { loadPlatformPermissions } from "@atlas/auth/platform-auth";

const email = "operator@example.com";
const grant = {
  id: "grant-1",
  auth_principal_id: "principal-1",
  role_key: "super_admin",
  granted_at: new Date(),
  granted_by_principal_id: "grantor-1",
  grant_reason: "Approved access",
};

function database(initial: typeof grant | null) {
  const state = { activeGrant: initial };
  const db = {
    $queryRaw: vi.fn(async (sql: TemplateStringsArray) => {
      if (sql.join("").includes("FROM platform_operators"))
        return state.activeGrant ? [state.activeGrant] : [];
      return [{ email_normalized: email }];
    }),
  };
  return { state, db };
}

afterEach(() => vi.unstubAllEnvs());

describe("authoritative platform grants (F02)", () => {
  it("does not grant an environment-listed account with no active database grant", async () => {
    vi.stubEnv("PLATFORM_OPERATOR_ASSIGNMENTS", `${email}=super_admin`);
    const { db } = database(null);
    await expect(loadPlatformPermissions(db, "principal-1")).resolves.toEqual([]);
    expect(db.$queryRaw).toHaveBeenCalledOnce();
  });

  it("observes revocation on the next lookup while stale environment configuration remains", async () => {
    vi.stubEnv("PLATFORM_OPERATOR_ASSIGNMENTS", `${email}=super_admin`);
    const { state, db } = database(grant);
    await expect(loadPlatformPermissions(db, "principal-1")).resolves.toContain(
      "platform.tenant.manage",
    );
    state.activeGrant = null;
    await expect(loadPlatformPermissions(db, "principal-1")).resolves.toEqual([]);
  });

  it("honors a database role downgrade despite a higher environment assignment", async () => {
    vi.stubEnv("PLATFORM_OPERATOR_ASSIGNMENTS", `${email}=super_admin`);
    const { db } = database({ ...grant, role_key: "support" });
    const permissions = await loadPlatformPermissions(db, "principal-1");
    expect(permissions).toContain("platform.tenant.read");
    expect(permissions).not.toContain("platform.tenant.manage");
  });

  it("allows an explicit new database grant after revocation", async () => {
    const { state, db } = database(null);
    await expect(loadPlatformPermissions(db, "principal-1")).resolves.toEqual([]);
    state.activeGrant = { ...grant, id: "grant-2" };
    await expect(loadPlatformPermissions(db, "principal-1")).resolves.toContain(
      "platform.tenant.manage",
    );
  });

  it("does not fall back to configuration when the database fails", async () => {
    vi.stubEnv("PLATFORM_OPERATOR_ASSIGNMENTS", `${email}=super_admin`);
    const db = { $queryRaw: vi.fn().mockRejectedValue(new Error("database unavailable")) };
    await expect(loadPlatformPermissions(db, "principal-1")).rejects.toThrow(
      "database unavailable",
    );
  });
});
