import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { resolveSplitPath, splitPathExists } from "./split-layout-paths";

const competencyPaths = [
  "app/admin/competency/page.tsx",
  "features/competency/components/CompetencyConfigPanel.tsx",
  "features/competency/components/DimensionEditor.tsx",
  "features/competency/components/ScoringProfileEditor.tsx",
  "features/competency/components/BandThresholdEditor.tsx",
  "features/competency/components/ScoringPublishPanel.tsx",
  "features/competency/components/SignalInspectorPlaceholder.tsx",
  "app/api/v1/competency-dimensions/route.ts",
  "app/api/v1/competency-dimensions/[id]/route.ts",
  "app/api/v1/scoring-profiles/route.ts",
  "app/api/v1/scoring-profiles/[id]/route.ts",
  "app/api/v1/scoring-profiles/[id]/bands/route.ts",
  "app/api/v1/scoring-config/[id]/publish/route.ts",
];

describe("competency config e2e wiring", () => {
  it("includes approved admin screen and APIs", () => {
    for (const relativePath of competencyPaths) {
      expect(splitPathExists(relativePath)).toBe(true);
    }
  });

  it("admin competency page handles denied state", () => {
    const source = readFileSync(resolveSplitPath("app/admin/competency/page.tsx"), "utf8");
    expect(source).toContain("denied");
  });

  it("signal inspector uses competency-signals API", () => {
    const tableSource = readFileSync(
      resolveSplitPath("features/competency/components/CompetencySignalTable.tsx"),
      "utf8",
    );
    const clientSource = readFileSync(
      resolveSplitPath("modules/competency/competency.api-client.ts"),
      "utf8",
    );
    expect(tableSource).toContain("competencyApiClient.listCompetencySignals");
    expect(clientSource).toContain("/api/v1/competency-signals");
  });

  it("dimension editor supports generic keys", () => {
    const source = readFileSync(
      resolveSplitPath("features/competency/components/DimensionEditor.tsx"),
      "utf8",
    );
    expect(source).toContain("execution_skill");
    expect(source).not.toMatch(/\b(TA|PSY|RISK|DISC|CR)\b/);
  });

  it("publish panel uses confirmation", () => {
    const source = readFileSync(
      resolveSplitPath("features/competency/components/ScoringPublishPanel.tsx"),
      "utf8",
    );
    expect(source).toContain("Confirm publish");
  });

  it("admin dashboard links to competency config", () => {
    const source = readFileSync(resolveSplitPath("app/admin/page.tsx"), "utf8");
    expect(source).toContain("/admin/competency");
  });
});
