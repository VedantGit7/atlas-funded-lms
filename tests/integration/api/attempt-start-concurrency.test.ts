import { describe, expect, it } from "vitest";
import { withTenantTx } from "@atlas/db";
import { startAttempt } from "../../../backend/apps/api/src/server/attempts/attempts.service";
import {
  authoringTenantTx,
  createAssessmentFixture,
  learnerCtx,
  otherInstructorCtx,
  publishAssessmentFixture,
  type AssessmentFixture,
} from "../../fixtures/assessment-fixture";

/**
 * Audit M2 against Postgres. Starting an attempt counted the learner's
 * attempts and then inserted one, so concurrent starts each saw room under
 * the limit and all inserted. The key lookup also searched the whole tenant,
 * so another learner's key returned their attempt.
 */
const suite =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

const start = (fixture: AssessmentFixture, key: string) =>
  withTenantTx(authoringTenantTx(fixture, fixture.learnerMembershipId), (tx) =>
    startAttempt(tx, learnerCtx(fixture, `req_${key}`), fixture.assessmentId, key),
  );

const countAttempts = (fixture: AssessmentFixture) =>
  withTenantTx(authoringTenantTx(fixture), async (tx) => {
    const rows = await tx.$queryRaw<Array<{ n: number }>>`
      select count(*)::int as n
      from attempts
      where assessment_id = ${fixture.assessmentId}::uuid
        and membership_id = ${fixture.learnerMembershipId}::uuid
    `;
    return rows[0]?.n ?? 0;
  });

suite("attempt start limits under concurrency (audit M2)", () => {
  it("never lets concurrent starts exceed attemptsAllowed", async () => {
    // The fixture allows two attempts.
    const fixture = await publishAssessmentFixture(await createAssessmentFixture());
    const results = await Promise.allSettled(
      Array.from({ length: 6 }, (_, index) => start(fixture, `m2-race-${String(index)}`)),
    );

    const started = results.filter((result) => result.status === "fulfilled");
    const refused = results.filter((result) => result.status === "rejected");
    expect(started).toHaveLength(2);
    expect(refused).toHaveLength(4);
    for (const result of refused) {
      expect((result as PromiseRejectedResult).reason).toMatchObject({
        status: 409,
        message: expect.stringContaining("Maximum attempts"),
      });
    }
    expect(await countAttempts(fixture)).toBe(2);
  });

  it("returns one attempt for concurrent retries with the same key", async () => {
    const fixture = await publishAssessmentFixture(await createAssessmentFixture());
    const results = await Promise.all(
      Array.from({ length: 4 }, () => start(fixture, "m2-same-key")),
    );

    expect(new Set(results.map((result) => result.data.id)).size).toBe(1);
    expect(await countAttempts(fixture)).toBe(1);
  });

  it("never hands another learner's attempt to a reused key", async () => {
    const fixture = await publishAssessmentFixture(await createAssessmentFixture());
    const mine = await start(fixture, "m2-shared-key");

    const other = withTenantTx(
      authoringTenantTx(fixture, fixture.otherInstructorMembershipId),
      (tx) =>
        startAttempt(
          tx,
          otherInstructorCtx(fixture, "req_m2_other"),
          fixture.assessmentId,
          "m2-shared-key",
        ),
    );

    await expect(other).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT", status: 409 });
    await expect(other).rejects.not.toMatchObject({
      message: expect.stringContaining(mine.data.id),
    });
  });
});
