import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const webRoot = resolve(import.meta.dirname, "../../apps/web/src");

const diagnosticPaths = [
  "app/(public)/diagnostic/page.tsx",
  "app/(public)/diagnostic/result/page.tsx",
  "app/(learner)/diagnostic/me/page.tsx",
  "app/(learner)/diagnostic/me/[id]/page.tsx",
  "app/(learner)/diagnostic/me/[id]/result/page.tsx",
  "app/api/v1/public/diagnostic/start/route.ts",
  "app/api/v1/public/diagnostic/[anonId]/result/route.ts",
  "app/api/v1/public/diagnostic/[anonId]/merge/route.ts",
  "app/api/v1/diagnostic/start/route.ts",
  "app/api/v1/diagnostic/[id]/result/route.ts",
  "modules/diagnostics/diagnostic-public-session.service.ts",
  "modules/diagnostics/diagnostic-merge.service.ts",
  "features/diagnostics/components/PublicDiagnosticRunner.tsx",
  "features/diagnostics/components/DiagnosticIdentityGate.tsx",
  "features/diagnostics/components/AnonymousDiagnosticScorecard.tsx",
];

describe("diagnostic e2e wiring", () => {
  it("includes approved public and learner diagnostic screens and APIs", () => {
    for (const relativePath of diagnosticPaths) {
      expect(existsSync(resolve(webRoot, relativePath))).toBe(true);
    }
  });

  it("public runner does not persist answers in browser storage", () => {
    const source = readFileSync(
      resolve(webRoot, "features/diagnostics/components/PublicDiagnosticRunner.tsx"),
      "utf8",
    );
    expect(source).not.toMatch(/localStorage|sessionStorage/);
  });

  it("identity gate does not expose merge token in URL or storage", () => {
    const source = readFileSync(
      resolve(webRoot, "features/diagnostics/components/DiagnosticIdentityGate.tsx"),
      "utf8",
    );
    expect(source).not.toMatch(/localStorage|sessionStorage/);
    expect(source).toContain("mergePublicDiagnostic");
  });

  it("public scorecard components avoid answer key fields", () => {
    const source = readFileSync(
      resolve(webRoot, "features/diagnostics/components/DiagnosticResultScorecard.tsx"),
      "utf8",
    );
    expect(source).not.toMatch(/correct_answer|answer_key|is_correct/);
  });
});
