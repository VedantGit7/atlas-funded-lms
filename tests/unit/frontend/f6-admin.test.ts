import { readFileSync } from "node:fs";

import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { memberHasOwnerRole } from "../../../frontend/apps/web/src/features/admin/members/member-owner-guard";

const webRoot = resolve(import.meta.dirname, "../../../frontend/apps/web/src");

describe("F6 tenant admin", () => {
  it("detects owner membership from role keys", () => {
    expect(memberHasOwnerRole([{ key: "admin" }])).toBe(false);

    expect(memberHasOwnerRole([{ key: "owner" }])).toBe(true);

    expect(memberHasOwnerRole(undefined)).toBe(false);
  });

  it("role editor groups permissions and surfaces grant-up guidance", () => {
    const roleEditor = readFileSync(
      resolve(webRoot, "features/admin/roles/RoleEditor.tsx"),

      "utf8",
    );

    expect(roleEditor).toContain("groupedPermissions");

    expect(roleEditor).toContain("no-grant-up");

    expect(roleEditor).toContain("ConfirmDialog");
  });

  it("audit viewer supports action filter and cursor pagination", () => {
    const auditViewer = readFileSync(
      resolve(webRoot, "features/admin/audit/AuditLogViewer.tsx"),

      "utf8",
    );

    expect(auditViewer).toContain("actionFilter");

    expect(auditViewer).toContain("loadMore");

    expect(auditViewer).toContain("VirtualizedTable");
  });

  it("branding editor wires signed logo upload and publish confirm modal", () => {
    const brandingEditor = readFileSync(
      resolve(webRoot, "app/admin/branding/_components/BrandingEditor.tsx"),

      "utf8",
    );

    expect(brandingEditor).toContain("/api/v1/branding/assets/upload");

    expect(brandingEditor).toContain("ConfirmDialog");
  });

  it("extensions admin supports registration PUT without full-page reload", () => {
    const extensionsAdmin = readFileSync(
      resolve(webRoot, "features/extensions/components/extensions-admin.tsx"),

      "utf8",
    );

    expect(extensionsAdmin).toContain("updateExtensionRegistration");

    expect(extensionsAdmin).not.toContain("window.location.reload");
  });

  it("analytics dashboard exposes tabs and CSV export", () => {
    const analytics = readFileSync(
      resolve(webRoot, "features/analytics/components/analytics-admin-view.tsx"),

      "utf8",
    );

    expect(analytics).toContain('role="tablist"');

    expect(analytics).toContain("Export CSV");

    expect(analytics).toContain("community");
  });

  it("admin destructive actions use ConfirmDialog instead of window.confirm", () => {
    const adminSources = [
      "features/admin/roles/RolesTable.tsx",

      "app/admin/domains/_components/DomainStatusPanel.tsx",

      "features/admin/feature-flags/FeatureFlagsAdmin.tsx",
    ];

    for (const relativePath of adminSources) {
      const source = readFileSync(resolve(webRoot, relativePath), "utf8");

      const usesConfirmDialog =
        source.includes("ConfirmDialog") || source.includes("AdminConfirmDialog");

      expect(usesConfirmDialog).toBe(true);

      expect(source).not.toContain("window.confirm");
    }
  });

  it("tenant config page loads published version history", () => {
    const configPage = readFileSync(resolve(webRoot, "app/admin/config/page.tsx"), "utf8");

    expect(configPage).toContain("/api/v1/config/versions");

    expect(configPage).toContain("TenantConfigVersionHistory");
  });

  it("admin dashboard surfaces learner, content, and audit summaries", () => {
    const dashboard = readFileSync(resolve(webRoot, "app/admin/page.tsx"), "utf8");

    expect(dashboard).toContain("/api/v1/members?status=ACTIVE");

    expect(dashboard).toContain("/api/v1/courses?view=studio");

    expect(dashboard).toContain("/api/v1/audit?limit=6");

    expect(dashboard).toContain("Latest tenant audit trail");
  });
});
