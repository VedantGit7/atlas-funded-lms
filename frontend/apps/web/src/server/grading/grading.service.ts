// Poisons this module for any client bundle. Audit finding M9: nothing at the
// language level stopped a server module being pulled into a client component,
// so a leak of service code -- and whatever secrets or privileged queries it
// closes over -- would only have shown up as a runtime surprise.
import "server-only";

import type { TenantTx } from "@atlas/db";
import { auditWriter } from "@atlas/audit";
import { findRolePermissionGrant } from "@atlas/authorization";
import { outbox } from "@atlas/events";
import { GRADEABLE_TASK_STATUSES } from "./grading.constants";
import {
  gradingAssignedToAllDenied,
  gradingScoreOutOfRange,
  gradingTaskNotFound,
  gradingTaskNotGradeable,
} from "./grading.errors";
import type { GradeTaskBody, GradingListQuery } from "./grading-schemas";
import {
  gradingRepository,
  mapDbStatusToApi,
  parseGradingResult,
  type GradingResultJson,
} from "./grading.repository";
import { getTimelineForAttempt } from "../proctoring/proctoring.service";

type ServiceCtx = {
  tenantId: string;
  actorMembershipId: string;
  requestId: string;
  idempotencyKey?: string;
};

function readStemPrompt(stemJson: unknown): string {
  if (stemJson && typeof stemJson === "object" && !Array.isArray(stemJson)) {
    const stem = (stemJson as { stem?: unknown }).stem;
    if (typeof stem === "string" && stem.trim().length > 0) {
      return stem;
    }
  }

  return "Question";
}

function distributeManualScore(args: {
  manualItems: Array<{ assessmentItemId: string; points: number }>;
  score: number;
}): Array<{ assessmentItemId: string; pointsAwarded: number }> {
  const totalManualPoints = args.manualItems.reduce((sum, item) => sum + item.points, 0);
  if (totalManualPoints <= 0 || args.manualItems.length === 0) {
    return [];
  }

  let remaining = args.score;
  const allocations: Array<{ assessmentItemId: string; pointsAwarded: number }> = [];

  for (let index = 0; index < args.manualItems.length; index += 1) {
    const item = args.manualItems[index];
    if (!item) {
      continue;
    }

    const isLast = index === args.manualItems.length - 1;
    const proportional = isLast
      ? remaining
      : Number(((args.score * item.points) / totalManualPoints).toFixed(2));
    const pointsAwarded = Math.max(0, Math.min(item.points, proportional));
    remaining = Number((remaining - pointsAwarded).toFixed(2));
    allocations.push({ assessmentItemId: item.assessmentItemId, pointsAwarded });
  }

  return allocations;
}

async function isAdminBypass(tx: TenantTx, ctx: ServiceCtx): Promise<boolean> {
  const grant = await findRolePermissionGrant({
    tx,
    tenantId: ctx.tenantId,
    membershipId: ctx.actorMembershipId,
    permissionKey: "assessment.grade",
  });

  const roleKeys = grant?.roleKeys ?? [];
  return roleKeys.includes("owner") || roleKeys.includes("admin");
}

function computeScorePercent(earned: number, possible: number): number | null {
  if (possible <= 0) {
    return null;
  }

  return Number(((earned / possible) * 100).toFixed(4));
}

