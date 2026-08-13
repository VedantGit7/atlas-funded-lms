import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { resolveSplitPath, splitPathExists } from "./split-layout-paths";

/**
 * Lightweight L1 proctoring journey wiring.
 * Full consent + event ingest is covered by tests/integration/api/proctoring.test.ts
 * (DB-backed). This stub asserts the nested route + UI consent path exist.
 */

const proctoringPaths = [
  "features/assessments/components/proctoring-consent-modal.tsx",
  "features/assessments/lib/proctoring-signal-capture.ts",
  "app/api/v1/attempts/[id]/proctoring-events/route.ts",
  "app/api/v1/attempts/[id]/proctoring/identity-verification/route.ts",
  "server/proctoring/proctoring.service.ts",
  "server/proctoring/proctoring.schemas.ts",
  "server/proctoring/proctoring-risk.ts",
];

describe("proctoring L1–L3 e2e wiring", () => {
  it("includes consent UI, signal capture, and nested ingest route", () => {
    for (const relativePath of proctoringPaths) {
      expect(splitPathExists(relativePath)).toBe(true);
    }
  });

  it("consent modal requires explicit confirm before start", () => {
    const source = readFileSync(
      resolveSplitPath("features/assessments/components/proctoring-consent-modal.tsx"),
      "utf8",
    );
    expect(source).toContain("Integrity monitoring consent");
    expect(source).toContain("I understand, start attempt");
    expect(source).toContain("onConfirm");
  });

  it("signal capture posts to nested proctoring-events route", () => {
    const source = readFileSync(
      resolveSplitPath("features/assessments/lib/proctoring-signal-capture.ts"),
      "utf8",
    );
    expect(source).toContain("/api/v1/attempts/");
    expect(source).toContain("/proctoring-events");
    expect(source).toContain("identity-verification");
  });

  it("overview wires ProctoringConsentModal for proctoring levels", () => {
    const source = readFileSync(
      resolveSplitPath("features/assessments/components/assessment-overview.tsx"),
      "utf8",
    );
    expect(source).toContain("ProctoringConsentModal");
    expect(source).toContain("proctoringLevel");
  });
});
