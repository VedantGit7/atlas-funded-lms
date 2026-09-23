import { describe, expect, it } from "vitest";
import { withTenantTx, type TenantTx } from "@atlas/db";
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
  it.each([
    { name: "concurrent first completion", initialProgress: false, secondCompleted: true },
    { name: "late autosave after completion", initialProgress: true, secondCompleted: false },
  ])(
    "serializes $name without losing completion or duplicating events",
    async ({ initialProgress, secondCompleted }) => {
      const fixture = await createLessonEngineFixture();
      const transaction = <T>(fn: (tx: TenantTx) => Promise<T>) =>
        withTenantTx(lessonTenantTx(fixture, fixture.learnerMembershipId), fn);
      if (initialProgress) {
        await transaction((tx) =>
          recordLessonProgress(tx, learnerCtx(fixture), fixture.publishedLessonId, {
            positionSeconds: 30,
            completed: false,
          }),
        );
      }

      let releaseFirst = () => {};
      let firstWritten = () => {};
      let secondStarted = (_pid: number) => {};
      const commitGate = new Promise<void>((resolve) => {
        releaseFirst = resolve;
      });
      const firstReady = new Promise<void>((resolve) => {
        firstWritten = resolve;
      });
      const secondPid = new Promise<number>((resolve) => {
        secondStarted = resolve;
      });
      const first = transaction(async (tx) => {
        const result = await recordLessonProgress(
          tx,
          learnerCtx(fixture),
          fixture.publishedLessonId,
          { completed: true },
        );
        firstWritten();
        await commitGate;
        return result;
      });
      await firstReady;
      const second = transaction(async (tx) => {
        const rows = await tx.$queryRaw<Array<{ pid: number }>>`select pg_backend_pid() as pid`;
        const pid = rows[0]?.pid;
        if (pid === undefined) throw new Error("Missing transaction backend PID");
        secondStarted(pid);
        return recordLessonProgress(tx, learnerCtx(fixture), fixture.publishedLessonId, {
          positionSeconds: 60,
          completed: secondCompleted,
        });
      });
      // Observe a real PostgreSQL lock wait before committing the first write.
      // This reproduces the overlap without relying on timer timing or SQL mocks.
      const outcomes = Promise.allSettled([first, second]);
      try {
        const pid = await secondPid;
        await expect
          .poll(async () =>
            transaction(async (tx) => {
              const rows = await tx.$queryRaw<Array<{ waiting: boolean }>>`
                select cardinality(pg_blocking_pids(${pid}::integer)) > 0 as waiting
              `;
              return rows[0]?.waiting ?? false;
            }),
          )
          .toBe(true);
      } finally {
        releaseFirst();
      }
      const results = await outcomes;
      expect(results.map((result) => result.status)).toEqual(["fulfilled", "fulfilled"]);
      for (const result of results) {
        if (result.status === "fulfilled") expect(result.value.data.status).toBe("completed");
      }
      const saved = await transaction((tx) =>
        findLessonProgress({
          tx,
          lessonId: fixture.publishedLessonId,
          membershipId: fixture.learnerMembershipId,
        }),
      );
      expect(saved?.status).toBe("completed");
      expect(saved?.progressPct).toBe(100);
      expect(
        await transaction((tx) =>
          countOutboxLessonCompletedEvents({
            tx,
            lessonId: fixture.publishedLessonId,
            membershipId: fixture.learnerMembershipId,
          }),
        ),
      ).toBe(1);
    },
  );

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
