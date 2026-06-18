import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const webRoot = resolve(import.meta.dirname, "../../apps/web/src");

const studioPaths = [
  "app/studio/layout.tsx",
  "app/studio/courses/page.tsx",
  "app/studio/courses/[id]/page.tsx",
  "components/shells/StudioShell.tsx",
  "features/studio/courses/course-manager.tsx",
  "features/studio/courses/course-table.tsx",
  "features/studio/courses/create-course-dialog.tsx",
  "features/studio/courses/course-builder.tsx",
  "features/studio/courses/course-settings-form.tsx",
  "features/studio/courses/course-module-tree.tsx",
  "features/studio/courses/builder-validation-panel.tsx",
  "features/studio/courses/course-status-badge.tsx",
  "app/api/v1/courses/route.ts",
  "app/api/v1/courses/[id]/route.ts",
  "app/api/v1/courses/[id]/modules/route.ts",
  "app/api/v1/courses/[id]/publish/route.ts",
  "app/api/v1/modules/[id]/route.ts",
];

describe("course manager builder e2e wiring", () => {
  it("includes approved studio course screen and API files", () => {
    for (const relativePath of studioPaths) {
      expect(existsSync(resolve(webRoot, relativePath))).toBe(true);
    }
  });

  it("uses StudioShell for studio pages", () => {
    const source = readFileSync(resolve(webRoot, "app/studio/layout.tsx"), "utf8");
    expect(source).toContain("StudioShell");
  });

  it("does not send tenant_id from create course dialog", () => {
    const source = readFileSync(
      resolve(webRoot, "features/studio/courses/create-course-dialog.tsx"),
      "utf8",
    );
    expect(source).toContain("/api/v1/courses");
    expect(source).not.toMatch(/tenant_id|tenantId/);
  });

  it("submits course for review from builder", () => {
    const source = readFileSync(
      resolve(webRoot, "features/studio/courses/course-builder.tsx"),
      "utf8",
    );
    expect(source).toContain("/publish");
    expect(source).toContain("Submit for review");
  });

  it("handles denied/not-found states on studio pages", () => {
    const manager = readFileSync(resolve(webRoot, "app/studio/courses/page.tsx"), "utf8");
    const builder = readFileSync(resolve(webRoot, "app/studio/courses/[id]/page.tsx"), "utf8");
    expect(manager).toContain("denied");
    expect(builder).toContain("not_found");
  });
});
