import { describe, expect, it } from "vitest";
import {
  TEST_SECONDS_PER_ITEM,
  deadlineForEngine,
  isChoiceEngine,
  isExpired,
  itemTypeKeysForEngine,
} from "../../../backend/apps/api/src/server/practice/practice.service";
import { parsePracticeSessionSummary } from "../../../backend/apps/api/src/server/practice/practice.repository";
import {
  StartPracticeSessionBodySchema,
  practiceSessionSummarySchema,
  submitPracticeResponseResponseSchema,
} from "../../../backend/apps/api/src/server/practice/practice.schemas";

const now = new Date("2026-07-15T10:00:00.000Z");

describe("test engine wiring", () => {
  it("is accepted on session start", () => {
    expect(StartPracticeSessionBodySchema.parse({ mode: "due", engine: "test" }).engine).toBe(
      "test",
    );
  });

  it("draws from the same choice pool as learn", () => {
    expect(itemTypeKeysForEngine("test")).toEqual(["mcq_single", "true_false"]);
  });

  it("counts as a choice (server-graded) engine", () => {
    expect(isChoiceEngine("test")).toBe(true);
    expect(isChoiceEngine("learn")).toBe(true);
    expect(isChoiceEngine("swipe")).toBe(false);
    expect(isChoiceEngine("match")).toBe(false);
  });
});

describe("deadlineForEngine", () => {
  it("allocates time per item for a test", () => {
    const deadline = deadlineForEngine("test", 4, now);
    expect(deadline).not.toBeNull();
    expect(Date.parse(deadline ?? "") - now.getTime()).toBe(4 * TEST_SECONDS_PER_ITEM * 1000);
  });

  it("leaves every other engine untimed", () => {
    expect(deadlineForEngine("learn", 4, now)).toBeNull();
    expect(deadlineForEngine("swipe", 4, now)).toBeNull();
    expect(deadlineForEngine("flashcards", 4, now)).toBeNull();
    expect(deadlineForEngine("match", 4, now)).toBeNull();
  });

  it("does not set a deadline for an empty test", () => {
    expect(deadlineForEngine("test", 0, now)).toBeNull();
  });
});

describe("isExpired", () => {
  it("is false when there is no deadline (untimed engines)", () => {
    expect(isExpired(undefined, now)).toBe(false);
  });

  it("is false before the deadline and true after it", () => {
    const deadline = deadlineForEngine("test", 1, now) ?? "";
    expect(isExpired(deadline, new Date(now.getTime() + 10_000))).toBe(false);
    expect(isExpired(deadline, new Date(now.getTime() + 46_000))).toBe(true);
  });

  it("ignores an unparseable deadline rather than locking the learner out", () => {
    expect(isExpired("not-a-date", now)).toBe(false);
  });
});

describe("session summary carries the deadline", () => {
  it("round-trips expiresAt", () => {
    const parsed = practiceSessionSummarySchema.parse({
      mode: "due",
      engine: "test",
      expiresAt: now.toISOString(),
      selectedItemIds: [],
      answeredItemIds: [],
    });
    expect(parsed.expiresAt).toBe(now.toISOString());
  });

  it("leaves expiresAt undefined for untimed engines", () => {
    const parsed = practiceSessionSummarySchema.parse({
      mode: "due",
      engine: "learn",
      selectedItemIds: [],
      answeredItemIds: [],
    });
    expect(parsed.expiresAt).toBeUndefined();
  });
});

describe("a test withholds results until submission", () => {
  it("allows a null isCorrect on the response envelope", () => {
    const parsed = submitPracticeResponseResponseSchema.parse({
      data: {
        response: {
          itemId: "018f0000-0000-7000-8000-000000000001",
          isCorrect: null,
          feedbackLabel: "Answer recorded",
          explanation: null,
          occurredAt: now.toISOString(),
        },
        progress: { answeredCount: 1, totalItems: 4 },
        nextCard: null,
      },
    });
    expect(parsed.data.response.isCorrect).toBeNull();
    expect(parsed.data.response.explanation).toBeNull();
  });

  it("still allows graded feedback for the non-test engines", () => {
    const parsed = submitPracticeResponseResponseSchema.parse({
      data: {
        response: {
          itemId: "018f0000-0000-7000-8000-000000000001",
          isCorrect: true,
          feedbackLabel: "Correct",
          explanation: "Alpha is excess return.",
          occurredAt: now.toISOString(),
        },
        progress: { answeredCount: 1, totalItems: 4 },
        nextCard: null,
      },
    });
    expect(parsed.data.response.isCorrect).toBe(true);
  });
});

// Regression: the runtime parser (not the zod schema) is what reads stored
// sessions back. It previously dropped `test` and `expiresAt`, which silently
// defeated engine routing and server-side expiry enforcement.
describe("parsePracticeSessionSummary round-trips timed tests", () => {
  it("keeps the test engine", () => {
    const summary = parsePracticeSessionSummary({
      mode: "due",
      engine: "test",
      selectedItemIds: [],
      answeredItemIds: [],
    });
    expect(summary.engine).toBe("test");
  });

  it("keeps every engine it stored", () => {
    for (const engine of ["swipe", "flashcards", "match", "learn", "test"] as const) {
      expect(
        parsePracticeSessionSummary({
          mode: "due",
          engine,
          selectedItemIds: [],
          answeredItemIds: [],
        }).engine,
      ).toBe(engine);
    }
  });

  it("preserves expiresAt so the deadline stays enforceable", () => {
    const expiresAt = now.toISOString();
    const summary = parsePracticeSessionSummary({
      mode: "due",
      engine: "test",
      expiresAt,
      selectedItemIds: [],
      answeredItemIds: [],
    });
    expect(summary.expiresAt).toBe(expiresAt);
    expect(isExpired(summary.expiresAt, new Date(now.getTime() + 1000))).toBe(true);
  });

  it("still defaults unknown/legacy engines to swipe", () => {
    expect(
      parsePracticeSessionSummary({ mode: "due", selectedItemIds: [], answeredItemIds: [] }).engine,
    ).toBe("swipe");
    expect(
      parsePracticeSessionSummary({
        mode: "due",
        engine: "telepathy",
        selectedItemIds: [],
        answeredItemIds: [],
      }).engine,
    ).toBe("swipe");
  });
});
