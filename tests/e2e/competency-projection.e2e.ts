import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const webRoot = resolve(import.meta.dirname, "../../apps/web/src");

const competencyProjectionPaths = [
  "app/(learner)/progress/page.tsx",
  "app/api/v1/me/competency/route.ts",
  "app/api/v1/me/competency/history/route.ts",
  "app/api/v1/members/[id]/competency/route.ts",
  "app/api/v1/competency-signals/route.ts",
  "server/competency/competency.worker.ts",
  "server/competency/competency-projection.service.ts",
  "features/competency/components/CompetencyScoreCards.tsx",
  "features/competency/components/CompetencyHistoryChart.tsx",
  "features/competency/components/CompetencySignalTable.tsx",
  "features/competency/components/MemberCompetencyPanel.tsx",
  "events/worker-router.ts",
  "events/outbox-consumers.ts",
];

describe("competency projection e2e wiring", () => {
  it("includes approved learner progress screen and APIs", () => {
    for (const relativePath of competencyProjectionPaths) {
      expect(existsSync(resolve(webRoot, relativePath))).toBe(true);
    }
  });

  it("progress page uses PageGate and competency server API", () => {
    const source = readFileSync(resolve(webRoot, "app/(learner)/progress/page.tsx"), "utf8");
    expect(source).toContain("PageGate");
    expect(source).toContain("competencyServerApi");
    expect(source).toContain("CompetencyScoreCards");
    expect(source).toContain("CompetencyHistoryChart");
  });

  it("signal inspector uses competency-signals API with pagination", () => {
    const tableSource = readFileSync(
      resolve(webRoot, "features/competency/components/CompetencySignalTable.tsx"),
      "utf8",
    );
    const clientSource = readFileSync(
      resolve(webRoot, "modules/competency/competency.api-client.ts"),
      "utf8",
    );
    expect(tableSource).toContain("competencyApiClient.listCompetencySignals");
    expect(tableSource).toContain("Load more");
    expect(clientSource).toContain("/api/v1/competency-signals");
  });

  it("worker consumes assessment and practice events only", () => {
    const source = readFileSync(resolve(webRoot, "events/outbox-consumers.ts"), "utf8");
    expect(source).toContain("assessment.submitted");
    expect(source).toContain("assessment.graded");
    expect(source).toContain("practice.session_completed");
    expect(source).not.toContain("challenge.purchased");
    expect(source).not.toContain("challenge.passed");
    expect(source).not.toContain("challenge.funded");
  });

  it("learner shell links to progress route", () => {
    const source = readFileSync(resolve(webRoot, "components/shells/LearnerShell.tsx"), "utf8");
    expect(source).toContain("/progress");
  });

  it("does not expose POST competency-signals route", () => {
    const routePath = resolve(webRoot, "app/api/v1/competency-signals/route.ts");
    const source = readFileSync(routePath, "utf8");
    expect(source).not.toMatch(/export const POST/);
  });
});
