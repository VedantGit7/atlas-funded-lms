import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { projectAdminOwnerCapabilities } from "../../../apps/web/src/features/admin/admin-owner-projection";

const webRoot = resolve(import.meta.dirname, "../../../apps/web/src");

describe("admin owner capability projection", () => {
  it("defaults owner-only controls to hidden for non-owner actors", () => {
    const projection = projectAdminOwnerCapabilities({ actorHasOwnerRank: false });
    expect(projection.canManageOwnerMembership).toBe(false);
    expect(projection.canEditOwnerRole).toBe(false);
    expect(projection.canRunFullTenantExport).toBe(false);
    expect(projection.canProcessFullTenantDeletion).toBe(false);
  });

  it("does not use role-name conditionals in admin owner projection helper", () => {
    const source = readFileSync(
      resolve(webRoot, "features/admin/admin-owner-projection.ts"),
      "utf8",
    );
    expect(source).not.toMatch(/role\.name|membership\.role|"owner"/);
  });
});
