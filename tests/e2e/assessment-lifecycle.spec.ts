import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const webRoot = resolve(import.meta.dirname, "../../frontend/apps/web/src");

const assessmentPaths = [
  "app/studio/assessments/page.tsx",
  "app/studio/assessments/[id]/page.tsx",
  "app/assessments/[id]/page.tsx",
  "app/attempts/[id]/page.tsx",
  "app/attempts/[id]/result/page.tsx",
  "features/assessments/components/assessment-builder.tsx",
  "features/assessments/components/assessment-overview.tsx",
  "features/assessments/components/attempt-runner.tsx",
  "features/assessments/components/attempt-result.tsx",
  "app/api/v1/assessments/route.ts",
  "app/api/v1/assessments/[id]/route.ts",
  "app/api/v1/assessments/[id]/publish/route.ts",
  "app/api/v1/assessments/[id]/attempts/route.ts",
  "app/api/v1/attempts/[id]/route.ts",
  "app/api/v1/attempts/[id]/answers/route.ts",
  "app/api/v1/attempts/[id]/submit/route.ts",
];

describe("assessment lifecycle e2e wiring", () => {
  it("includes approved assessment and attempt screens", () => {
    for (const relativePath of assessmentPaths) {
      expect(existsSync(resolve(webRoot, relativePath))).toBe(true);
    }
  });

  it("uses StudioShell nav entry for assessments", () => {
    const source = readFileSync(resolve(webRoot, "components/shells/StudioShell.tsx"), "utf8");
    expect(source).toContain("/studio/assessments");
  });

  it("labels publish action as submit for review", () => {
    const source = readFileSync(
      resolve(webRoot, "features/assessments/components/assessment-builder.tsx"),
      "utf8",
    );
    expect(source).toContain("Submit for review");
    expect(source).not.toMatch(/publishNow|autoApprove|bypassWorkflow/i);
  });

  it("does not send tenant_id from assessment builder", () => {
    const source = readFileSync(
      resolve(webRoot, "features/assessments/components/assessment-builder.tsx"),
      "utf8",
    );
    expect(source).toContain("/api/v1/assessments");
    expect(source).not.toMatch(/tenant_id|tenantId/);
  });

  it("handles denied states on studio assessments page", () => {
    const source = readFileSync(resolve(webRoot, "app/studio/assessments/page.tsx"), "utf8");
    expect(source).toContain("denied");
  });

  it("attempt runner does not reference answer keys in client code", () => {
    const source = readFileSync(
      resolve(webRoot, "features/assessments/components/attempt-runner.tsx"),
      "utf8",
    );
    expect(source).not.toContain("answerKeyJson");
    expect(source).not.toContain("isCorrect");
  });
});
