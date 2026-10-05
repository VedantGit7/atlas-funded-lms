import { describe, expect, it, vi } from "vitest";
import { attemptsRepository } from "../../../backend/apps/api/src/server/attempts/attempts.repository";

/**
 * Audit M2: a start key only replays the attempt it created for the same
 * learner and assessment. Concurrency is covered against Postgres in
 * tests/integration/api/attempt-start-concurrency.test.ts.
 */
const row = {
  id: "attempt-1",
  tenant_id: "tenant-1",
  assessment_id: "assessment-1",
  membership_id: "member-1",
  status: "STARTED",
  started_at: new Date(),
  submitted_at: null,
  graded_at: null,
  score_pct: null,
  metadata_json: {},
  idempotency_key: "key-1",
};

const txWith = (found: typeof row | null) =>
  ({ attempt: { findFirst: vi.fn(async () => found) } }) as never;

const lookup = (found: typeof row | null, membershipId: string, assessmentId: string) =>
  attemptsRepository.findOwnByIdempotencyKey(txWith(found), {
    idempotencyKey: "key-1",
    membershipId,
    assessmentId,
  });

describe("attempt start key ownership (audit M2)", () => {
  it("replays the learner's own attempt for the same assessment", async () => {
    await expect(lookup(row, "member-1", "assessment-1")).resolves.toEqual({
      kind: "own",
      attempt: row,
    });
  });

  it("reports another learner's key as foreign, without the attempt", async () => {
    const result = await lookup(row, "member-2", "assessment-1");
    expect(result).toEqual({ kind: "foreign" });
  });

  it("reports the learner's key from another assessment as foreign", async () => {
    await expect(lookup(row, "member-1", "assessment-2")).resolves.toEqual({ kind: "foreign" });
  });

  it("reports an unused key as none", async () => {
    await expect(lookup(null, "member-1", "assessment-1")).resolves.toEqual({ kind: "none" });
  });
});
