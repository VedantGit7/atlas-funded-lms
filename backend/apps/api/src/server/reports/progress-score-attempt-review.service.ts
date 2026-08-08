import type { TenantTx } from "@atlas/db";
import type { ServiceCtx } from "@atlas/domain/shared/domain.types";
import {
  grantExtraAttemptResponseSchema,
  resetAttemptResponseSchema,
  saveAttemptGradingResponseSchema,
  scoreAttemptReviewResponseSchema,
  voidAttemptResponseSchema,
  type GrantExtraAttemptBody,
  type ResetAttemptBody,
  type SaveAttemptGradingBody,
  type VoidAttemptBody,
} from "@atlas/domain/reports/progress-score-roster.dto";
import {
  progressScoreAttemptActionFailed,
  progressScoreAttemptNotFound,
  progressScoreAssessmentNotFound,
} from "@atlas/domain/reports/progress-score-roster.errors";
import {
  asRecord,
  parseIntegrityFlags,
  progressScoreAttemptReviewRepository,
  readLearnerAttemptGrants,
} from "@atlas/domain/reports/progress-score-attempt-review.repository";
import { progressScoreRosterRepository } from "@atlas/domain/reports/progress-score-roster.repository";
import { sendScoreRosterMessage } from "./progress-score-roster-actions.service";

function roundPct(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.round(value * 10) / 10;
}

function resultStatus(
  status: string,
  scorePct: number | null,
  passMark: number | null,
): "pass" | "fail" | "pending" | "in_progress" | "voided" {
  if (status === "VOIDED") return "voided";
  if (status === "STARTED") return "in_progress";
  if (scorePct == null) return "pending";
  if (passMark != null && scorePct >= passMark) return "pass";
  if (passMark != null) return "fail";
  return "pending";
}

function readConfig(configJson: unknown) {
  const record = asRecord(configJson);
  return {
    attemptsAllowed:
      typeof record["attemptsAllowed"] === "number" && record["attemptsAllowed"] > 0
        ? Math.floor(record["attemptsAllowed"])
        : 1,
    timeLimitSeconds:
      typeof record["timeLimitSeconds"] === "number" ? Math.floor(record["timeLimitSeconds"]) : null,
    passMarkPercent:
      typeof record["passMarkPercent"] === "number" ? Number(record["passMarkPercent"]) : null,
  };
}

function shortId(attemptId: string): string {
  return `#AT-${attemptId.slice(0, 4).toUpperCase()}-${attemptId.slice(-1).toUpperCase()}`;
}

