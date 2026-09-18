import { describe, expect, it } from "vitest";
import {
  pollDtoSchema,
  pollRespondentViewDtoSchema,
} from "../../../backend/packages/domain/src/polls/polls.dto";

/**
 * The respondent view is a security boundary, not a convenience projection.
 *
 * `pollDtoSchema` carries `options[].isCorrect`. Serving that to the person
 * answering a `quizMode` poll hands over the answer key, so the learner-facing
 * read must be a separate schema that cannot grow the field back by accident —
 * `.strict()` plus this test is what enforces that.
 */
describe("poll respondent view", () => {
  const option = { id: "b0a1c2d3-4e5f-4a6b-8c9d-0e1f2a3b4c5d", label: "Yes", sortOrder: 0 };
  const poll = {
    id: "11111111-2222-4333-8444-555555555555",
    title: "Did this lesson help?",
    description: null,
    allowMultipleAnswers: false,
    anonymousVote: true,
    closesAt: null,
    options: [option],
  };

  it("accepts the learner-safe shape", () => {
    expect(() => pollRespondentViewDtoSchema.parse(poll)).not.toThrow();
  });

  it("rejects an option carrying isCorrect", () => {
    // The admin DTO permits this exact object; the respondent DTO must not.
    const leaked = { ...poll, options: [{ ...option, isCorrect: true }] };

    expect(() => pollRespondentViewDtoSchema.parse(leaked)).toThrow(/unrecognized_key|isCorrect/i);
  });

  it("rejects admin-only poll fields", () => {
    for (const extra of [
      { quizMode: true },
      { resultVisibility: "after_vote" },
      { status: "ACTIVE" },
      { liveSessionId: "11111111-2222-4333-8444-666666666666" },
    ]) {
      expect(() => pollRespondentViewDtoSchema.parse({ ...poll, ...extra })).toThrow();
    }
  });

  it("control: the admin DTO does carry isCorrect, so the projection is doing real work", () => {
    const adminPoll = {
      ...poll,
      pollType: "single",
      status: "ACTIVE" as const,
      quizMode: true,
      resultVisibility: "after_vote",
      layout: "list",
      durationSeconds: null,
      liveSessionId: null,
      createdAt: "2026-08-22T00:00:00.000Z",
      options: [{ ...option, isCorrect: true }],
    };

    const parsed = pollDtoSchema.parse(adminPoll);
    expect(parsed.options[0]).toHaveProperty("isCorrect", true);
  });
});
