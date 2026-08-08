import { describe, expect, it } from "vitest";
import {
  buildDistractorRates,
  buildItemPsychometrics,
  clampDiscrimination,
  computeDifficulty,
  computeDiscriminationFromLatency,
  computeDiscriminationStub,
  computePsychometricQualityFlag,
  computeSampleSizeWarning,
  mergeDistractorCount,
} from "@atlas/domain/analytics/analytics-psychometrics";
import {
  isRollingItemStatisticWindow,
  itemStatisticWindowCutoff,
  liveItemStatisticWindowKeys,
} from "@atlas/domain/analytics/analytics-window";

describe("analytics window helpers", () => {
  it("returns null cutoff for all_time", () => {
    expect(itemStatisticWindowCutoff("all_time")).toBeNull();
  });

  it("returns rolling cutoffs for 30d and 90d windows", () => {
    const now = new Date("2026-07-24T12:00:00.000Z");
    const cutoff30 = itemStatisticWindowCutoff("rolling_30d", now);
    const cutoff90 = itemStatisticWindowCutoff("rolling_90d", now);

    expect(cutoff30?.toISOString()).toBe("2026-06-24T12:00:00.000Z");
    expect(cutoff90?.toISOString()).toBe("2026-04-25T12:00:00.000Z");
  });

  it("identifies rolling windows and live write keys", () => {
    expect(isRollingItemStatisticWindow("rolling_30d")).toBe(true);
    expect(isRollingItemStatisticWindow("rolling_90d")).toBe(true);
    expect(isRollingItemStatisticWindow("all_time")).toBe(false);
    expect(liveItemStatisticWindowKeys()).toEqual(["all_time"]);
  });
});

describe("analytics psychometrics helpers", () => {
  it("computes difficulty as p-value", () => {
    expect(computeDifficulty(20, 12)).toBe(0.6);
    expect(computeDifficulty(0, 0)).toBeNull();
  });

  it("computes discrimination stub clamped to [-1, 1]", () => {
    expect(computeDiscriminationStub(10, 8)).toBeCloseTo(0.6);
    expect(computeDiscriminationStub(10, 1)).toBeCloseTo(-0.8);
    expect(clampDiscrimination(1.5)).toBe(1);
    expect(clampDiscrimination(-2)).toBe(-1);
  });

  it("approximates discrimination from latency spread", () => {
    const value = computeDiscriminationFromLatency({
      meanCorrectLatencyMs: 2000,
      meanIncorrectLatencyMs: 5000,
    });
    expect(value).toBeGreaterThan(0);
    expect(value).toBeLessThanOrEqual(1);
  });

  it("flags sample size warning below 50 attempts", () => {
    expect(computeSampleSizeWarning(49)).toBe(true);
    expect(computeSampleSizeWarning(50)).toBe(false);
  });

  it("assigns psychometric quality flags", () => {
    expect(
      computePsychometricQualityFlag({
        attemptsCount: 10,
        difficulty: 0.5,
        discrimination: 0.4,
      }),
    ).toBe("bad");

    expect(
      computePsychometricQualityFlag({
        attemptsCount: 60,
        difficulty: 0.5,
        discrimination: 0.35,
      }),
    ).toBe("good");

    expect(
      computePsychometricQualityFlag({
        attemptsCount: 30,
        difficulty: 0.5,
        discrimination: 0.1,
      }),
    ).toBe("fair");

    expect(
      computePsychometricQualityFlag({
        attemptsCount: 40,
        difficulty: 0.95,
        discrimination: 0.4,
      }),
    ).toBe("bad");
  });

  it("merges distractor counts and builds rates", () => {
    const merged = mergeDistractorCount({ a: 2 }, "b");
    expect(merged).toEqual({ a: 2, b: 1 });

    expect(buildDistractorRates({ a: 3, b: 1 }, 8)).toEqual([
      { optionId: "a", rate: 0.375 },
      { optionId: "b", rate: 0.125 },
    ]);
  });

  it("builds full psychometric payload", () => {
    const psychometrics = buildItemPsychometrics({
      attemptsCount: 60,
      correctCount: 30,
      distractorCounts: { opt_a: 20, opt_b: 40 },
    });

    expect(psychometrics.difficulty).toBe(0.5);
    expect(psychometrics.sampleSizeWarning).toBe(false);
    expect(psychometrics.qualityFlag).toBe("fair");
    expect(psychometrics.distractorRates?.length).toBe(2);
  });
});
