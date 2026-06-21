import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const webRoot = resolve(import.meta.dirname, "../../../apps/web/src");

describe("studio publish copy semantics", () => {
  it("uses submit-for-review labels in studio builders", () => {
    const courseBuilder = readFileSync(
      resolve(webRoot, "features/studio/courses/builder-validation-panel.tsx"),
      "utf8",
    );
    const assessmentBuilder = readFileSync(
      resolve(webRoot, "features/assessments/components/assessment-builder.tsx"),
      "utf8",
    );

    expect(courseBuilder).toContain("Submit for review");
    expect(assessmentBuilder).toContain("Submit for review");
    expect(courseBuilder.toLowerCase()).not.toContain("publish now");
    expect(assessmentBuilder.toLowerCase()).not.toContain("force publish");
  });
});

describe("studio analytics chart fallback", () => {
  it("renders table fallback for dashboard metrics", () => {
    const source = readFileSync(
      resolve(webRoot, "features/analytics/components/analytics-dashboard.tsx"),
      "utf8",
    );
    expect(source).toContain("AnalyticsTrendTable");
    expect(source).toContain("ItemStatisticsTable");
  });
});

describe("studio error mapping", () => {
  it("preserves request IDs in learner roster errors", () => {
    const source = readFileSync(resolve(webRoot, "features/studio/learners/api.ts"), "utf8");
    expect(source).toContain("Request ID");
    expect(source).not.toContain("stack");
  });
});
