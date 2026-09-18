import { describe, expect, it } from "vitest";
import { parsePracticeSessionSummary } from "../../../backend/apps/api/src/server/practice/practice.repository";
import {
  StartPracticeSessionBodySchema,
  practiceSessionSummarySchema,
  safePracticeCardSchema,
} from "../../../backend/apps/api/src/server/practice/practice.schemas";

describe("practice engine selection", () => {
  it("defaults to the swipe engine when none is supplied", () => {
    const parsed = StartPracticeSessionBodySchema.parse({ mode: "due" });
    expect(parsed.engine).toBe("swipe");
  });

  it("accepts the flashcards engine", () => {
    const parsed = StartPracticeSessionBodySchema.parse({ mode: "due", engine: "flashcards" });
    expect(parsed.engine).toBe("flashcards");
  });

  it("rejects an unknown engine", () => {
    expect(() =>
      StartPracticeSessionBodySchema.parse({ mode: "due", engine: "telepathy" }),
    ).toThrow();
  });
});

describe("practice session summary back-compat", () => {
  it("defaults legacy summaries (no engine) to swipe", () => {
    const summary = parsePracticeSessionSummary({
      mode: "collection",
      selectedItemIds: ["018f0000-0000-7000-8000-000000000001"],
      answeredItemIds: [],
    });
    expect(summary.engine).toBe("swipe");
    expect(summary.mode).toBe("collection");
  });

  it("preserves the flashcards engine on stored summaries", () => {
    const summary = parsePracticeSessionSummary({
      mode: "due",
      engine: "flashcards",
      selectedItemIds: [],
      answeredItemIds: [],
    });
    expect(summary.engine).toBe("flashcards");
  });

  it("defaults engine when parsing a summary through the schema", () => {
    const parsed = practiceSessionSummarySchema.parse({
      mode: "due",
      selectedItemIds: [],
      answeredItemIds: [],
    });
    expect(parsed.engine).toBe("swipe");
  });
});

describe("safe practice card", () => {
  const base = {
    itemId: "018f0000-0000-7000-8000-000000000001",
    itemTypeKey: "swipe" as const,
    contentJson: { stem: "What is beta?" },
  };

  it("allows a swipe card with no explanation (answer stays server-side)", () => {
    const card = safePracticeCardSchema.parse({ ...base, rendererKey: "swipe" });
    expect(card.rendererKey).toBe("swipe");
    expect(card.explanation).toBeUndefined();
  });

  it("allows a flashcard carrying the author explanation as its back", () => {
    const card = safePracticeCardSchema.parse({
      ...base,
      rendererKey: "flashcard",
      explanation: "Beta measures volatility against the market.",
    });
    expect(card.rendererKey).toBe("flashcard");
    expect(card.explanation).toBe("Beta measures volatility against the market.");
  });

  it("rejects an unknown renderer", () => {
    expect(() => safePracticeCardSchema.parse({ ...base, rendererKey: "hologram" })).toThrow();
  });
});
