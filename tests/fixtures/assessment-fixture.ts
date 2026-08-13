import { randomUUID } from "node:crypto";
import { withTenantTx } from "@atlas/db";
import {
  createItemRegistryFixture,
  instructorCtx,
  adminCtx,
  learnerCtx,
  otherInstructorCtx,
  authoringTenantTx,
  type ItemRegistryFixture,
} from "./item-registry-fixture";
import { publishAssessmentForTests } from "../../backend/apps/api/src/server/assessments/assessments.service";

export type AssessmentFixture = ItemRegistryFixture & {
  assessmentId: string;
  mcqItemId: string;
  shortAnswerItemId: string;
};

async function insertMcqItem(args: {
  tx: Parameters<typeof withTenantTx>[1] extends (tx: infer T) => unknown ? T : never;
  tenantId: string;
  instructorMembershipId: string;
  itemId: string;
  optionCorrectId: string;
  optionWrongId: string;
}): Promise<void> {
  await args.tx.$executeRaw`
    insert into items (
      id,
      tenant_id,
      item_type_key,
      stem_json,
      explanation_json,
      status,
      tags,
      created_by_membership_id,
      created_at,
      updated_at
    )
    values (
      ${args.itemId}::uuid,
      ${args.tenantId}::uuid,
      'mcq_single',
      ${JSON.stringify({ stem: "Capital of France?" })}::jsonb,
      ${JSON.stringify({ answerKey: { correctOptionId: args.optionCorrectId } })}::jsonb,
      'PUBLISHED',
      ${["mcq"]}::text[],
      ${args.instructorMembershipId}::uuid,
      now(),
      now()
    )
  `;

  await args.tx.$executeRaw`
    insert into item_options (id, tenant_id, item_id, option_json, is_correct, position, created_at, updated_at)
    values
      (${args.optionCorrectId}::uuid, ${args.tenantId}::uuid, ${args.itemId}::uuid, ${JSON.stringify({ label: "Paris" })}::jsonb, true, 1, now(), now()),
      (${args.optionWrongId}::uuid, ${args.tenantId}::uuid, ${args.itemId}::uuid, ${JSON.stringify({ label: "London" })}::jsonb, false, 2, now(), now())
  `;
}

async function insertShortAnswerItem(args: {
  tx: Parameters<typeof withTenantTx>[1] extends (tx: infer T) => unknown ? T : never;
  tenantId: string;
  instructorMembershipId: string;
  itemId: string;
}): Promise<void> {
  await args.tx.$executeRaw`
    insert into items (
      id,
      tenant_id,
      item_type_key,
      stem_json,
      explanation_json,
      status,
      tags,
      created_by_membership_id,
      created_at,
      updated_at
    )
    values (
      ${args.itemId}::uuid,
      ${args.tenantId}::uuid,
      'short_answer',
      ${JSON.stringify({ stem: "Explain risk management." })}::jsonb,
      ${JSON.stringify({ answerKey: { rubric: "manual" } })}::jsonb,
      'PUBLISHED',
      ${["manual"]}::text[],
      ${args.instructorMembershipId}::uuid,
      now(),
      now()
    )
  `;
}

export async function createAssessmentFixture(): Promise<AssessmentFixture> {
  const base = await createItemRegistryFixture();
  const assessmentId = randomUUID();
  const mcqItemId = randomUUID();
  const shortAnswerItemId = randomUUID();
  const optionCorrectId = randomUUID();
  const optionWrongId = randomUUID();
  const runId = randomUUID().slice(0, 8);

  await withTenantTx(authoringTenantTx(base), async (tx) => {
    await insertMcqItem({
      tx,
      tenantId: base.tenantId,
      instructorMembershipId: base.instructorMembershipId,
      itemId: mcqItemId,
      optionCorrectId,
      optionWrongId,
    });

    await insertShortAnswerItem({
      tx,
      tenantId: base.tenantId,
      instructorMembershipId: base.instructorMembershipId,
      itemId: shortAnswerItemId,
    });

    await tx.$executeRaw`
      insert into assessments (
        id,
        tenant_id,
        slug,
        title,
        assessment_type,
        status,
        config_json,
        created_at,
        updated_at
      )
      values (
        ${assessmentId}::uuid,
        ${base.tenantId}::uuid,
        ${`quiz-${runId}`},
        'Sample Quiz',
        'quiz',
        'DRAFT',
        ${JSON.stringify({
          createdByMembershipId: base.instructorMembershipId,
          attemptsAllowed: 2,
          timeLimitSeconds: 3600,
          passMarkPercent: 70,
          shuffleItems: false,
          shuffleOptions: false,
          secureMode: false,
          proctoringLevel: 0,
          l1ProctoringEnabled: false,
          showAnswersPolicy: "after_submit",
        })}::jsonb,
        now(),
        now()
      )
    `;

    const assessmentItemMcqId = randomUUID();
    const assessmentItemShortId = randomUUID();

    await tx.$executeRaw`
      insert into assessment_items (
        id, tenant_id, assessment_id, item_id, position, points, config_json, created_at
      )
      values
        (${assessmentItemMcqId}::uuid, ${base.tenantId}::uuid, ${assessmentId}::uuid, ${mcqItemId}::uuid, 1, 1, '{"required":true}'::jsonb, now()),
        (${assessmentItemShortId}::uuid, ${base.tenantId}::uuid, ${assessmentId}::uuid, ${shortAnswerItemId}::uuid, 2, 1, '{"required":true}'::jsonb, now())
    `;
  });

  return {
    ...base,
    assessmentId,
    mcqItemId,
    shortAnswerItemId,
  };
}

export async function publishAssessmentFixture(
  fixture: AssessmentFixture,
): Promise<AssessmentFixture> {
  await withTenantTx(authoringTenantTx(fixture), async (tx) => {
    await publishAssessmentForTests(tx, fixture.assessmentId);
  });
  return fixture;
}

export { instructorCtx, adminCtx, learnerCtx, otherInstructorCtx, authoringTenantTx };
