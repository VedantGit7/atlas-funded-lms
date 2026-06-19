import { describe, expect, it } from "vitest";
import { withTenantTx } from "@atlas/db";
import {
  createAssessment,
  deleteAssessment,
  submitAssessmentForReview,
  updateAssessment,
} from "../../../apps/web/src/server/assessments/assessments.service";
import {
  saveAttemptAnswer,
  startAttempt,
  submitAttempt,
  getAttempt,
} from "../../../apps/web/src/server/attempts/attempts.service";
import {
  createAssessmentFixture,
  instructorCtx,
  learnerCtx,
  publishAssessmentFixture,
  authoringTenantTx,
} from "../../fixtures/assessment-fixture";

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

describeWithDb("assessment integration", () => {
  it("creates draft assessment with server-side author", async () => {
    const fixture = await createAssessmentFixture();
    const ctx = instructorCtx(fixture, "req_create_assessment");

    const created = await withTenantTx(authoringTenantTx(fixture), async (tx) =>
      createAssessment(tx, ctx, {
        title: "New Quiz",
        assessmentType: "quiz",
        config: { attemptsAllowed: 1, passMarkPercent: 60 },
      }),
    );

    expect(created.data.status).toBe("DRAFT");

    await withTenantTx(authoringTenantTx(fixture), async (tx) => {
      const row = await tx.$queryRaw<Array<{ config_json: { createdByMembershipId?: string } }>>`
        select config_json
        from assessments
        where id = ${created.data.id}::uuid
        limit 1
      `;
      expect(row[0]?.config_json.createdByMembershipId).toBe(fixture.instructorMembershipId);
    });
  });

  it("author updates draft assessment", async () => {
    const fixture = await createAssessmentFixture();
    const ctx = instructorCtx(fixture, "req_update_assessment");

    const updated = await withTenantTx(authoringTenantTx(fixture), async (tx) =>
      updateAssessment(tx, ctx, fixture.assessmentId, {
        title: "Updated Quiz",
        items: [
          {
            itemId: fixture.mcqItemId,
            position: 1,
            points: 2,
            required: true,
          },
        ],
      }),
    );

    expect(updated.data.title).toBe("Updated Quiz");
    expect(updated.data.items).toHaveLength(1);
  });

  it("delete soft deletes and audits", async () => {
    const fixture = await createAssessmentFixture();
    const ctx = instructorCtx(fixture, "req_delete_assessment");

    await withTenantTx(authoringTenantTx(fixture), async (tx) => {
      await deleteAssessment(tx, ctx, fixture.assessmentId);

      const rows = await tx.$queryRaw<Array<{ deleted_at: Date | null }>>`
        select deleted_at from assessments where id = ${fixture.assessmentId}::uuid
      `;
      expect(rows[0]?.deleted_at).toBeTruthy();

      const audit = await tx.$queryRaw<Array<{ action: string }>>`
        select action
        from audit_entries
        where target_id = ${fixture.assessmentId}
          and action = 'assessment.deleted'
        limit 1
      `;
      expect(audit).toHaveLength(1);
    });
  });

  it("publish submits for review and does not publish directly", async () => {
    const fixture = await createAssessmentFixture();
    const ctx = instructorCtx(fixture, "req_publish_assessment");

    const result = await withTenantTx(authoringTenantTx(fixture), async (tx) =>
      submitAssessmentForReview(tx, ctx, fixture.assessmentId, {}),
    );

    expect(result.data.status).toBe("REVIEW");

    await withTenantTx(authoringTenantTx(fixture), async (tx) => {
      const assessment = await tx.$queryRaw<Array<{ status: string }>>`
        select status::text from assessments where id = ${fixture.assessmentId}::uuid
      `;
      expect(assessment[0]?.status).toBe("REVIEW");
    });
  });

  it("rejects publish when assessment has no items", async () => {
    const fixture = await createAssessmentFixture();
    const ctx = instructorCtx(fixture, "req_publish_empty");

    const created = await withTenantTx(authoringTenantTx(fixture), async (tx) =>
      createAssessment(tx, ctx, {
        title: "Empty Quiz",
        assessmentType: "quiz",
        config: {},
      }),
    );

    await expect(
      withTenantTx(authoringTenantTx(fixture), async (tx) =>
        submitAssessmentForReview(tx, ctx, created.data.id, {}),
      ),
    ).rejects.toMatchObject({ status: 409 });
  });
});

