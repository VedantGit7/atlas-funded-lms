import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { resolveSplitPath, splitPathExists } from "./split-layout-paths";

const learningPathPaths = [
  "app/roadmap/page.tsx",
  "app/paths/[id]/page.tsx",
  "app/studio/learning-paths/page.tsx",
  "app/studio/learning-paths/[id]/page.tsx",
  "features/learning-paths/components/RoadmapTimeline.tsx",
  "features/learning-paths/components/PathStepList.tsx",
  "features/learning-paths/components/LearningPathBuilder.tsx",
  "app/api/v1/learning-paths/route.ts",
  "app/api/v1/learning-paths/[id]/route.ts",
  "app/api/v1/learning-paths/[id]/publish/route.ts",
  "app/api/v1/learning-paths/[id]/enroll/route.ts",
  "app/api/v1/learning-paths/[id]/progress/route.ts",
];

describe("learning path lifecycle e2e wiring", () => {
  it("includes approved learner and studio screens plus APIs", () => {
    for (const relativePath of learningPathPaths) {
      expect(splitPathExists(relativePath)).toBe(true);
    }
  });

  it("uses learner roadmap navigation entry", () => {
    const source = readFileSync(resolveSplitPath("components/shells/LearnerShell.tsx"), "utf8");
    expect(source).toContain("/roadmap");
  });

  it("uses studio learning path navigation entry", () => {
    const source = readFileSync(resolveSplitPath("components/shells/StudioShell.tsx"), "utf8");
    expect(source).toContain("/studio/learning-paths");
  });

  it("roadmap page handles denied state", () => {
    const source = readFileSync(resolveSplitPath("app/roadmap/page.tsx"), "utf8");
    expect(source).toContain("denied");
  });

  it("path detail uses server-provided lock state", () => {
    const source = readFileSync(
      resolveSplitPath("features/learning-paths/components/PathStepList.tsx"),
      "utf8",
    );
    expect(source).toContain("locked");
  });

  it("does not expose client tenant identifiers in path builder", () => {
    const source = readFileSync(
      resolveSplitPath("features/learning-paths/components/StudioLearningPathDetailClient.tsx"),
      "utf8",
    );
    expect(source).not.toMatch(/tenant_id|tenantId/);
  });
});
