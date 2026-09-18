import { describe, expect, it } from "vitest";
import {
  barHeightPercent,
  dailyAttributionRate,
  formatUtcDay,
} from "../../../frontend/apps/web/src/features/admin/reports/attribution-shared";

/**
 * The health chart's derived figures.
 *
 * A chart is the easiest place to draw a confident lie: a silent day rendered
 * as zero percent attributed looks like a collapse, and a tiny day rendered at
 * zero height looks like an outage.
 */

describe("dailyAttributionRate", () => {
  it("has no rate on a silent day", () => {
    // Nothing arrived, so there is nothing to be a percentage of. Drawing 0%
    // would show a collapse that did not happen.
    expect(dailyAttributionRate({ total: 0, attributed: 0 })).toBeNull();
  });

  it("computes the day's percentage", () => {
    expect(dailyAttributionRate({ total: 4, attributed: 1 })).toBe(25);
  });

  it("reports a genuine zero as zero, not as absent", () => {
    // Events arrived and none carried attribution — a real finding, and a
    // different one from silence.
    expect(dailyAttributionRate({ total: 8, attributed: 0 })).toBe(0);
  });
});

describe("barHeightPercent", () => {
  it("is zero for a day with no events", () => {
    expect(barHeightPercent(0, 100)).toBe(0);
  });

  it("scales against the busiest day", () => {
    expect(barHeightPercent(50, 100)).toBe(50);
    expect(barHeightPercent(100, 100)).toBe(100);
  });

  it("keeps a tiny day visible rather than invisible", () => {
    // One event out of ten thousand is still an event; a bar rounded to nothing
    // reads as an outage.
    expect(barHeightPercent(1, 10000)).toBeGreaterThan(0);
  });

  it("does not divide by an empty peak", () => {
    expect(barHeightPercent(0, 0)).toBe(0);
    expect(barHeightPercent(5, 0)).toBe(0);
  });
});

describe("formatUtcDay", () => {
  it("labels the day in UTC, not the reader's zone", () => {
    // The series is bucketed in UTC. Labelling in local time would show a
    // different date than the bucket it belongs to.
    expect(formatUtcDay("2026-08-26T00:00:00.000Z")).toBe(
      new Date("2026-08-26T00:00:00.000Z").toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      }),
    );
  });

  it("returns an unparseable value unchanged rather than rendering Invalid Date", () => {
    expect(formatUtcDay("not-a-date")).toBe("not-a-date");
  });
});
