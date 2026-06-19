import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const webRoot = resolve(import.meta.dirname, "../../apps/web/src");

const reviewPaths = [
  "app/review/page.tsx",
  "app/review/layout.tsx",
  "app/review/loading.tsx",
  "app/review/error.tsx",
  "components/shells/ReviewShell.tsx",
  "features/workflows/review-approvals-client.tsx",
  "features/workflows/api.ts",
  "features/workflows/components/review-queue.tsx",
  "features/workflows/components/review-detail-panel.tsx",
  "features/workflows/components/workflow-history-panel.tsx",
  "features/workflows/components/workflow-decision-controls.tsx",
  "app/api/v1/workflows/route.ts",
  "app/api/v1/workflows/[id]/transition/route.ts",
];

describe("review approvals e2e wiring", () => {
  it("includes approved S1 review screen and workflow API files", () => {
    for (const relativePath of reviewPaths) {
      expect(existsSync(resolve(webRoot, relativePath))).toBe(true);
    }
  });

  it("uses ReviewShell for review pages", () => {
    const source = readFileSync(resolve(webRoot, "app/review/layout.tsx"), "utf8");
    expect(source).toContain("ReviewShell");
  });

  it("gates review page before rendering queue UI", () => {
    const source = readFileSync(resolve(webRoot, "app/review/page.tsx"), "utf8");
    expect(source).toContain("PageGate");
    expect(source).toContain("/api/v1/workflows");
    expect(source).toContain("denied");
  });

  it("submits for review from course builder instead of direct publish", () => {
    const source = readFileSync(
      resolve(webRoot, "features/studio/courses/course-builder.tsx"),
      "utf8",
    );
    expect(source).toContain("Submit for review");
    expect(source).toContain("/publish");
  });

  it("calls workflow transition API from decision controls", () => {
    const source = readFileSync(
      resolve(webRoot, "features/workflows/components/workflow-decision-controls.tsx"),
      "utf8",
    );
    expect(source).toContain("Approve and publish");
    expect(source).toContain("transitionWorkflow");
    expect(source).not.toMatch(/tenant_id|tenantId/);
  });

  it("requires comment for reject/return actions", () => {
    const source = readFileSync(
      resolve(webRoot, "features/workflows/components/workflow-decision-controls.tsx"),
      "utf8",
    );
    expect(source).toContain("Comment is required");
  });
});
