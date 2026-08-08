import { describe, expect, it } from "vitest";
import { computeCompositeScore } from "../../../backend/apps/api/src/server/readiness/readiness-evaluator.service";
import { deriveProminence } from "../../../backend/apps/api/src/server/readiness/readiness.schemas";

describe("readiness evaluator helpers", () => {
  it("computes composite score as average", () => {
    expect(computeCompositeScore([{ score: 40 }, { score: 80 }])).toBe(60);
    expect(computeCompositeScore([])).toBeNull();
  });

  it("derives prominence for composite band", () => {
    expect(
      deriveProminence("proficient", [{ bandKey: "proficient", prominence: "prominent" }]),
    ).toBe("prominent");
  });
});