export async function getScoreAttemptReview(
  tx: TenantTx,
  _ctx: ServiceCtx,
  assessmentId: string,
  attemptId: string,
) {
  const core = await progressScoreAttemptReviewRepository.findAttemptCore(
    tx,
    assessmentId,
    attemptId,
  );
  if (!core) throw progressScoreAttemptNotFound();

  const meta = await progressScoreRosterRepository.findAssessmentMeta(tx, assessmentId);
  if (!meta) throw progressScoreAssessmentNotFound();

  const config = readConfig(core.config_json);
  const grants = readLearnerAttemptGrants(core.config_json);
  const extraAttemptsGranted = grants[core.membership_id] ?? 0;
  const effectiveAttemptsAllowed = config.attemptsAllowed + extraAttemptsGranted;

  const [siblings, questions] = await Promise.all([
    progressScoreAttemptReviewRepository.listSiblingAttempts(
      tx,
      assessmentId,
      core.membership_id,
    ),
    progressScoreAttemptReviewRepository.listQuestionsWithAnswers(tx, assessmentId, attemptId),
  ]);

  const currentSibling = siblings.find((s) => s.attempt_id === attemptId);
  const attemptNumber = currentSibling?.attempt_number ?? 1;
  const siblingIndex = siblings.findIndex((s) => s.attempt_id === attemptId);

  const history = siblings.map((sibling, index) => {
    const prev = index > 0 ? siblings[index - 1] : null;
    const scorePct = sibling.score_pct == null ? null : roundPct(sibling.score_pct);
    const prevScore = prev?.score_pct == null ? null : roundPct(prev.score_pct);
    return {
      attemptId: sibling.attempt_id,
      attemptNumber: sibling.attempt_number,
      scorePct,
      scoreDelta:
        scorePct != null && prevScore != null ? Math.round((scorePct - prevScore) * 10) / 10 : null,
      resultStatus: resultStatus(sibling.status, scorePct, config.passMarkPercent),
      submittedAt: sibling.submitted_at?.toISOString() ?? null,
      isCurrent: sibling.attempt_id === attemptId,
      isAvailableSlot: false,
    };
  });

  if (siblings.length < effectiveAttemptsAllowed) {
    history.push({
      attemptId: null,
      attemptNumber: siblings.length + 1,
      scorePct: null,
      scoreDelta: null,
      resultStatus: "pending" as const,
      submittedAt: null,
      isCurrent: false,
      isAvailableSlot: true,
    });
  }

  const scorePct = core.score_pct == null ? null : roundPct(core.score_pct);
  const correctCount = questions.filter((q) => q.outcome === "correct").length;
  const answeredCount = questions.filter((q) => q.hasAnswer).length;
  const unansweredCount = questions.filter((q) => q.outcome === "unanswered").length;
  const needsGradingCount = questions.filter((q) => q.outcome === "needs_grading").length;
  const durationSeconds =
    core.submitted_at && core.started_at
      ? Math.max(
          0,
          Math.round((core.submitted_at.getTime() - core.started_at.getTime()) / 1000),
        )
      : null;

  let pointsShortfall: number | null = null;
  if (scorePct != null && config.passMarkPercent != null && scorePct < config.passMarkPercent) {
    pointsShortfall = Math.round((config.passMarkPercent - scorePct) * 10) / 10;
  }

  return scoreAttemptReviewResponseSchema.parse({
    data: {
      assessment: {
        assessmentId,
        title: core.assessment_title,
        assessmentType: core.assessment_type,
        passMarkPercent: config.passMarkPercent,
        timeLimitSeconds: config.timeLimitSeconds,
        attemptsAllowed: config.attemptsAllowed,
        productType: meta.product_type,
        productId: meta.product_id,
        productTitle: meta.product_title,
        courseId: meta.course_id,
        courseTitle: meta.course_title,
      },
      learner: {
        membershipId: core.membership_id,
        learnerName: core.learner_name,
        email: core.email,
      },
      attempt: {
        attemptId,
        attemptNumber,
        ofAllowed: effectiveAttemptsAllowed,
        status: core.status,
        resultStatus: resultStatus(core.status, scorePct, config.passMarkPercent),
        scorePct,
        startedAt: core.started_at?.toISOString() ?? null,
        submittedAt: core.submitted_at?.toISOString() ?? null,
        durationSeconds,
        shortId: shortId(attemptId),
      },
      summary: {
        correctCount,
        answeredCount,
        unansweredCount,
        questionCount: questions.length,
        timeLimitSeconds: config.timeLimitSeconds,
        pointsShortfall,
        needsGradingCount,
      },
      questions: questions.map((q) => ({
        assessmentItemId: q.assessmentItemId,
        itemId: q.itemId,
        position: q.position,
        stem: q.stem,
        itemTypeKey: q.itemTypeKey,
        pointsMax: q.pointsMax,
        pointsAwarded: q.pointsAwarded,
        outcome: q.outcome,
        durationSeconds: q.durationSeconds,
        cohortCorrectRatePct: q.cohortCorrectRatePct,
        options: q.options,
        learnerAnswerText: q.learnerAnswerText,
        selectedOptionIds: q.selectedOptionIds,
        correctOptionIds: q.correctOptionIds,
        feedback: q.feedback,
        isManual: q.isManual,
      })),
      history,
      integrity: parseIntegrityFlags(core.metadata_json),
      nav: {
        prevAttemptId: siblingIndex > 0 ? (siblings[siblingIndex - 1]?.attempt_id ?? null) : null,
        nextAttemptId:
          siblingIndex >= 0 && siblingIndex < siblings.length - 1
            ? (siblings[siblingIndex + 1]?.attempt_id ?? null)
            : null,
      },
      grants: {
        extraAttemptsGranted,
        effectiveAttemptsAllowed,
      },
    },
  });
}

