import { randomUUID } from "node:crypto";
import { withTenantTx } from "@atlas/db";
import {
  adminCtx,
  authoringTenantTx,
  createCompetencyConfigFixture,
  seedDimension,
  seedScoringProfile,
  type CompetencyConfigFixture,
} from "./competency-config-fixture";
import {
  createAssessmentFixture,
  learnerCtx,
  publishAssessmentFixture,
  type AssessmentFixture,
} from "./assessment-fixture";
import {
  publishScoringConfig,
  replaceProfileBands,
} from "../../backend/apps/api/src/server/competency/scoring-config.service";
import {
  saveAttemptAnswer,
  startAttempt,
  submitAttempt,
} from "../../backend/apps/api/src/server/attempts/attempts.service";
import { handleCompetencyOutboxEvent } from "../../backend/apps/api/src/server/competency/competency.worker";

export type CompetencyProjectionFixture = AssessmentFixture & {
  dimensionId: string;
  profileId: string;
};

export async function createCompetencyProjectionFixture(): Promise<CompetencyProjectionFixture> {
  const base = await publishAssessmentFixture(await createAssessmentFixture());
  const configFixture = base as CompetencyConfigFixture;
  const ctx = adminCtx(configFixture);

  const dimensionId = await seedDimension(configFixture, {
    key: "execution_skill",
    name: "Execution Skill",
  });

  const profileId = await seedScoringProfile(configFixture, {
    key: "default",
    name: "Default Profile",
  });

  await withTenantTx(
    authoringTenantTx(configFixture, configFixture.adminMembershipId),
    async (tx) => {
      await tx.$executeRaw`
      insert into item_dimension_weights (
        id, tenant_id, item_id, dimension_id, weight, created_at
      )
      values (
        ${randomUUID()}::uuid,
        ${configFixture.tenantId}::uuid,
        ${base.mcqItemId}::uuid,
        ${dimensionId}::uuid,
        1.0,
        now()
      )
    `;

      await replaceProfileBands(tx, ctx, profileId, {
        bands: [
          {
            key: "developing",
            label: "Developing",
            minScore: 0,
            maxScore: 59.9999,
            sortOrder: 1,
          },
          {
            key: "proficient",
            label: "Proficient",
            minScore: 60,
            maxScore: 100,
            sortOrder: 2,
          },
        ],
      });

      await publishScoringConfig(tx, ctx, profileId, {});
    },
  );

  return {
    ...base,
    dimensionId,
    profileId,
  };
}

export async function submitScoredMcqAttempt(fixture: CompetencyProjectionFixture) {
  const learner = learnerCtx(fixture, "req_competency_projection");
  const started = await withTenantTx(
    authoringTenantTx(fixture, fixture.learnerMembershipId),
    async (tx) =>
      startAttempt(tx, learner, fixture.assessmentId, `idem-start-${randomUUID().slice(0, 8)}`),
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
  if (!correctOption) {
    throw new Error("Missing correct MCQ option.");
  }

  await withTenantTx(authoringTenantTx(fixture, fixture.learnerMembershipId), async (tx) => {
    await saveAttemptAnswer(
      tx,
      learner,
      started.data.id,
      { itemId: fixture.mcqItemId, answerJson: { selectedOptionId: correctOption } },
      `idem-answer-${randomUUID().slice(0, 8)}`,
    );

    await submitAttempt(tx, learner, started.data.id, `idem-submit-${randomUUID().slice(0, 8)}`);
  });

  return started.data.id;
}

export async function processLatestAssessmentSubmittedEvent(fixture: CompetencyProjectionFixture) {
  const event = await withTenantTx(authoringTenantTx(fixture), async (tx) => {
    const rows = await tx.$queryRaw<
      Array<{ id: string; payload_json: unknown; metadata_json: { requestId?: string } | null }>
    >`
      select id::text, payload_json, metadata_json
      from outbox_events
      where tenant_id = ${fixture.tenantId}::uuid
        and event_type = 'assessment.submitted'
      order by occurred_at desc
      limit 1
    `;
    return rows[0] ?? null;
  });

  if (!event) {
    throw new Error("Missing assessment.submitted outbox event.");
  }

  await handleCompetencyOutboxEvent({
    id: event.id,
    eventType: "assessment.submitted",
    tenantId: fixture.tenantId,
    payload: event.payload_json,
    requestId: event.metadata_json?.requestId ?? "req_projection_worker",
  });
}

export async function seedPracticeSessionWithSignal(fixture: CompetencyProjectionFixture) {
  const sessionId = randomUUID();
  const responseId = randomUUID();

  await withTenantTx(authoringTenantTx(fixture), async (tx) => {
    await tx.$executeRaw`
      insert into practice_sessions (
        id, tenant_id, membership_id, session_type, status, started_at, completed_at, idempotency_key
      )
      values (
        ${sessionId}::uuid,
        ${fixture.tenantId}::uuid,
        ${fixture.learnerMembershipId}::uuid,
        'swipe',
        'completed',
        now(),
        now(),
        ${`practice-${sessionId}`}
      )
    `;

    await tx.$executeRaw`
      insert into practice_responses (
        id, tenant_id, practice_session_id, membership_id, item_id, response_json, is_correct, idempotency_key, occurred_at
      )
      values (
        ${responseId}::uuid,
        ${fixture.tenantId}::uuid,
        ${sessionId}::uuid,
        ${fixture.learnerMembershipId}::uuid,
        ${fixture.mcqItemId}::uuid,
        '{"selectedOptionId":"opt"}'::jsonb,
        true,
        ${`response-${responseId}`},
        now()
      )
    `;

    await tx.$executeRaw`
      insert into outbox_events (
        id,
        tenant_id,
        event_type,
        aggregate_type,
        aggregate_id,
        payload_json,
        metadata_json,
        idempotency_key,
        occurred_at,
        available_at
      )
      values (
        ${randomUUID()}::uuid,
        ${fixture.tenantId}::uuid,
        'practice.session_completed',
        'practice_session',
        ${sessionId}::uuid,
        ${JSON.stringify({
          practiceSessionId: sessionId,
          membershipId: fixture.learnerMembershipId,
          sessionType: "swipe",
        })}::jsonb,
        ${JSON.stringify({ requestId: "req_practice_completed" })}::jsonb,
        ${`practice-completed-${sessionId}`},
        now(),
        now()
      )
    `;
  });

  const event = await withTenantTx(authoringTenantTx(fixture), async (tx) => {
    const rows = await tx.$queryRaw<
      Array<{ id: string; payload_json: unknown; metadata_json: { requestId?: string } | null }>
    >`
      select id::text, payload_json, metadata_json
      from outbox_events
      where aggregate_id = ${sessionId}
        and event_type = 'practice.session_completed'
      limit 1
    `;
    return rows[0] ?? null;
  });

  if (!event) throw new Error("Missing practice.session_completed event.");

  await handleCompetencyOutboxEvent({
    id: event.id,
    eventType: "practice.session_completed",
    tenantId: fixture.tenantId,
    payload: event.payload_json,
    requestId: event.metadata_json?.requestId ?? "req_practice_completed",
  });
}

export { adminCtx, learnerCtx, authoringTenantTx, createCompetencyConfigFixture };
