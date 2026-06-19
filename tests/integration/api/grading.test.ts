import { describe, expect, it } from "vitest";
import { withTenantTx } from "@atlas/db";
import {
  saveAttemptAnswer,
  startAttempt,
  submitAttempt,
} from "../../../apps/web/src/server/attempts/attempts.service";
import {
  getGradingTaskDetail,
  gradeGradingTask,
  listGradingTasks,
} from "../../../apps/web/src/server/grading/grading.service";
import {
  adminCtx,
  createAssessmentFixture,
  instructorCtx,
  learnerCtx,
  otherInstructorCtx,
  publishAssessmentFixture,
  authoringTenantTx,
} from "../../fixtures/assessment-fixture";
import {
  createTenantIsolationFixture,
  tenantCtx,
} from "../../tenant-isolation/tenant-isolation-fixture";

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

async function submitManualAttempt(fixture: Awaited<ReturnType<typeof createAssessmentFixture>>) {
  const learner = learnerCtx(fixture, "req_grading_submit");

  const started = await withTenantTx(
    authoringTenantTx(fixture, fixture.learnerMembershipId),
    async (tx) => startAttempt(tx, learner, fixture.assessmentId, `idem-${Date.now()}`),
  );

  const assessmentItems = await withTenantTx(
    authoringTenantTx(fixture),
    async (tx) =>
      tx.$queryRaw<Array<{ id: string; item_id: string }>>`
        select id::text, item_id::text
        from assessment_items
        where assessment_id = ${fixture.assessmentId}::uuid
        order by position asc
      `,
  );

  const options = await withTenantTx(
    authoringTenantTx(fixture),
    async (tx) =>
      tx.$queryRaw<Array<{ id: string; is_correct: boolean | null }>>`
        select id::text, is_correct
        from item_options
        where item_id = ${fixture.mcqItemId}::uuid
      `,
  );
  const correctOption = options.find((option) => option.is_correct)?.id;
  const mcqAssessmentItem = assessmentItems.find((row) => row.item_id === fixture.mcqItemId);
  const shortItem = assessmentItems.find((row) => row.item_id === fixture.shortAnswerItemId);

  await withTenantTx(authoringTenantTx(fixture, fixture.learnerMembershipId), async (tx) => {
    if (mcqAssessmentItem && correctOption) {
      await saveAttemptAnswer(
        tx,
        learner,
        started.data.id,
        { itemId: fixture.mcqItemId, answerJson: { selectedOptionId: correctOption } },
        "idem-mcq-grade",
      );
    }

    if (shortItem) {
      await saveAttemptAnswer(
        tx,
        learner,
        started.data.id,
        { itemId: fixture.shortAnswerItemId, answerJson: { value: "Risk management basics" } },
        "idem-short-grade",
      );
    }

    await submitAttempt(tx, learner, started.data.id, "idem-submit-grade");
  });

  const taskRows = await withTenantTx(
    authoringTenantTx(fixture),
    async (tx) =>
      tx.$queryRaw<Array<{ id: string }>>`
      select id::text
      from grading_tasks
      where attempt_id = ${started.data.id}::uuid
      limit 1
    `,
  );

  return {
    attemptId: started.data.id,
    taskId: taskRows[0]?.id ?? "",
  };
}

