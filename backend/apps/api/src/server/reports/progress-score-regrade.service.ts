import type { TenantTx } from "@atlas/db";
import type { ServiceCtx } from "@atlas/domain/shared/domain.types";
import {
  regradeScoreAttemptsResponseSchema,
  type RegradeScoreAttemptsBody,
} from "@atlas/domain/reports/progress-score-roster.dto";
import { progressScoreAssessmentNotFound } from "@atlas/domain/reports/progress-score-roster.errors";
import { scoreAttempt, type ScoringItem } from "../assessments/scoring.service";
import { decodeExplanationJson } from "../item-registry/item-registry.repository";
import { sendScoreRosterMessage } from "./progress-score-roster-actions.service";

async function loadScoringItems(tx: TenantTx, assessmentId: string): Promise<ScoringItem[]> {
  const rows = await tx.$queryRaw<
    Array<{
      assessment_item_id: string;
      item_id: string;
      item_type_key: string;
      points: number;
      explanation_json: unknown;
    }>
  >`
    select
      ai.id::text as assessment_item_id,
      ai.item_id::text as item_id,
      i.item_type_key,
      ai.points::float as points,
      i.explanation_json
    from assessment_items ai
    join items i on i.id = ai.item_id and i.tenant_id = ai.tenant_id
    where ai.assessment_id = ${assessmentId}::uuid
      and ai.tenant_id = current_setting('app.tenant_id', true)::uuid
      and i.deleted_at is null
    order by ai.position asc
  `;

  if (rows.length === 0) return [];

  const options = await tx.$queryRaw<
    Array<{
      item_id: string;
      id: string;
      is_correct: boolean | null;
      position: number;
    }>
  >`
    select item_id::text as item_id, id::text as id, is_correct, position
    from item_options
    where tenant_id = current_setting('app.tenant_id', true)::uuid
      and item_id = any(${rows.map((r) => r.item_id)}::uuid[])
    order by item_id, position
  `;
  const optionsByItem = new Map<string, ScoringItem["options"]>();
  for (const option of options) {
    const list = optionsByItem.get(option.item_id) ?? [];
    list.push({
      id: option.id,
      isCorrect: option.is_correct,
      position: option.position,
    });
    optionsByItem.set(option.item_id, list);
  }

  return rows.map((row) => {
    const { answerKeyJson } = decodeExplanationJson(row.explanation_json);
    return {
      assessmentItemId: row.assessment_item_id,
      itemId: row.item_id,
      itemTypeKey: row.item_type_key,
      points: Number(row.points),
      answerKeyJson: answerKeyJson ?? {},
      options: optionsByItem.get(row.item_id) ?? [],
    };
  });
}

