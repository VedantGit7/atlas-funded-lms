import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { resolveSplitPath, splitPathExists } from "./split-layout-paths";

const gradingPaths = [
  "app/studio/grading/page.tsx",
  "app/studio/grading/[taskId]/page.tsx",
  "features/grading/api.ts",
  "features/grading/grading-queue-client.tsx",
  "features/grading/components/grading-queue-table.tsx",
  "features/grading/components/grading-detail-panel.tsx",
  "app/api/v1/grading-tasks/route.ts",
  "app/api/v1/grading-tasks/[id]/route.ts",
  "app/api/v1/grading-tasks/[id]/grade/route.ts",
];

describe("grading lifecycle e2e wiring", () => {
  it("includes approved grading screens and APIs", () => {
    for (const relativePath of gradingPaths) {
      expect(splitPathExists(relativePath)).toBe(true);
    }
  });

  it("uses StudioShell nav entry for grading", () => {
    const source = readFileSync(resolveSplitPath("components/shells/StudioShell.tsx"), "utf8");
    expect(source).toContain("/studio/grading");
  });

  it("handles denied states on grading queue page", () => {
    const source = readFileSync(resolveSplitPath("app/studio/grading/page.tsx"), "utf8");
    expect(source).toContain("denied");
  });

  it("grading detail uses idempotent grade submission", () => {
    const source = readFileSync(
      resolveSplitPath("features/grading/components/grading-detail-panel.tsx"),
      "utf8",
    );
    expect(source).toContain("gradeGradingTask");
    expect(source).not.toMatch(/tenant_id|tenantId/);
  });

  it("grading queue links to detail route", () => {
    const source = readFileSync(
      resolveSplitPath("features/grading/components/grading-queue-table.tsx"),
      "utf8",
    );
    expect(source).toContain("/studio/grading/");
  });
});