describeWithDb("attempt integration", () => {
  it("learner starts published assessment and emits started event", async () => {
    const fixture = await publishAssessmentFixture(await createAssessmentFixture());
    const ctx = learnerCtx(fixture, "req_start_attempt");

    const started = await withTenantTx(
      authoringTenantTx(fixture, fixture.learnerMembershipId),
      async (tx) => startAttempt(tx, ctx, fixture.assessmentId, "idem-start-1"),
    );

    expect(started.data.status).toBe("STARTED");

    await withTenantTx(authoringTenantTx(fixture), async (tx) => {
      const events = await tx.$queryRaw<Array<{ event_type: string }>>`
        select event_type
        from outbox_events
        where aggregate_id = ${started.data.id}
          and event_type = 'assessment.started'
        limit 1
      `;
      expect(events).toHaveLength(1);
    });
  });

  it("get attempt returns no correct answers", async () => {
    const fixture = await publishAssessmentFixture(await createAssessmentFixture());
    const learner = learnerCtx(fixture, "req_get_attempt");

    const started = await withTenantTx(
      authoringTenantTx(fixture, fixture.learnerMembershipId),
      async (tx) => startAttempt(tx, learner, fixture.assessmentId, "idem-start-2"),
    );

    const attempt = await withTenantTx(
      authoringTenantTx(fixture, fixture.learnerMembershipId),
      async (tx) => getAttempt(tx, learner, started.data.id),
    );

    const serialized = JSON.stringify(attempt.data);
    expect(serialized).not.toContain("answerKey");
    expect(serialized).not.toContain("isCorrect");
    expect(serialized).not.toContain("is_correct");
  });

  it("autosave answer idempotently replays", async () => {
    const fixture = await publishAssessmentFixture(await createAssessmentFixture());
    const learner = learnerCtx(fixture, "req_save_answer");

    const started = await withTenantTx(
      authoringTenantTx(fixture, fixture.learnerMembershipId),
      async (tx) => startAttempt(tx, learner, fixture.assessmentId, "idem-start-3"),
    );

    const first = await withTenantTx(
      authoringTenantTx(fixture, fixture.learnerMembershipId),
      async (tx) =>
        saveAttemptAnswer(
          tx,
          learner,
          started.data.id,
          { itemId: fixture.mcqItemId, answerJson: { selectedOptionId: "opt" } },
          "idem-answer-1",
        ),
    );

    const second = await withTenantTx(
      authoringTenantTx(fixture, fixture.learnerMembershipId),
      async (tx) =>
        saveAttemptAnswer(
          tx,
          learner,
          started.data.id,
          { itemId: fixture.mcqItemId, answerJson: { selectedOptionId: "opt" } },
          "idem-answer-1",
        ),
    );

    expect(second.data.savedAt).toBe(first.data.savedAt);
  });

  it("submit scores objective items and flags manual grading", async () => {
    const fixture = await publishAssessmentFixture(await createAssessmentFixture());
    const learner = learnerCtx(fixture, "req_submit_attempt");

    const started = await withTenantTx(
      authoringTenantTx(fixture, fixture.learnerMembershipId),
      async (tx) => startAttempt(tx, learner, fixture.assessmentId, "idem-start-4"),
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

    const mcqAssessmentItem = assessmentItems.find((row) => row.item_id === fixture.mcqItemId);
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

    await withTenantTx(authoringTenantTx(fixture, fixture.learnerMembershipId), async (tx) => {
      if (mcqAssessmentItem && correctOption) {
        await saveAttemptAnswer(
          tx,
          learner,
          started.data.id,
          { itemId: fixture.mcqItemId, answerJson: { selectedOptionId: correctOption } },
          "idem-answer-mcq",
        );
      }

      const shortItem = assessmentItems.find((row) => row.item_id === fixture.shortAnswerItemId);
      if (shortItem) {
        await saveAttemptAnswer(
          tx,
          learner,
          started.data.id,
          { itemId: fixture.shortAnswerItemId, answerJson: { value: "Risk first" } },
          "idem-answer-short",
        );
      }

      const submitted = await submitAttempt(tx, learner, started.data.id, "idem-submit-1");
      expect(submitted.data.requiresManualGrading).toBe(true);
      expect(submitted.data.status).toBe("SUBMITTED");

      const events = await tx.$queryRaw<Array<{ event_type: string }>>`
        select event_type
        from outbox_events
        where aggregate_id = ${started.data.id}
          and event_type = 'assessment.submitted'
        limit 1
      `;
      expect(events).toHaveLength(1);
    });
  });
});
