import { describe, expect, it } from "vitest";
import {
  buildInsightSalesPipeline,
  salesPipelineToCsv,
  SALES_PIPELINE_CAVEAT,
} from "../../../backend/apps/api/src/server/insights/insights-sales-pipeline";
import { SALES_PIPELINE_EMPTY_CAPTION } from "../../../backend/apps/api/src/server/insights/insights-sales-insight";
import { insightSalesPipelineResponseSchema } from "../../../backend/apps/api/src/server/insights/insights.schemas";

const populated = {
  pipeline: { visited: 18420, startedDiagnostic: 2140, enrolled: 1284 },
  pipeline30d: { visited: 3480, startedDiagnostic: 415, enrolled: 312 },
};

describe("buildInsightSalesPipeline", () => {
  it("compares sequential 3-stage funnels and never invents CRM stages", () => {
    const board = buildInsightSalesPipeline(populated, "2026-08-11T12:00:00.000Z");

    expect(board.title).toBe("Sales pipeline");
    expect(board.slug).toBe("sales-insight");
    expect(board.stages.map((stage) => stage.label)).toEqual([
      "Visited",
      "Started diagnostic",
      "Enrolled",
    ]);
    expect(board.stages.some((stage) => /lead|qualified|proposal|won/i.test(stage.label))).toBe(
      false,
    );
    expect(board.conversionAllPct).toBe(7);
    expect(board.conversion30dPct).toBe(9);
    expect(board.differencePts).toBe(2);
    expect(board.differenceDisplay).toBe("+2 pts");
    expect(board.differenceTone).toBe("up");
    expect(board.empty).toBe(false);
    expect(board.caveat).toBe(SALES_PIPELINE_CAVEAT);
    expect(board.caveat).not.toContain("—");
    expect(board.enrollmentsHref).toBe("/admin/reports/enrollments");
    expect(insightSalesPipelineResponseSchema.parse({ data: board }).data.stages).toHaveLength(3);
  });

  it("uses stage-to-stage conversion with one decimal and hyphen when the prior stage is empty", () => {
    const board = buildInsightSalesPipeline(populated, "2026-08-11T12:00:00.000Z");
    const started = board.stages[1];
    const enrolled = board.stages[2];

    expect(board.stages[0]?.allTimeConvDisplay).toBe("-");
    expect(started?.allTimeConvDisplay).toBe("11.6%");
    expect(started?.recentConvDisplay).toBe("11.9%");
    expect(started?.deltaDisplay).toBe("+0.3 pts");
    expect(enrolled?.allTimeConvDisplay).toBe("60%");
    expect(enrolled?.recentConvDisplay).toBe("75.2%");
    expect(board.dropoffs[0]?.allTimeCount).toBe(16280);
    expect(board.leakCaption).toBe("Most visitors never start a diagnostic.");
  });

  it("renders empty windows with hyphen conversion and no leak caption", () => {
    const board = buildInsightSalesPipeline(
      {
        pipeline: { visited: 0, startedDiagnostic: 0, enrolled: 0 },
        pipeline30d: { visited: 0, startedDiagnostic: 0, enrolled: 0 },
      },
      "2026-08-11T12:00:00.000Z",
    );

    expect(board.empty).toBe(true);
    expect(board.conversionAllDisplay).toBe("-");
    expect(board.conversion30dDisplay).toBe("-");
    expect(board.differenceDisplay).toBe("-");
    expect(board.differenceTone).toBe("empty");
    expect(board.leakCaption).toBeNull();
    expect(board.caption).toBe(SALES_PIPELINE_EMPTY_CAPTION);
    expect(board.allTime.empty).toBe(true);
    expect(JSON.stringify(board)).not.toContain("—");
    expect(JSON.stringify(board)).not.toContain("–");
  });

  it("exports a comparison CSV without an em dash", () => {
    const board = buildInsightSalesPipeline(populated, "2026-08-11T12:00:00.000Z");
    const csv = salesPipelineToCsv(board);
    expect(csv).toContain("Started diagnostic,2140,11.6%,415,11.9%,+0.3 pts");
    expect(csv).not.toContain("—");
  });
});
