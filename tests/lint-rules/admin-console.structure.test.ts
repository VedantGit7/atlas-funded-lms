import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const webRoot = resolve(import.meta.dirname, "../../frontend/apps/web/src");

describe("admin console e2e wiring", () => {
  it("includes all T1-T24 page files", () => {
    const pages = [
      "app/admin/page.tsx",
      "app/admin/members/page.tsx",
      "app/admin/members/[id]/page.tsx",
      "app/admin/roles/page.tsx",
      "app/admin/roles/[id]/page.tsx",
      "app/admin/branding/page.tsx",
      "app/admin/domains/page.tsx",
      "app/admin/config/page.tsx",
      "app/admin/feature-flags/page.tsx",
      "app/admin/entitlements/page.tsx",
      "app/admin/competency/page.tsx",
      "app/admin/certificates/templates/page.tsx",
      "app/admin/certificates/page.tsx",
      "app/admin/gamification/page.tsx",
      "app/admin/notifications/page.tsx",
      "app/admin/notifications/templates/page.tsx",
      "app/admin/automation/page.tsx",
      "app/admin/workflows/page.tsx",
      "app/admin/locales/page.tsx",
      "app/admin/extensions/page.tsx",
      "app/admin/readiness-policy/page.tsx",
      "app/admin/analytics/page.tsx",
      "app/admin/audit/page.tsx",
      "app/admin/exports/page.tsx",
      "app/admin/deletion-requests/page.tsx",
      "app/admin/review/page.tsx",
      "app/admin/moderation/cases/page.tsx",
      "app/admin/moderation/cases/[id]/page.tsx",
      "app/admin/moderation/appeals/page.tsx",
    ];

    for (const page of pages) {
      expect(existsSync(resolve(webRoot, page))).toBe(true);
    }
  });

  it("admin dashboard links reuse studio, moderation, and review routes", () => {
    const source = readFileSync(resolve(webRoot, "app/admin/page.tsx"), "utf8");
    expect(source).toContain('href="/studio/courses"');
    expect(source).toContain("ADMIN_MODERATION_CASES_PATH");
    expect(source).toContain('href="/admin/review"');
    expect(source).not.toMatch(/\/admin\/courses/);
  });

  it("tenant admin shell exposes mobile navigation affordances", () => {
    // TenantAdminShellClient is a thin wrapper over the shared AdminShell now,
    // which owns the drawer. Asserting the old inline ids against the wrapper
    // reported a missing affordance that had simply moved one level down.
    const wrapper = readFileSync(
      resolve(webRoot, "components/shells/TenantAdminShellClient.tsx"),
      "utf8",
    );
    expect(wrapper).toContain("AdminShell");

    const source = readFileSync(resolve(webRoot, "components/shells/admin/AdminShell.tsx"), "utf8");
    expect(source).toContain('aria-label="Admin sections"');
    expect(source).toContain('aria-label="Open navigation"');
    expect(source).toContain('aria-label="Close navigation"');
  });

  it("dashboard includes active learner and content status summaries", () => {
    const source = readFileSync(resolve(webRoot, "app/admin/page.tsx"), "utf8");
    // "Content status" and "Recent audit activity" were section headings that
    // the dashboard renamed to "Studio content" and "Recent tenant audit
    // events". The summaries are still there; only the copy moved, which is not
    // a regression worth failing a build over.
    expect(source).toContain("Active learners");
    expect(source).toContain("Studio content");
    expect(source).toContain("Recent tenant audit events");
  });
});
