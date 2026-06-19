import { describe, expect, it } from "vitest";
import { withTenantTx } from "@atlas/db";
import {
  getGradingTaskDetail,
  gradeGradingTask,
  listGradingTasks,
} from "../../apps/web/src/server/grading/grading.service";
import {
  createAssessmentFixture,
  instructorCtx,
  learnerCtx,
  publishAssessmentFixture,
  authoringTenantTx,
} from "../fixtures/assessment-fixture";
import { createTenantIsolationFixture, tenantCtx } from "./tenant-isolation-fixture";
import {
  saveAttemptAnswer,
  startAttempt,
  submitAttempt,
} from "../../apps/web/src/server/attempts/attempts.service";

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

describeWithDb("grading tenant isolation", () => {
  it("Tenant A cannot read Tenant B grading task by id", async () => {
    const fixtureA = await publishAssessmentFixture(await createAssessmentFixture());
    const learner = learnerCtx(fixtureA, "iso_grading_read");

    const started = await withTenantTx(
      authoringTenantTx(fixtureA, fixtureA.learnerMembershipId),
      async (tx) => startAttempt(tx, learner, fixtureA.assessmentId, "iso-start-grade"),
    );

    await withTenantTx(authoringTenantTx(fixtureA, fixtureA.learnerMembershipId), async (tx) => {
      await saveAttemptAnswer(
        tx,
        learner,
        started.data.id,
        { itemId: fixtureA.shortAnswerItemId, answerJson: { value: "Answer" } },
        "iso-answer-grade",
      );
      await submitAttempt(tx, learner, started.data.id, "iso-submit-grade");
    });

    const taskRows = await withTenantTx(
      authoringTenantTx(fixtureA),
      async (tx) =>
        tx.$queryRaw<Array<{ id: string }>>`
        select id::text from grading_tasks where attempt_id = ${started.data.id}::uuid limit 1
      `,
    );
    const taskId = taskRows[0]?.id ?? "";
    const isolation = await createTenantIsolationFixture();

    await expect(
      withTenantTx(tenantCtx(isolation.tenantB), async (tx) =>
        getGradingTaskDetail(tx, instructorCtx(fixtureA, "iso_detail"), taskId),
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("Tenant A cannot grade Tenant B task by id", async () => {
    const fixtureA = await publishAssessmentFixture(await createAssessmentFixture());
    const learner = learnerCtx(fixtureA, "iso_grading_grade");

    const started = await withTenantTx(
      authoringTenantTx(fixtureA, fixtureA.learnerMembershipId),
      async (tx) => startAttempt(tx, learner, fixtureA.assessmentId, "iso-start-grade-2"),
    );

    await withTenantTx(authoringTenantTx(fixtureA, fixtureA.learnerMembershipId), async (tx) => {
      await saveAttemptAnswer(
        tx,
        learner,
        started.data.id,
        { itemId: fixtureA.shortAnswerItemId, answerJson: { value: "Answer" } },
        "iso-answer-grade-2",
      );
      await submitAttempt(tx, learner, started.data.id, "iso-submit-grade-2");
    });

    const taskRows = await withTenantTx(
      authoringTenantTx(fixtureA),
      async (tx) =>
        tx.$queryRaw<Array<{ id: string }>>`
        select id::text from grading_tasks where attempt_id = ${started.data.id}::uuid limit 1
      `,
    );
    const taskId = taskRows[0]?.id ?? "";
    const isolation = await createTenantIsolationFixture();

    await expect(
      withTenantTx(tenantCtx(isolation.tenantB), async (tx) =>
        gradeGradingTask(
          tx,
          { ...instructorCtx(fixtureA, "iso_grade"), idempotencyKey: "grade-key-55555555" },
          taskId,
          { score: 1, feedback: "Nope" },
        ),
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("Tenant A cannot list Tenant B grading tasks through service filters", async () => {
    const fixtureA = await publishAssessmentFixture(await createAssessmentFixture());
    const isolation = await createTenantIsolationFixture();

    const queue = await withTenantTx(tenantCtx(isolation.tenantB), async (tx) =>
      listGradingTasks(tx, instructorCtx(fixtureA, "iso_list"), { assignedTo: "me", limit: 25 }),
    );

    expect(queue.data).toHaveLength(0);
  });
});
