import { describe, expect, it } from "vitest";
import {
  buildChartTableFallback,
  shouldUseChartTableFallback,
} from "../../../apps/web/src/features/learner/helpers/chart-fallback";
import {
  EDUCATIONAL_READINESS_COPY,
  HALL_OF_FAME_DISCLAIMER,
} from "../../../apps/web/src/features/learner/copy/learner-copy";

describe("learner copy and chart fallback helpers", () => {
  it("uses educational readiness copy without guarantee language", () => {
    expect(EDUCATIONAL_READINESS_COPY).toContain("not financial advice");
    expect(EDUCATIONAL_READINESS_COPY).not.toMatch(/guarantee/i);
  });

  it("avoids funded-status assertions in hall of fame copy", () => {
    expect(HALL_OF_FAME_DISCLAIMER).toContain("do not verify funded-trader status");
    expect(HALL_OF_FAME_DISCLAIMER).not.toMatch(/verified funded|profitability guarantee/i);
  });

  it("builds chart text/table fallback", () => {
    const fallback = buildChartTableFallback([
      { label: "Week 1", value: "62" },
      { label: "Week 2", value: "68" },
    ]);
    expect(fallback.mode).toBe("table");
    expect(fallback.rows).toHaveLength(2);
  });

  it("prefers table fallback when reduced motion is requested", () => {
    expect(shouldUseChartTableFallback(true, 5)).toBe(true);
    expect(shouldUseChartTableFallback(false, 0)).toBe(true);
    expect(shouldUseChartTableFallback(false, 3)).toBe(false);
  });
});
