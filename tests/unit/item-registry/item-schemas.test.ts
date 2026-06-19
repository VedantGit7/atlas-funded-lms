import { describe, expect, it } from "vitest";
import {
  CreateItemBodySchema,
  DimensionWeightInputSchema,
  ItemOptionInputSchema,
  CollectionTypeSchema,
  PutDimensionWeightsBodySchema,
} from "../../../apps/web/src/features/item-registry/schemas";
import {
  CreateExtensionRegistrationBodySchema,
  UpdateExtensionRegistrationBodySchema,
} from "../../../apps/web/src/features/extensions/schemas";

describe("item registry schemas", () => {
  it("accepts valid swipe item", () => {
    const parsed = CreateItemBodySchema.parse({
      itemTypeKey: "swipe",
      contentJson: { stem: "Swipe this card" },
      answerKeyJson: { direction: "right" },
      options: [],
      tags: ["swipe"],
    });

    expect(parsed.itemTypeKey).toBe("swipe");
  });

  it("rejects invalid itemTypeKey", () => {
    expect(() =>
      CreateItemBodySchema.parse({
        itemTypeKey: "INVALID TYPE",
        contentJson: { stem: "x" },
      }),
    ).toThrow();
  });

  it("validates item option position bounds", () => {
    expect(() =>
      ItemOptionInputSchema.parse({
        optionJson: { label: "A" },
        position: 0,
      }),
    ).toThrow();

    expect(
      ItemOptionInputSchema.parse({
        optionJson: { label: "A" },
        position: 1,
      }).position,
    ).toBe(1);
  });

  it("validates dimension weight min/max", () => {
    expect(() =>
      DimensionWeightInputSchema.parse({ dimensionId: randomUuid(), weight: -0.1 }),
    ).toThrow();
    expect(() =>
      DimensionWeightInputSchema.parse({ dimensionId: randomUuid(), weight: 1.1 }),
    ).toThrow();
    expect(
      DimensionWeightInputSchema.parse({ dimensionId: randomUuid(), weight: 0.5 }).weight,
    ).toBe(0.5);
  });

  it("rejects duplicate dimensions in service payload schema", () => {
    const dimensionId = randomUuid();
    const parsed = PutDimensionWeightsBodySchema.parse({
      weights: [
        { dimensionId, weight: 0.5 },
        { dimensionId, weight: 0.25 },
      ],
    });

    expect(new Set(parsed.weights.map((weight) => weight.dimensionId)).size).not.toBe(
      parsed.weights.length,
    );
  });

  it("validates collection type", () => {
    expect(CollectionTypeSchema.parse("deck")).toBe("deck");
    expect(() => CollectionTypeSchema.parse("invalid")).toThrow();
  });
});

describe("extension registration schemas", () => {
  it("validates registration key format", () => {
    expect(
      CreateExtensionRegistrationBodySchema.parse({
        extensionPointKey: "item_type_renderer",
        registrationKey: "swipe-renderer",
        configJson: { rendererKey: "swipe" },
      }).registrationKey,
    ).toBe("swipe-renderer");
  });

  it("requires id or natural key for update", () => {
    expect(() =>
      UpdateExtensionRegistrationBodySchema.parse({
        configJson: { rendererKey: "swipe" },
      }),
    ).toThrow();
  });
});

function randomUuid(): string {
  return "11111111-1111-4111-8111-111111111111";
}