export async function saveAttemptGrading(
  tx: TenantTx,
  ctx: ServiceCtx,
  assessmentId: string,
  attemptId: string,
  input: SaveAttemptGradingBody,
) {
  const core = await progressScoreAttemptReviewRepository.findAttemptCore(
    tx,
    assessmentId,
    attemptId,
  );
  if (!core) throw progressScoreAttemptNotFound();
  if (core.status === "VOIDED" || core.status === "STARTED") {
    throw progressScoreAttemptActionFailed("Cannot grade a voided or in-progress attempt.");
  }

  const questions = await progressScoreAttemptReviewRepository.listQuestionsWithAnswers(
    tx,
    assessmentId,
    attemptId,
  );
  const byId = new Map(questions.map((q) => [q.assessmentItemId, q]));

  for (const item of input.items) {
    const question = byId.get(item.assessmentItemId);
    if (!question) {
      throw progressScoreAttemptActionFailed(`Unknown assessment item ${item.assessmentItemId}.`);
    }
    if (item.pointsAwarded > question.pointsMax) {
      throw progressScoreAttemptActionFailed(
        `Points for question ${question.position + 1} exceed max ${question.pointsMax}.`,
      );
    }

    const existingAnswer = asRecord(question.answerJson);
    const nextAnswer = {
      ...existingAnswer,
      ...(item.feedback !== undefined ? { instructorFeedback: item.feedback } : {}),
    };
    const isCorrect =
      question.isManual
        ? item.pointsAwarded >= question.pointsMax
        : item.pointsAwarded >= question.pointsMax;

    if (!question.hasAnswer) {
      await tx.$executeRaw`
        insert into attempt_answers (
          id, tenant_id, attempt_id, assessment_item_id, answer_json,
          is_correct, points_awarded, occurred_at, idempotency_key
        )
        values (
          gen_random_uuid(),
          current_setting('app.tenant_id', true)::uuid,
          ${attemptId}::uuid,
          ${item.assessmentItemId}::uuid,
          ${JSON.stringify(nextAnswer)}::jsonb,
          ${isCorrect},
          ${item.pointsAwarded},
          now(),
          ${`grade:${attemptId}:${item.assessmentItemId}`}
        )
        on conflict (tenant_id, attempt_id, assessment_item_id) do update set
          answer_json = excluded.answer_json,
          is_correct = excluded.is_correct,
          points_awarded = excluded.points_awarded
      `;
    } else {
      await tx.$executeRaw`
        update attempt_answers
        set
          answer_json = ${JSON.stringify(nextAnswer)}::jsonb,
          is_correct = ${isCorrect},
          points_awarded = ${item.pointsAwarded}
        where attempt_id = ${attemptId}::uuid
          and assessment_item_id = ${item.assessmentItemId}::uuid
          and tenant_id = current_setting('app.tenant_id', true)::uuid
      `;
    }
  }

  const refreshed = await progressScoreAttemptReviewRepository.listQuestionsWithAnswers(
    tx,
    assessmentId,
    attemptId,
  );
  const earned = refreshed.reduce((sum, q) => sum + (q.pointsAwarded ?? 0), 0);
  const possible = refreshed.reduce((sum, q) => sum + q.pointsMax, 0);
  const scorePct = possible > 0 ? roundPct((earned / possible) * 100) : null;
  const stillNeedsGrading = refreshed.some((q) => q.outcome === "needs_grading" || (q.isManual && q.pointsAwarded == null));
  const nextStatus = stillNeedsGrading ? "SUBMITTED" : "GRADED";
  const config = readConfig(core.config_json);

  await tx.$executeRaw`
    update attempts
    set
      score_pct = ${scorePct},
      status = ${nextStatus}::"AttemptStatus",
      graded_at = case when ${stillNeedsGrading} then graded_at else now() end,
      metadata_json = coalesce(metadata_json, '{}'::jsonb) || jsonb_build_object(
        'gradedManually', true,
        'gradedAt', to_jsonb(now()),
        'gradedByMembershipId', to_jsonb(${ctx.actorMembershipId}::text)
      )
    where id = ${attemptId}::uuid
      and tenant_id = current_setting('app.tenant_id', true)::uuid
  `;

  let notified = false;
  if (input.notifyLearner) {
    try {
      await sendScoreRosterMessage(tx, ctx, {
        assessmentId,
        membershipIds: [core.membership_id],
        subject: `Your ${core.assessment_title} score was updated`,
        message: `Your attempt for "${core.assessment_title}" was graded. Updated score: ${scorePct ?? "pending"}%.`,
      });
      notified = true;
    } catch {
      notified = false;
    }
  }

  return saveAttemptGradingResponseSchema.parse({
    data: {
      attemptId,
      scorePct,
      resultStatus: resultStatus(nextStatus, scorePct, config.passMarkPercent),
      gradedItemCount: input.items.length,
      notified,
    },
  });
}

