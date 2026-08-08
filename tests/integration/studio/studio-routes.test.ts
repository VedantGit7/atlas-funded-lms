import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  STUDIO_ROUTE_REGISTRY,
  type StudioScreenId,
} from "../../../frontend/apps/web/src/features/studio/studio-route-registry";

const webRoot = resolve(import.meta.dirname, "../../../frontend/apps/web/src");

const pageByScreen: Record<StudioScreenId, string> = {
  I1: "app/studio/page.tsx",
  I2: "app/studio/courses/page.tsx",
  I3: "app/studio/courses/[id]/page.tsx",
  I4: "app/studio/courses/[id]/lessons/[lessonId]/page.tsx",
  I5: "app/studio/items/page.tsx",
  I6: "app/studio/items/[id]/page.tsx",
  I7: "app/studio/item-collections/page.tsx",
  I8: "app/studio/assessments/page.tsx",
  I9: "app/studio/learning-paths/page.tsx",
  I10: "app/studio/grading/page.tsx",
  I11: "app/studio/grading/[taskId]/page.tsx",
  I12: "app/studio/courses/[id]/learners/page.tsx",
  I13: "app/studio/analytics/page.tsx",
};

describe("studio route integration wiring", () => {
  it("maps every approved screenId to a page module", () => {
    for (const route of STUDIO_ROUTE_REGISTRY) {
      const pagePath = pageByScreen[route.screenId];
      expect(existsSync(resolve(webRoot, pagePath))).toBe(true);
    }
  });

  it("lazy-loads heavy studio builders", () => {
    expect(
      readFileSync(resolve(webRoot, "app/studio/courses/[id]/editor/page.tsx"), "utf8"),
    ).toContain("CourseEditorLazy");
    expect(
      readFileSync(resolve(webRoot, "app/studio/courses/[id]/dashboard/page.tsx"), "utf8"),
    ).toContain("CourseDashboard");
    expect(
      readFileSync(resolve(webRoot, "app/studio/assessments/[id]/page.tsx"), "utf8"),
    ).toContain("AssessmentBuilderLazy");
    expect(
      readFileSync(resolve(webRoot, "app/studio/courses/[id]/lessons/[lessonId]/page.tsx"), "utf8"),
    ).toContain("LessonEditorLazy");
    expect(
      readFileSync(resolve(webRoot, "app/studio/learning-paths/[id]/page.tsx"), "utf8"),
    ).toContain("LearningPathBuilderLazy");
  });

  it("does not import prisma or repositories in studio app pages", () => {
    for (const relativePath of Object.values(pageByScreen)) {
      const source = readFileSync(resolve(webRoot, relativePath), "utf8");
      expect(source).not.toMatch(
        /from.*prisma|from.*repository|withTenantTx|withPlatformScope|new PrismaClient/,
      );
    }
  });

  it("maps detail routes for assessment and learning path builders", () => {
    const i8 = STUDIO_ROUTE_REGISTRY.find((entry) => entry.screenId === "I8");
    const i9 = STUDIO_ROUTE_REGISTRY.find((entry) => entry.screenId === "I9");
    expect(i8?.detailPathPattern).toBe("/studio/assessments/:id");
    expect(i9?.detailPathPattern).toBe("/studio/learning-paths/:id");
    expect(existsSync(resolve(webRoot, "app/studio/assessments/[id]/page.tsx"))).toBe(true);
    expect(existsSync(resolve(webRoot, "app/studio/learning-paths/[id]/page.tsx"))).toBe(true);
    expect(existsSync(resolve(webRoot, "app/studio/assessments/[id]/error.tsx"))).toBe(true);
    expect(existsSync(resolve(webRoot, "app/studio/learning-paths/[id]/error.tsx"))).toBe(true);
  });

  it("review queue supports multi-target workflows", () => {
    const source = readFileSync(
      resolve(webRoot, "features/workflows/review-approvals-client.tsx"),
      "utf8",
    );
    expect(source).toContain('targetFilter === "all"');
    expect(source).not.toContain('targetType: "course"');
  });
});