describeWithDb("grading integration", () => {
  it("creates grading task when manual item is submitted", async () => {
    const fixture = await publishAssessmentFixture(await createAssessmentFixture());
    const { taskId } = await submitManualAttempt(fixture);
    expect(taskId).toBeTruthy();
  });

  it("assigned grader sees pending task in queue", async () => {
    const fixture = await publishAssessmentFixture(await createAssessmentFixture());
    await submitManualAttempt(fixture);
    const instructor = instructorCtx(fixture, "req_list_grading");

    const queue = await withTenantTx(authoringTenantTx(fixture), async (tx) =>
      listGradingTasks(tx, instructor, { assignedTo: "me", limit: 25 }),
    );

    expect(queue.data.length).toBeGreaterThan(0);
    expect(queue.data[0]?.status).toBe("PENDING");
    expect(JSON.stringify(queue.data)).not.toContain("tenant_id");
  });

  it("unrelated instructor does not see task", async () => {
    const fixture = await publishAssessmentFixture(await createAssessmentFixture());
    await submitManualAttempt(fixture);
    const other = otherInstructorCtx(fixture, "req_list_other");

    const queue = await withTenantTx(authoringTenantTx(fixture), async (tx) =>
      listGradingTasks(tx, other, { assignedTo: "me", limit: 25 }),
    );

    expect(queue.data).toHaveLength(0);
  });

  it("admin can list all tasks", async () => {
    const fixture = await publishAssessmentFixture(await createAssessmentFixture());
    await submitManualAttempt(fixture);
    const admin = adminCtx(fixture, "req_list_all");

    const queue = await withTenantTx(
      authoringTenantTx(fixture, fixture.adminMembershipId),
      async (tx) => listGradingTasks(tx, admin, { assignedTo: "all", limit: 25 }),
    );

    expect(queue.data.length).toBeGreaterThan(0);
  });

  it("assigned grader can read detail with answer panel data", async () => {
    const fixture = await publishAssessmentFixture(await createAssessmentFixture());
    const { taskId } = await submitManualAttempt(fixture);
    const instructor = instructorCtx(fixture, "req_detail_grading");

    const detail = await withTenantTx(authoringTenantTx(fixture), async (tx) =>
      getGradingTaskDetail(tx, instructor, taskId),
    );

    expect(detail.data.answers.length).toBeGreaterThan(0);
    expect(detail.data.proctoringTimeline).toEqual([]);
    expect(detail.data.learner.displayName).toBeTruthy();
  });

  it("grades task, writes audit and outbox, and updates attempt", async () => {
    const fixture = await publishAssessmentFixture(await createAssessmentFixture());
    const { taskId, attemptId } = await submitManualAttempt(fixture);
    const instructor = instructorCtx(fixture, "req_grade_task");

    const graded = await withTenantTx(authoringTenantTx(fixture), async (tx) =>
      gradeGradingTask(tx, { ...instructor, idempotencyKey: "grade-key-12345678" }, taskId, {
        score: 1,
        feedback: "Good explanation of risk management.",
      }),
    );

    expect(graded.data.status).toBe("GRADED");
    expect(graded.data.attemptStatus).toBe("GRADED");

    await withTenantTx(authoringTenantTx(fixture), async (tx) => {
      const audit = await tx.$queryRaw<Array<{ action: string }>>`
        select action
        from audit_entries
        where target_id = ${taskId}
          and action = 'assessment.grade_changed'
        limit 1
      `;
      expect(audit).toHaveLength(1);

      const outbox = await tx.$queryRaw<Array<{ event_type: string }>>`
        select event_type
        from outbox_events
        where aggregate_id = ${attemptId}
          and event_type = 'assessment.graded'
        limit 1
      `;
      expect(outbox).toHaveLength(1);

      const task = await tx.$queryRaw<Array<{ status: string }>>`
        select status from grading_tasks where id = ${taskId}::uuid
      `;
      expect(task[0]?.status).toBe("graded");
    });
  });

  it("rejects score above max", async () => {
    const fixture = await publishAssessmentFixture(await createAssessmentFixture());
    const { taskId } = await submitManualAttempt(fixture);
    const instructor = instructorCtx(fixture, "req_grade_invalid");

    await expect(
      withTenantTx(authoringTenantTx(fixture), async (tx) =>
        gradeGradingTask(tx, { ...instructor, idempotencyKey: "grade-key-99999999" }, taskId, {
          score: 999,
          feedback: "Too high",
        }),
      ),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("rejects grading already graded task without idempotency replay", async () => {
    const fixture = await publishAssessmentFixture(await createAssessmentFixture());
    const { taskId } = await submitManualAttempt(fixture);
    const instructor = instructorCtx(fixture, "req_grade_conflict");

    await withTenantTx(authoringTenantTx(fixture), async (tx) =>
      gradeGradingTask(tx, { ...instructor, idempotencyKey: "grade-key-11111111" }, taskId, {
        score: 1,
        feedback: "First grade",
      }),
    );

    await expect(
      withTenantTx(authoringTenantTx(fixture), async (tx) =>
        gradeGradingTask(tx, { ...instructor, idempotencyKey: "grade-key-22222222" }, taskId, {
          score: 1,
          feedback: "Second grade",
        }),
      ),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("idempotency replay does not duplicate audit/outbox rows", async () => {
    const fixture = await publishAssessmentFixture(await createAssessmentFixture());
    const { taskId } = await submitManualAttempt(fixture);
    const instructor = instructorCtx(fixture, "req_grade_replay");
    const idempotencyKey = "grade-key-33333333";

    await withTenantTx(authoringTenantTx(fixture), async (tx) =>
      gradeGradingTask(tx, { ...instructor, idempotencyKey }, taskId, {
        score: 1,
        feedback: "Replay grade",
      }),
    );

    await withTenantTx(authoringTenantTx(fixture), async (tx) =>
      gradeGradingTask(tx, { ...instructor, idempotencyKey }, taskId, {
        score: 1,
        feedback: "Replay grade",
      }),
    );

    await withTenantTx(authoringTenantTx(fixture), async (tx) => {
      const auditCount = await tx.$queryRaw<Array<{ count: bigint }>>`
        select count(*)::bigint as count
        from audit_entries
        where target_id = ${taskId}
          and action = 'assessment.grade_changed'
      `;
      expect(Number(auditCount[0]?.count ?? 0n)).toBe(1);

      const outboxCount = await tx.$queryRaw<Array<{ count: bigint }>>`
        select count(*)::bigint as count
        from outbox_events
        where event_type = 'assessment.graded'
          and payload_json ->> 'gradingTaskId' = ${taskId}
      `;
      expect(Number(outboxCount[0]?.count ?? 0n)).toBe(1);
    });
  });
});

describeWithDb("grading tenant isolation", () => {
  it("blocks cross-tenant grading task read", async () => {
    const fixtureA = await publishAssessmentFixture(await createAssessmentFixture());
    const { taskId } = await submitManualAttempt(fixtureA);
    const isolation = await createTenantIsolationFixture();

    await expect(
      withTenantTx(tenantCtx(isolation.tenantB), async (tx) =>
        getGradingTaskDetail(tx, instructorCtx(fixtureA, "iso_read"), taskId),
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("blocks cross-tenant grading mutation", async () => {
    const fixtureA = await publishAssessmentFixture(await createAssessmentFixture());
    const { taskId } = await submitManualAttempt(fixtureA);
    const isolation = await createTenantIsolationFixture();

    await expect(
      withTenantTx(tenantCtx(isolation.tenantB), async (tx) =>
        gradeGradingTask(
          tx,
          { ...instructorCtx(fixtureA, "iso_grade"), idempotencyKey: "grade-key-44444444" },
          taskId,
          { score: 1, feedback: "Cross tenant" },
        ),
      ),
    ).rejects.toMatchObject({ status: 404 });
  });
});
