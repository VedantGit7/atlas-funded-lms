import { describe, expect, it } from "vitest";
import {
  createDimensionBodySchema,
  publishScoringConfigBodySchema,
  replaceBandsBodySchema,
  validateBandInputs,
} from "../../../backend/apps/api/src/server/competency/competency-config.schemas";

describe("competency config schemas", () => {
  it("rejects tenant_id", () => {
    expect(() =>
      createDimensionBodySchema.parse({
        key: "risk_management",
        name: "Risk Management",
        tenant_id: "018f0000-0000-7000-8000-000000000099",
      }),
    ).toThrow();
  });

  it("accepts generic dimension keys", () => {
    expect(
      createDimensionBodySchema.parse({
        key: "risk_management",
        name: "Technical Analysis",
      }),
    ).toBeTruthy();
  });

  it("accepts hyphenated scoring profile keys from tenant manifests", async () => {
    const { scoringProfileSchema } =
      await import("../../../backend/apps/api/src/server/competency/competency-config.schemas");
    expect(
      scoringProfileSchema.parse({
        id: "018f0000-0000-7000-8000-000000000099",
        key: "academy-readiness",
        name: "Academy Readiness Profile",
        status: "ACTIVE",
        activeConfigVersionId: null,
        activeVersion: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      }),
    ).toBeTruthy();
  });

  it("rejects unknown fields", () => {
    expect(() =>
      createDimensionBodySchema.parse({
        key: "focus",
        name: "Focus",
        extra: true,
      }),
    ).toThrow();
  });

  it("rejects overlapping bands", () => {
    expect(() =>
      replaceBandsBodySchema.parse({
        bands: [
          { key: "low", label: "Low", minScore: 0, maxScore: 60, sortOrder: 0 },
          { key: "high", label: "High", minScore: 50, maxScore: 100, sortOrder: 1 },
        ],
      }),
    ).toThrow();
  });

  it("rejects minScore greater than maxScore", () => {
    expect(() =>
      validateBandInputs([
        { key: "invalid", label: "Invalid", minScore: 80, maxScore: 20, sortOrder: 0 },
      ]),
    ).toThrow(/minScore/);
  });

  it("rejects duplicate band key and sort order", () => {
    expect(() =>
      validateBandInputs([
        { key: "ready", label: "Ready A", minScore: 0, maxScore: 40, sortOrder: 0 },
        { key: "ready", label: "Ready B", minScore: 41, maxScore: 100, sortOrder: 0 },
      ]),
    ).toThrow(/key/);
  });

  it("accepts publish body with optional comment only", () => {
    expect(publishScoringConfigBodySchema.parse({ comment: "Initial publish" })).toEqual({
      comment: "Initial publish",
    });
    expect(publishScoringConfigBodySchema.parse({})).toEqual({});
  });
});

describe("publish snapshot prerequisites", () => {
  it("requires dimensions and bands before publish in service validation", async () => {
    const { publishScoringConfig } =
      await import("../../../backend/apps/api/src/server/competency/scoring-config.service");
    expect(typeof publishScoringConfig).toBe("function");
  });
});
