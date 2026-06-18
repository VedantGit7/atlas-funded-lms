import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const webRoot = resolve(import.meta.dirname, "../../apps/web/src");

const adminMemberRolePaths = [
  "app/admin/page.tsx",
  "app/admin/members/page.tsx",
  "app/admin/members/[id]/page.tsx",
  "app/admin/roles/page.tsx",
  "app/admin/roles/[id]/page.tsx",
  "features/admin/members/MembersTable.tsx",
  "features/admin/members/InviteMemberDialog.tsx",
  "features/admin/members/MemberProfileEditor.tsx",
  "features/admin/members/MemberRoleEditor.tsx",
  "features/admin/members/PermissionOverridePanel.tsx",
  "features/admin/roles/RolesTable.tsx",
  "features/admin/roles/CreateRoleDialog.tsx",
  "features/admin/roles/RoleEditor.tsx",
  "app/api/v1/members/route.ts",
  "app/api/v1/members/invite/route.ts",
  "app/api/v1/members/[id]/route.ts",
  "app/api/v1/members/[id]/profile/route.ts",
  "app/api/v1/members/[id]/suspend/route.ts",
  "app/api/v1/members/[id]/roles/route.ts",
  "app/api/v1/roles/route.ts",
  "app/api/v1/roles/[id]/route.ts",
  "app/api/v1/permission-overrides/route.ts",
  "app/api/v1/permission-overrides/[id]/route.ts",
];

describe("admin member role management e2e wiring", () => {
  it("includes approved T1–T5 screens and API route files", () => {
    for (const relativePath of adminMemberRolePaths) {
      expect(existsSync(resolve(webRoot, relativePath))).toBe(true);
    }
  });

  it("does not hardcode tenant slug checks in admin member UI", () => {
    const membersPage = resolve(webRoot, "app/admin/members/page.tsx");
    const source = existsSync(membersPage) ? readFileSync(membersPage, "utf8") : "";

    expect(source.includes(".slug ===")).toBe(false);
  });
});
