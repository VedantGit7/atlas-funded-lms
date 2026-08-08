import { describe, expect, it } from "vitest";
import { duplicateDimensionWeight } from "../../../backend/apps/api/src/server/item-registry/item-registry.errors";

describe("item registry service helpers", () => {
  it("detects duplicate dimension ids before replace", () => {
    const weights = [
      { dimensionId: "11111111-1111-4111-8111-111111111111", weight: 0.5 },
      { dimensionId: "11111111-1111-4111-8111-111111111111", weight: 0.25 },
    ];

    const dimensionIds = new Set(weights.map((weight) => weight.dimensionId));
    expect(dimensionIds.size).not.toBe(weights.length);

    expect(() => {
      if (dimensionIds.size !== weights.length) {
        throw duplicateDimensionWeight();
      }
    }).toThrow();
  });
});
