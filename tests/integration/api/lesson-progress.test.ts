import { describe, expect, it } from "vitest";
import { withTenantTx } from "@atlas/db";
import { recordLessonProgress } from "../../../backend/apps/api/src/server/lessons/lesson-progress.service";
import {
  countOutboxLessonCompletedEvents,
  findLessonProgress,
} from "../../../backend/apps/api/src/server/lessons/lesson-progress.repository";
import {
  createLessonEngineFixture,
  learnerCtx,
  lessonTenantTx,
} from "../../fixtures/lesson-engine-fixture";

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

describeWithDb("lesson progress integration", () => {
  it("writes resume position", async () => {
    const fixture = await createLessonEngineFixture();

    const result = await withTenantTx(
      lessonTenantTx(fixture, fixture.learnerMembershipId),
      async (tx) =>
        recordLessonProgress(
          tx,
          learnerCtx(fixture, "req_progress_resume"),
          fixture.publishedLessonId,
          {
            positionSeconds: 120,
            completed: false,
          },
        ),
    );

    expect(result.data.status).toBe("in_progress");
    expect(result.data.progressPct).toBeGreaterThan(0);
  });

  it("marks lesson complete and emits outbox once", async () => {
    const fixture = await createLessonEngineFixture();
    const ctx = learnerCtx(fixture, "req_progress_complete");

    const first = await withTenantTx(
      lessonTenantTx(fixture, fixture.learnerMembershipId),
      async (tx) =>
        recordLessonProgress(tx, ctx, fixture.publishedLessonId, {
          positionSeconds: 600,
          completed: true,
        }),
    );

    expect(first.data.status).toBe("completed");

    const duplicate = await withTenantTx(
      lessonTenantTx(fixture, fixture.learnerMembershipId),
      async (tx) =>
        recordLessonProgress(
          tx,
          learnerCtx(fixture, "req_progress_complete_duplicate"),
          fixture.publishedLessonId,
          {
            completed: true,
          },
        ),
    );

    expect(duplicate.data.status).toBe("completed");

    const outboxCount = await withTenantTx(
      lessonTenantTx(fixture, fixture.learnerMembershipId),
      async (tx) =>
        countOutboxLessonCompletedEvents({
          tx,
          lessonId: fixture.publishedLessonId,
          membershipId: fixture.learnerMembershipId,
        }),
    );

    expect(outboxCount).toBe(1);
  });

  it("persists completed progress after reload", async () => {
    const fixture = await createLessonEngineFixture();

    await withTenantTx(lessonTenantTx(fixture, fixture.learnerMembershipId), async (tx) =>
      recordLessonProgress(tx, learnerCtx(fixture), fixture.publishedLessonId, {
        completed: true,
      }),
    );

    const progress = await withTenantTx(
      lessonTenantTx(fixture, fixture.learnerMembershipId),
      async (tx) =>
        findLessonProgress({
          tx,
          lessonId: fixture.publishedLessonId,
          membershipId: fixture.learnerMembershipId,
        }),
    );

    expect(progress?.status).toBe("completed");
  });
});
