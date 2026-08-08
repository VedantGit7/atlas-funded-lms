import { describe, expect, it, vi } from "vitest";
import {
  mapAssessmentAttemptToSignals,
  mapPracticeSessionToSignals,
} from "../../../backend/apps/api/src/server/competency/competency-signal-mapper.service";

const loadAttemptAnswerRows = vi.fn();
const loadPracticeResponseRows = vi.fn();
const loadItemDimensionWeights = vi.fn();

vi.mock("../../../backend/apps/api/src/server/competency/competency-projection.repository", () => ({
  loadAttemptAnswerRows: (...args: unknown[]) => loadAttemptAnswerRows(...args),
  loadPracticeResponseRows: (...args: unknown[]) => loadPracticeResponseRows(...args),
  loadItemDimensionWeights: (...args: unknown[]) => loadItemDimensionWeights(...args),
}));

describe("competency signal mapper", () => {
  it("creates expected assessment signals from item dimension weights", async () => {
    loadAttemptAnswerRows.mockResolvedValue([
      {
        itemId: "item-1",
        pointsAwarded: 1,
        isCorrect: true,
        maxPoints: 1,
      },
    ]);
    loadItemDimensionWeights.mockResolvedValue([
      { dimensionId: "dim-1", weight: 0.75 },
      { dimensionId: "dim-2", weight: 0.25 },
    ]);

    const signals = await mapAssessmentAttemptToSignals({
      tx: {} as never,
      attemptId: "attempt-1",
      membershipId: "member-1",
    });

    expect(signals).toHaveLength(2);
    expect(signals[0]).toMatchObject({
      membershipId: "member-1",
      dimensionId: "dim-1",
      rawScore: 100,
      weight: 0.75,
      signalSourceKey: "assessment",
    });
  });

  it("creates expected practice signals from practice responses and dimension weights", async () => {
    loadPracticeResponseRows.mockResolvedValue([
      { itemId: "item-1", isCorrect: true },
      { itemId: "item-2", isCorrect: false },
    ]);
    loadItemDimensionWeights.mockImplementation(async ({ itemId }: { itemId: string }) => {
      if (itemId === "item-1") return [{ dimensionId: "dim-1", weight: 1 }];
      return [{ dimensionId: "dim-2", weight: 1 }];
    });

    const signals = await mapPracticeSessionToSignals({
      tx: {} as never,
      practiceSessionId: "session-1",
      membershipId: "member-1",
    });

    expect(signals).toHaveLength(2);
    expect(signals.find((signal) => signal.dimensionId === "dim-1")?.rawScore).toBe(100);
    expect(signals.find((signal) => signal.dimensionId === "dim-2")?.rawScore).toBe(0);
  });

  it("emits no signals when no weights exist", async () => {
    loadAttemptAnswerRows.mockResolvedValue([
      {
        itemId: "item-1",
        pointsAwarded: 1,
        isCorrect: true,
        maxPoints: 1,
      },
    ]);
    loadItemDimensionWeights.mockResolvedValue([]);

    const signals = await mapAssessmentAttemptToSignals({
      tx: {} as never,
      attemptId: "attempt-1",
      membershipId: "member-1",
    });

    expect(signals).toEqual([]);
  });
});
