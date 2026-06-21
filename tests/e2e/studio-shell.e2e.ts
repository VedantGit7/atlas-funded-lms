import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const webRoot = resolve(import.meta.dirname, "../../apps/web/src");

describe("ATL-STORY-039 studio shell e2e wiring", () => {
  it("includes studio shell gate and route registry", () => {
    expect(existsSync(resolve(webRoot, "components/shells/StudioShellGate.tsx"))).toBe(true);
    expect(existsSync(resolve(webRoot, "features/studio/studio-route-registry.ts"))).toBe(true);
    expect(existsSync(resolve(webRoot, "features/studio/studio-navigation.ts"))).toBe(true);
  });

  it("studio layout delegates to gated shell", () => {
    const source = readFileSync(resolve(webRoot, "app/studio/layout.tsx"), "utf8");
    expect(source).toContain("StudioShell");
    expect(readFileSync(resolve(webRoot, "components/shells/StudioShell.tsx"), "utf8")).toContain(
      "StudioShellGate",
    );
  });

  it("studio shell exposes accessible mobile navigation", () => {
    const source = readFileSync(
      resolve(webRoot, "components/shells/StudioShellClient.tsx"),
      "utf8",
    );
    expect(source).toContain('aria-label="Mobile studio navigation"');
    expect(source).toContain('aria-controls="studio-mobile-nav"');
  });

  it("I1 dashboard composes courses grading and workflows", () => {
    const source = readFileSync(resolve(webRoot, "app/studio/page.tsx"), "utf8");
    expect(source).toContain("/api/v1/courses?view=studio");
    expect(source).toContain("/api/v1/grading-tasks");
    expect(source).toContain("/api/v1/workflows");
  });

  it("covers instructor studio journey route files", () => {
    const journeyPaths = [
      "app/studio/page.tsx",
      "app/studio/courses/page.tsx",
      "app/studio/courses/[id]/page.tsx",
      "app/studio/courses/[id]/lessons/[lessonId]/page.tsx",
      "app/studio/items/page.tsx",
      "app/studio/items/[id]/page.tsx",
      "app/studio/item-collections/page.tsx",
      "app/studio/assessments/page.tsx",
      "app/studio/assessments/[id]/page.tsx",
      "app/studio/learning-paths/page.tsx",
      "app/studio/learning-paths/[id]/page.tsx",
      "app/studio/grading/page.tsx",
      "app/studio/grading/[taskId]/page.tsx",
      "app/studio/courses/[id]/learners/page.tsx",
      "app/studio/analytics/page.tsx",
    ];

    for (const relativePath of journeyPaths) {
      expect(existsSync(resolve(webRoot, relativePath))).toBe(true);
    }
  });

  it("I12 roster uses approved enrollment and progress APIs only", () => {
    const source = readFileSync(resolve(webRoot, "features/studio/learners/api.ts"), "utf8");
    expect(source).toContain("/api/v1/enrollments?courseId=");
    expect(source).toContain("/api/v1/courses/");
    expect(source).toContain("/progress");
    expect(source).not.toMatch(/tenant_id|tenantId/);
    expect(source).not.toMatch(/prisma|repository/);
  });

  it("review handoff links to existing S1 route", () => {
    const nav = readFileSync(resolve(webRoot, "features/studio/studio-navigation.ts"), "utf8");
    expect(nav).toContain('"/review"');
    expect(nav).not.toContain("/review/approvals");
  });
});