export async function voidScoreAttempt(
  tx: TenantTx,
  ctx: ServiceCtx,
  assessmentId: string,
  attemptId: string,
  input: VoidAttemptBody,
) {
  const core = await progressScoreAttemptReviewRepository.findAttemptCore(
    tx,
    assessmentId,
    attemptId,
  );
  if (!core) throw progressScoreAttemptNotFound();
  if (core.status === "VOIDED") {
    throw progressScoreAttemptActionFailed("Attempt is already voided.");
  }

  await tx.$executeRaw`
    update attempts
    set
      status = 'VOIDED'::"AttemptStatus",
      metadata_json = coalesce(metadata_json, '{}'::jsonb) || jsonb_build_object(
        'voidedAt', to_jsonb(now()),
        'voidedByMembershipId', to_jsonb(${ctx.actorMembershipId}::text),
        'voidReason', to_jsonb(${input.reason}::text)
      )
    where id = ${attemptId}::uuid
      and tenant_id = current_setting('app.tenant_id', true)::uuid
  `;

  return voidAttemptResponseSchema.parse({
    data: { attemptId, status: "VOIDED" },
  });
}

export async function resetScoreAttempt(
  tx: TenantTx,
  ctx: ServiceCtx,
  assessmentId: string,
  attemptId: string,
  input: ResetAttemptBody,
) {
  return voidScoreAttempt(tx, ctx, assessmentId, attemptId, {
    reason: input.reason?.trim() || "Reset by administrator",
  });
}

export async function grantExtraScoreAttempt(
  tx: TenantTx,
  _ctx: ServiceCtx,
  assessmentId: string,
  attemptId: string,
  input: GrantExtraAttemptBody,
) {
  const core = await progressScoreAttemptReviewRepository.findAttemptCore(
    tx,
    assessmentId,
    attemptId,
  );
  if (!core) throw progressScoreAttemptNotFound();

  const config = readConfig(core.config_json);
  const grants = readLearnerAttemptGrants(core.config_json);
  const nextGrant = (grants[core.membership_id] ?? 0) + input.count;
  grants[core.membership_id] = nextGrant;

  const baseConfig = asRecord(core.config_json);
  const nextConfig = {
    ...baseConfig,
    learnerAttemptGrants: grants,
  };

  await tx.$executeRaw`
    update assessments
    set config_json = ${JSON.stringify(nextConfig)}::jsonb
    where id = ${assessmentId}::uuid
      and tenant_id = current_setting('app.tenant_id', true)::uuid
  `;

  return grantExtraAttemptResponseSchema.parse({
    data: {
      assessmentId,
      membershipId: core.membership_id,
      extraAttemptsGranted: nextGrant,
      effectiveAttemptsAllowed: config.attemptsAllowed + nextGrant,
    },
  });
}
