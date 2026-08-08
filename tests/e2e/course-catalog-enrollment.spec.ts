import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const webRoot = resolve(import.meta.dirname, "../../frontend/apps/web/src");

const coursePaths = [
  "app/courses/layout.tsx",
  "app/courses/page.tsx",
  "app/courses/[id]/page.tsx",
  "components/shells/LearnerShell.tsx",
  "components/patterns/PageGate.tsx",
  "features/courses/course-catalog.tsx",
  "features/courses/course-card.tsx",
  "features/courses/course-filters.tsx",
  "features/courses/course-detail.tsx",
  "features/courses/course-outline.tsx",
  "features/courses/enroll-course-dialog.tsx",
  "features/courses/enrollment-status-badge.tsx",
  "app/api/v1/courses/route.ts",
  "app/api/v1/courses/[id]/route.ts",
  "app/api/v1/courses/[id]/modules/route.ts",
  "app/api/v1/enrollments/route.ts",
];

describe("course catalog enrollment e2e wiring", () => {
  it("includes approved learner course screen and API files", () => {
    for (const relativePath of coursePaths) {
      expect(existsSync(resolve(webRoot, relativePath))).toBe(true);
    }
  });

  it("uses LearnerShell for course pages", () => {
    const source = readFileSync(resolve(webRoot, "app/courses/layout.tsx"), "utf8");
    expect(source).toContain("LearnerShell");
  });

  it("does not accept client tenant_id in enrollment dialog", () => {
    const source = readFileSync(
      resolve(webRoot, "features/courses/enroll-course-dialog.tsx"),
      "utf8",
    );
    expect(source).toContain("courseId");
    expect(source).not.toMatch(/tenant_id|tenantId/);
  });

  it("shows enrolled state on course detail", () => {
    const source = readFileSync(resolve(webRoot, "features/courses/course-detail.tsx"), "utf8");
    expect(source).toContain("EnrollCourseDialog");
    expect(source).toContain("enrollmentStatus");
  });

  it("handles safe denied state for course detail", () => {
    const source = readFileSync(resolve(webRoot, "app/courses/[id]/page.tsx"), "utf8");
    expect(source).toContain("not_found");
    expect(source).toContain("Course not found or access denied");
  });
});