export async function regradeScoreAttempts(
  tx: TenantTx,
  ctx: ServiceCtx,
  assessmentId: string,
  input: RegradeScoreAttemptsBody,
) {
  const meta = await tx.$queryRaw<Array<{ title: string; config_json: unknown }>>`
    select title, config_json
    from assessments
    where id = ${assessmentId}::uuid
      and deleted_at is null
    limit 1
  `;
  if (!meta[0]) throw progressScoreAssessmentNotFound();

  const config =
    meta[0].config_json &&
    typeof meta[0].config_json === "object" &&
    !Array.isArray(meta[0].config_json)
      ? (meta[0].config_json as Record<string, unknown>)
      : {};
  const answerKeyVersion =
    typeof config["answerKeyVersion"] === "string"
      ? config["answerKeyVersion"]
      : typeof config["version"] === "string"
        ? config["version"]
        : "current";

  const scoringItems = await loadScoringItems(tx, assessmentId);

  let attemptIds = input.attemptIds ?? [];
  if (input.scope === "all") {
    const all = await tx.$queryRaw<Array<{ id: string }>>`
      select id::text as id
      from attempts
      where tenant_id = current_setting('app.tenant_id', true)::uuid
        and assessment_id = ${assessmentId}::uuid
        and status::text in ('SUBMITTED', 'GRADED')
    `;
    attemptIds = all.map((row) => row.id);
  } else if ((input.membershipIds?.length ?? 0) > 0 && attemptIds.length === 0) {
    const latest = await tx.$queryRaw<Array<{ id: string }>>`
      select distinct on (membership_id) id::text as id
      from attempts
      where tenant_id = current_setting('app.tenant_id', true)::uuid
        and assessment_id = ${assessmentId}::uuid
        and membership_id = any(${input.membershipIds ?? []}::uuid[])
        and status::text in ('SUBMITTED', 'GRADED')
      order by membership_id, coalesce(submitted_at, graded_at, started_at) desc
    `;
    attemptIds = latest.map((row) => row.id);
  }

  let regradedCount = 0;
  let skippedCount = 0;
  const membershipIds = new Set<string>();

  for (const attemptId of attemptIds) {
    const attemptRows = await tx.$queryRaw<
      Array<{ id: string; membership_id: string; status: string }>
    >`
      select id::text as id, membership_id::text as membership_id, status::text as status
      from attempts
      where id = ${attemptId}::uuid
        and assessment_id = ${assessmentId}::uuid
        and tenant_id = current_setting('app.tenant_id', true)::uuid
      limit 1
    `;
    const attempt = attemptRows[0];
    if (!attempt || attempt.status === "VOIDED" || attempt.status === "STARTED") {
      skippedCount += 1;
      continue;
    }

    const answers = await tx.$queryRaw<
      Array<{ assessment_item_id: string; answer_json: unknown }>
    >`
      select assessment_item_id::text as assessment_item_id, answer_json
      from attempt_answers
      where attempt_id = ${attemptId}::uuid
        and tenant_id = current_setting('app.tenant_id', true)::uuid
    `;
    const answerMap = new Map<string, Record<string, unknown> | null>();
    for (const answer of answers) {
      answerMap.set(
        answer.assessment_item_id,
        answer.answer_json &&
          typeof answer.answer_json === "object" &&
          !Array.isArray(answer.answer_json)
          ? (answer.answer_json as Record<string, unknown>)
          : null,
      );
    }

    const scored = scoreAttempt({ items: scoringItems, answers: answerMap });
    for (const itemResult of scored.itemResults) {
      await tx.$executeRaw`
        update attempt_answers
        set
          is_correct = ${itemResult.isCorrect},
          points_awarded = ${itemResult.pointsAwarded}
        where attempt_id = ${attemptId}::uuid
          and assessment_item_id = ${itemResult.assessmentItemId}::uuid
          and tenant_id = current_setting('app.tenant_id', true)::uuid
      `;
    }

    const nextStatus = scored.requiresManualGrading ? "SUBMITTED" : "GRADED";
    await tx.$executeRaw`
      update attempts
      set
        score_pct = ${scored.scorePercent},
        status = ${nextStatus}::"AttemptStatus",
        graded_at = case
          when ${scored.requiresManualGrading} then graded_at
          else now()
        end,
        metadata_json = coalesce(metadata_json, '{}'::jsonb) || jsonb_build_object(
          'gradedManually', false,
          'regradedAt', to_jsonb(now()),
          'answerKeyVersion', to_jsonb(${answerKeyVersion}::text)
        )
      where id = ${attemptId}::uuid
        and tenant_id = current_setting('app.tenant_id', true)::uuid
    `;
    membershipIds.add(attempt.membership_id);
    regradedCount += 1;
  }

  let notifiedCount = 0;
  if (input.notifyLearners && membershipIds.size > 0) {
    try {
      const result = await sendScoreRosterMessage(tx, ctx, {
        assessmentId,
        membershipIds: [...membershipIds],
        subject: `Your ${meta[0].title} score was updated`,
        message: `Your attempt for "${meta[0].title}" was regraded against answer key ${answerKeyVersion}. Please review your updated result.`,
      });
      notifiedCount = result.data.deliveredCount;
    } catch {
      notifiedCount = 0;
    }
  }

  return regradeScoreAttemptsResponseSchema.parse({
    data: {
      assessmentId,
      regradedCount,
      skippedCount,
      answerKeyVersion,
      notifiedCount,
    },
  });
}
