import { describe, expect, it } from "vitest";
import {
  DueQueueQuerySchema,
  StartPracticeSessionBodySchema,
  SubmitPracticeResponseBodySchema,
} from "../../../backend/apps/api/src/server/practice/practice.schemas";
import { scheduleSrsUpdate } from "../../../backend/apps/api/src/server/practice/srs.service";
import { scoreSwipeResponse } from "../../../backend/apps/api/src/server/practice/swipe-scoring.service";

describe("practice schemas", () => {
  it("rejects tenant_id, membershipId, score, isCorrect, and client item selection on session start", () => {
    expect(() =>
      StartPracticeSessionBodySchema.parse({
        mode: "due",
        tenant_id: "018f0000-0000-7000-8000-000000000001",
      }),
    ).toThrow();

    expect(() =>
      StartPracticeSessionBodySchema.parse({
        mode: "due",
        membershipId: "018f0000-0000-7000-8000-000000000002",
      }),
    ).toThrow();

    expect(() =>
      StartPracticeSessionBodySchema.parse({
        mode: "due",
        isCorrect: true,
      }),
    ).toThrow();

    expect(() =>
      StartPracticeSessionBodySchema.parse({
        mode: "due",
        selectedItemIds: ["018f0000-0000-7000-8000-000000000003"],
      }),
    ).toThrow();
  });

  it("validates due and collection start rules", () => {
    expect(
      StartPracticeSessionBodySchema.parse({
        mode: "due",
        maxItems: 5,
      }).mode,
    ).toBe("due");

    expect(() =>
      StartPracticeSessionBodySchema.parse({
        mode: "collection",
      }),
    ).toThrow();

    expect(() =>
      StartPracticeSessionBodySchema.parse({
        mode: "due",
        collectionId: "018f0000-0000-7000-8000-000000000004",
      }),
    ).toThrow();
  });

  it("validates response action and latency bounds", () => {
    expect(() =>
      SubmitPracticeResponseBodySchema.parse({
        itemId: "018f0000-0000-7000-8000-000000000005",
        action: "maybe",
      }),
    ).toThrow();

    expect(() =>
      SubmitPracticeResponseBodySchema.parse({
        itemId: "018f0000-0000-7000-8000-000000000005",
        action: "known",
        latencyMs: 300001,
      }),
    ).toThrow();

    expect(
      SubmitPracticeResponseBodySchema.parse({
        itemId: "018f0000-0000-7000-8000-000000000005",
        action: "unknown",
        latencyMs: 1200,
      }).action,
    ).toBe("unknown");
  });

  it("rejects tenant_id on due queue query", () => {
    expect(() =>
      DueQueueQuerySchema.parse({
        tenant_id: "018f0000-0000-7000-8000-000000000006",
      }),
    ).toThrow();
  });

  it("coerces a string limit from the query string", () => {
    // Query params always arrive as strings; the schema must coerce, not 400.
    expect(DueQueueQuerySchema.parse({ limit: "20" })).toEqual({ limit: 20 });
  });

  it("defaults the limit when omitted", () => {
    expect(DueQueueQuerySchema.parse({})).toEqual({ limit: 20 });
  });

  it("rejects unknown keys on due queue query", () => {
    expect(() => DueQueueQuerySchema.parse({ limit: "20", foo: "bar" })).toThrow();
  });
});

describe("SRS scheduler", () => {
  it("uses first correct defaults", () => {
    const next = scheduleSrsUpdate({ previous: null, isCorrect: true });
    expect(next.easeFactor).toBe(2);
    expect(next.intervalDays).toBe(1);
  });

  it("increases ease and interval on later correct answers", () => {
    const next = scheduleSrsUpdate({
      previous: { easeFactor: 2, intervalDays: 2 },
      isCorrect: true,
    });
    expect(next.easeFactor).toBe(2.1);
    expect(next.intervalDays).toBeGreaterThanOrEqual(2);
  });

  it("caps ease at 2.5 and resets interval on incorrect", () => {
    const capped = scheduleSrsUpdate({
      previous: { easeFactor: 2.5, intervalDays: 10 },
      isCorrect: true,
    });
    expect(capped.easeFactor).toBe(2.5);

    const incorrect = scheduleSrsUpdate({
      previous: { easeFactor: 1.3, intervalDays: 8 },
      isCorrect: false,
    });
    expect(incorrect.easeFactor).toBe(1.3);
    expect(incorrect.intervalDays).toBe(1);
  });
});

describe("swipe scoring", () => {
  it("scores known/unknown against swipe answer key without exposing answer key pre-response", () => {
    expect(
      scoreSwipeResponse({
        itemTypeKey: "swipe",
        answerKeyJson: { direction: "right" },
        action: "known",
      }),
    ).toBe(true);

    expect(
      scoreSwipeResponse({
        itemTypeKey: "swipe",
        answerKeyJson: { direction: "right" },
        action: "unknown",
      }),
    ).toBe(false);
  });
});
