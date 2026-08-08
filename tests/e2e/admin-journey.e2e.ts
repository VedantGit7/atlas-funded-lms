import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const webRoot = resolve(import.meta.dirname, "../../frontend/apps/web/src");

const adminJourneyPaths = [
  "app/(auth)/login/page.tsx",
  "app/(auth)/login/_components/LoginForm.tsx",
  "app/admin/page.tsx",
  "app/admin/members/page.tsx",
  "features/admin/members/InviteMemberDialog.tsx",
  "app/admin/roles/page.tsx",
  "app/admin/roles/[id]/page.tsx",
  "features/admin/roles/RoleEditor.tsx",
  "components/patterns/ConfirmDialog.tsx",
];

describe("admin journey e2e wiring", () => {
  it("includes login → dashboard → invite → role edit path files", () => {
    for (const relativePath of adminJourneyPaths) {
      expect(existsSync(resolve(webRoot, relativePath))).toBe(true);
    }
  });

  it("dashboard links into member and role management surfaces", () => {
    const dashboard = readFileSync(resolve(webRoot, "app/admin/page.tsx"), "utf8");
    const membersPage = readFileSync(resolve(webRoot, "app/admin/members/page.tsx"), "utf8");
    const rolesPage = readFileSync(resolve(webRoot, "app/admin/roles/page.tsx"), "utf8");

    expect(dashboard).toContain('href="/admin/members"');
    expect(dashboard).toContain('href="/admin/roles"');
    expect(membersPage).toContain("InviteMemberDialog");
    expect(rolesPage).toContain("RolesTable");
  });

  it("role edit flow uses ConfirmDialog for destructive actions", () => {
    const roleEditor = readFileSync(resolve(webRoot, "features/admin/roles/RoleEditor.tsx"), "utf8");
    const rolesTable = readFileSync(resolve(webRoot, "features/admin/roles/RolesTable.tsx"), "utf8");

    expect(roleEditor).toContain("ConfirmDialog");
    expect(rolesTable).toContain("ConfirmDialog");
    expect(rolesTable).not.toContain("window.confirm");
  });
});