function mapQueueItem(row: Awaited<ReturnType<typeof gradingRepository.listTasks>>[number]) {
  return {
    id: row.id,
    status: mapDbStatusToApi(row.status),
    assessmentTitle: row.assessment_title,
    learnerDisplayName: row.learner_display_name?.trim() || "Learner",
    itemType: row.item_type_key,
    possiblePoints: Number(row.manual_possible_points ?? 0),
    submittedAt: row.submitted_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function listGradingTasks(tx: TenantTx, ctx: ServiceCtx, query: GradingListQuery) {
  const includeAll = query.assignedTo === "all";

  if (includeAll && !(await isAdminBypass(tx, ctx))) {
    throw gradingAssignedToAllDenied();
  }

  const rows = await gradingRepository.listTasks(tx, {
    tenantId: ctx.tenantId,
    actorMembershipId: ctx.actorMembershipId,
    includeAll,
    ...(query.status != null ? { status: query.status } : {}),
    ...(query.assessmentId != null ? { assessmentId: query.assessmentId } : {}),
    ...(query.learnerMembershipId != null
      ? { learnerMembershipId: query.learnerMembershipId }
      : {}),
    ...(query.q != null ? { q: query.q } : {}),
    limit: query.limit,
    ...(query.cursor != null ? { cursor: query.cursor } : {}),
  });

  const hasMore = rows.length > query.limit;
  const data = hasMore ? rows.slice(0, query.limit) : rows;
  const lastItem = data.at(-1);

  return {
    data: data.map(mapQueueItem),
    page: {
      nextCursor: hasMore && lastItem != null ? lastItem.id : null,
      hasMore,
    },
  };
}

export async function getGradingTaskDetail(tx: TenantTx, ctx: ServiceCtx, taskId: string) {
  const task = await gradingRepository.findById(tx, taskId);
  if (!task || task.tenant_id !== ctx.tenantId) {
    throw gradingTaskNotFound();
  }

  const attempt = await gradingRepository.loadAttemptSummary(tx, task.attempt_id);
  if (!attempt) {
    throw gradingTaskNotFound();
  }

  const assessment = await gradingRepository.loadAssessmentSummary(tx, attempt.assessmentId);
  if (!assessment) {
    throw gradingTaskNotFound();
  }

  const manualAnswers = await gradingRepository.loadManualAnswerRows(tx, {
    attemptId: attempt.id,
    assessmentId: attempt.assessmentId,
  });
  const manualPossiblePoints = manualAnswers.reduce((sum, item) => sum + item.points, 0);
  const existingResult = parseGradingResult(task.result_json);
  const learnerDisplayName = await gradingRepository.loadLearnerDisplayName(
    tx,
    attempt.membershipId,
  );
  const proctoring = await getTimelineForAttempt(tx, ctx, attempt.id);

  return {
    data: {
      id: task.id,
      status: mapDbStatusToApi(task.status),
      assessment: {
        id: assessment.id,
        title: assessment.title,
        assessmentType: assessment.assessmentType,
      },
      attempt: {
        id: attempt.id,
        status: attempt.status,
        submittedAt: attempt.submittedAt?.toISOString() ?? null,
        scorePercent: attempt.scorePct,
      },
      learner: {
        membershipId: attempt.membershipId,
        displayName: learnerDisplayName,
      },
      answers: manualAnswers.map((item) => ({
        assessmentItemId: item.assessmentItemId,
        itemType: item.itemTypeKey,
        prompt: readStemPrompt(item.stemJson),
        content: item.stemJson,
        learnerAnswer: item.answerJson,
        possiblePoints: item.points,
        pointsAwarded:
          existingResult?.itemScores?.find(
            (entry) => entry.assessmentItemId === item.assessmentItemId,
          )?.pointsAwarded ??
          item.pointsAwarded ??
          null,
      })),
      possiblePoints: manualPossiblePoints,
      existingGrade: existingResult
        ? {
            score: existingResult.score,
            feedback: existingResult.feedback,
            ...(existingResult.rubricJson ? { rubricJson: existingResult.rubricJson } : {}),
            ...(existingResult.graderNotesJson
              ? { graderNotesJson: existingResult.graderNotesJson }
              : {}),
            gradedAt: existingResult.gradedAt,
          }
        : null,
      proctoringTimeline: proctoring.timeline,
      proctoringReport: proctoring.report
        ? {
            id: proctoring.report.id,
            summary: proctoring.report.summary ?? "Advisory proctoring report.",
            riskScore: proctoring.report.riskScore,
            riskBand: proctoring.report.riskBand,
            generatedAt: proctoring.report.generatedAt,
          }
        : null,
      createdAt: task.created_at.toISOString(),
      updatedAt: task.updated_at.toISOString(),
    },
  };
}

function buildGradeReplayResult(args: {
  taskId: string;
  attemptId: string;
  result: GradingResultJson;
  attemptStatus: string;
  scorePercent: number | null;
}) {
  return {
    data: {
      gradingTaskId: args.taskId,
      status: "GRADED" as const,
      score: args.result.score,
      possiblePoints: args.result.possiblePoints,
      feedback: args.result.feedback,
      attemptId: args.attemptId,
      attemptStatus: args.attemptStatus,
      scorePercent: args.scorePercent,
      gradedAt: args.result.gradedAt,
    },
  };
}

export async function gradeGradingTask(
  tx: TenantTx,
  ctx: ServiceCtx,
  taskId: string,
  input: GradeTaskBody,
) {
  const task = await gradingRepository.findById(tx, taskId);
  if (!task || task.tenant_id !== ctx.tenantId) {
    throw gradingTaskNotFound();
  }

  const attempt = await gradingRepository.loadAttemptSummary(tx, task.attempt_id);
  if (!attempt) {
    throw gradingTaskNotFound();
  }

  const manualPossiblePoints = await gradingRepository.sumManualPossiblePoints(
    tx,
    attempt.assessmentId,
  );
  const idempotencyKey = ctx.idempotencyKey ?? input.idempotencyKey;
  const existingResult = parseGradingResult(task.result_json);

  if (task.status === "graded") {
    if (idempotencyKey && existingResult?.idempotencyKey === idempotencyKey) {
      return buildGradeReplayResult({
        taskId: task.id,
        attemptId: attempt.id,
        result: existingResult,
        attemptStatus: attempt.status,
        scorePercent: attempt.scorePct,
      });
    }

    throw gradingTaskNotGradeable("This grading task has already been graded.");
  }

  if (!GRADEABLE_TASK_STATUSES.has(task.status)) {
    throw gradingTaskNotGradeable();
  }

  if (input.score > manualPossiblePoints) {
    throw gradingScoreOutOfRange();
  }

  const manualAnswers = await gradingRepository.loadManualAnswerRows(tx, {
    attemptId: attempt.id,
    assessmentId: attempt.assessmentId,
  });
  const itemScores = distributeManualScore({
    manualItems: manualAnswers.map((item) => ({
      assessmentItemId: item.assessmentItemId,
      points: item.points,
    })),
    score: input.score,
  });

  const objectiveEarned = await gradingRepository.sumObjectivePointsAwarded(tx, attempt.id);
  const totalPossible = await gradingRepository.sumTotalPossiblePoints(tx, attempt.assessmentId);
  const totalEarned = objectiveEarned + input.score;
  const scorePercent = computeScorePercent(totalEarned, totalPossible);

  const gradedAt = new Date().toISOString();
  const resultJson: GradingResultJson = {
    score: input.score,
    feedback: input.feedback,
    possiblePoints: manualPossiblePoints,
    graderMembershipId: ctx.actorMembershipId,
    gradedAt,
    itemScores,
    ...(idempotencyKey ? { idempotencyKey } : {}),
    ...(input.rubricJson ? { rubricJson: input.rubricJson } : {}),
    ...(input.graderNotesJson ? { graderNotesJson: input.graderNotesJson } : {}),
  };

  await gradingRepository.updateTaskGraded(tx, {
    taskId: task.id,
    resultJson,
    ...(input.rubricJson ? { rubricJson: input.rubricJson } : {}),
  });

  const pendingTasks = await gradingRepository.countPendingTasksForAttempt(tx, attempt.id);
  const nextAttemptStatus = pendingTasks === 0 ? "GRADED" : "SUBMITTED";

  await gradingRepository.updateAttemptAfterGrading(tx, {
    attemptId: attempt.id,
    status: nextAttemptStatus,
    scorePercent,
  });

  await auditWriter.write(
    tx,
    {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      platformPrincipalId: null,
      requestId: ctx.requestId,
    },
    {
      action: "assessment.grade_changed",
      target: { type: "grading_task", id: task.id },
      before: { status: task.status },
      after: {
        status: "graded",
        score: input.score,
        possiblePoints: manualPossiblePoints,
      },
      reason: null,
      metadata: {
        gradingTaskId: task.id,
        assessmentId: attempt.assessmentId,
        attemptId: attempt.id,
        learnerMembershipId: attempt.membershipId,
        itemId: manualAnswers[0]?.assessmentItemId ?? null,
      },
    },
  );

  await outbox.publish(tx, {
    ctx: {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      requestId: ctx.requestId,
    },
    eventType: "assessment.graded",
    aggregateType: "attempt",
    aggregateId: attempt.id,
    payload: {
      assessmentId: attempt.assessmentId,
      attemptId: attempt.id,
      gradingTaskId: task.id,
      itemId: manualAnswers[0]?.assessmentItemId ?? null,
      learnerMembershipId: attempt.membershipId,
      graderMembershipId: ctx.actorMembershipId,
      score: input.score,
      possiblePoints: manualPossiblePoints,
      attemptState: nextAttemptStatus,
      requestId: ctx.requestId,
    },
    idempotencyKey: idempotencyKey
      ? `${idempotencyKey}:assessment.graded:${task.id}`
      : `${ctx.requestId}:assessment.graded:${task.id}`,
  });

  return buildGradeReplayResult({
    taskId: task.id,
    attemptId: attempt.id,
    result: resultJson,
    attemptStatus: nextAttemptStatus,
    scorePercent,
  });
}

export { distributeManualScore, computeScorePercent, isAdminBypass as isGradingAdminBypass };
