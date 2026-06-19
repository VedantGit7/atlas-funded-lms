import { describe, expect, it } from "vitest";
import {
  aggregateWeightedScore,
  assignBandKey,
} from "../../../apps/web/src/server/competency/competency-projection.service";
import { buildSignalIdempotencyKey } from "../../../apps/web/src/server/competency/competency-projection.repository";

describe("competency projection service helpers", () => {
  it("aggregates weighted values", () => {
    const score = aggregateWeightedScore([
      { rawScore: 100, weight: 1 },
      { rawScore: 50, weight: 1 },
    ]);

    expect(score).toBe(75);
  });

  it("assigns band using thresholds", () => {
    const bandKey = assignBandKey(72, [
      { key: "developing", minScore: 0, maxScore: 59.9999, sortOrder: 1 },
      { key: "proficient", minScore: 60, maxScore: 100, sortOrder: 2 },
    ]);

    expect(bandKey).toBe("proficient");
  });

  it("builds stable idempotency keys", () => {
    const key = buildSignalIdempotencyKey({
      sourceEventId: "event-1",
      membershipId: "member-1",
      dimensionId: "dim-1",
      itemId: "item-1",
      signalSourceKey: "assessment",
    });

    expect(key).toBe("event-1:member-1:dim-1:assessment:item-1");
  });

  it("snapshot payload shape excludes PII fields", () => {
    const snapshot = {
      scores: [
        {
          dimensionId: "018f0000-0000-7000-8000-000000000001",
          dimensionKey: "execution_skill",
          score: 80,
          bandKey: "proficient",
        },
      ],
      bands: [{ key: "proficient", label: "Proficient", minScore: 60, maxScore: 100 }],
    };

    expect(snapshot).not.toHaveProperty("email");
    expect(snapshot).not.toHaveProperty("displayName");
    expect(snapshot.scores[0]).not.toHaveProperty("membershipId");
  });
});
