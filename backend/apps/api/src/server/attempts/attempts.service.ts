import type { TenantTx } from "@atlas/db";
import { auditWriter } from "@atlas/audit";
import { outbox } from "@atlas/events";
import type { SaveAnswerInput } from "../assessments/schemas";
import {
  assessmentsRepository,
  extractAssessmentConfig,
  readCreatedByMembershipId,
  readItemRequired,
} from "../assessments/assessments.repository";
import { canReviewAnswers, scoreAttempt, type ScoringItem } from "../assessments/scoring.service";
import { assessmentNotFound } from "../assessments/assessments.errors";
import {
  attemptKeyConflict,
  attemptLimitReached,
  attemptNotFound,
  attemptNotInProgress,
  attemptTimeExpired,
  assessmentNotPublished,
  invalidAttemptItem,
} from "./attempts.errors";
import {
  attemptsRepository,
  parseAttemptMetadata,
  type AttemptMetadata,
  type AttemptRow,
} from "./attempts.repository";
import { systemServiceCtx } from "@atlas/core/actor/system-actor";
import {
  decodeExplanationJson,
  itemRegistryRepository,
} from "../item-registry/item-registry.repository";
import { finalizeProctoringReport, startProctoringSession } from "../proctoring/proctoring.service";

type ServiceCtx = {
  tenantId: string;
  actorMembershipId: string;
  requestId: string;
  /** Set when no member initiated the action (see `systemServiceCtx`). Recorded on audit. */
  systemSource?: string;
};

/**
 * How long after `dueAt` the server still accepts answer saves and treats a submit as on time.
 *
 * Audit finding H1: with no allowance at all, an auto-submit fired at 00:00 that reached the
 * server a few hundred milliseconds late was rejected, and the attempt stayed STARTED forever with
 * its answers never graded. The window absorbs network latency and in-flight autosaves; it is not
 * extra exam time, because the runner auto-submits at 00:00.
 */
export const ATTEMPT_DEADLINE_GRACE_MS = 30_000;

/** `open`: before `dueAt` (or untimed). `grace`: inside the grace window. `closed`: after it. */
export type AttemptDeadlinePhase = "open" | "grace" | "closed";

export function attemptDeadlinePhase(
  metadata: AttemptMetadata,
  nowMs: number = Date.now(),
): AttemptDeadlinePhase {
  if (!metadata.dueAt) return "open";
  const dueMs = Date.parse(metadata.dueAt);
  if (!Number.isFinite(dueMs) || nowMs <= dueMs) return "open";
  return nowMs <= dueMs + ATTEMPT_DEADLINE_GRACE_MS ? "grace" : "closed";
}

type StartAttemptConsent = {
  consentedAt: string;
  level: 1 | 2 | 3;
};

type AttemptLifecycleStatus = "STARTED" | "SUBMITTED" | "GRADED" | "ABANDONED" | "VOIDED";
type SubmittedAttemptStatus = "SUBMITTED" | "GRADED";

function toAttemptLifecycleStatus(status: string): AttemptLifecycleStatus {
  if (
    status === "STARTED" ||
    status === "SUBMITTED" ||
    status === "GRADED" ||
    status === "ABANDONED" ||
    status === "VOIDED"
  ) {
    return status;
  }

  return "VOIDED";
}

function toSubmittedAttemptStatus(status: string): SubmittedAttemptStatus {
  return status === "GRADED" ? "GRADED" : "SUBMITTED";
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const current = copy[index];
    const swap = copy[swapIndex];
    if (current !== undefined && swap !== undefined) {
      copy[index] = swap;
      copy[swapIndex] = current;
    }
  }
  return copy;
}

async function loadScoringItems(tx: TenantTx, assessmentId: string): Promise<ScoringItem[]> {
  const rows = await assessmentsRepository.listAssessmentItems(tx, assessmentId);
  const items: ScoringItem[] = [];

  for (const row of rows) {
    const item = await itemRegistryRepository.findItemById(tx, row.item_id);
    if (!item) {
      continue;
    }

    const options = await itemRegistryRepository.listItemOptions(tx, row.item_id);
    const decoded = decodeExplanationJson(item.explanation_json);

    items.push({
      assessmentItemId: row.id,
      itemId: row.item_id,
      itemTypeKey: item.item_type_key,
      points: Number(row.points),
      answerKeyJson: decoded.answerKeyJson,
      options: options.map((option) => ({
        id: option.id,
        isCorrect: option.is_correct ?? null,
        position: option.position,
      })),
    });
  }

  return items;
}

async function buildRunnerItems(
  tx: TenantTx,
  assessmentId: string,
  metadata: AttemptMetadata,
  config: ReturnType<typeof extractAssessmentConfig>,
) {
  const rows = await assessmentsRepository.listAssessmentItems(tx, assessmentId);
  let orderedRows = [...rows].sort((a, b) => a.position - b.position);

  if (config.shuffleItems) {
    orderedRows = shuffle(orderedRows);
  }

  const items = [];

  for (const row of orderedRows) {
    const item = await itemRegistryRepository.findItemById(tx, row.item_id);
    if (!item) {
      continue;
    }

    let options = await itemRegistryRepository.listItemOptions(tx, row.item_id);
    if (config.shuffleOptions) {
      options = shuffle(options);
    }

    const draft = metadata.draftAnswers?.[row.id];

    items.push({
      id: row.item_id,
      assessmentItemId: row.id,
      itemId: row.item_id,
      itemTypeKey: item.item_type_key,
      position: row.position,
      points: Number(row.points),
      required: readItemRequired(row.config_json),
      contentJson: item.stem_json as Record<string, unknown>,
      options: options.map((option) => ({
        id: option.id,
        optionJson: option.option_json as Record<string, unknown>,
        position: option.position,
      })),
      savedAnswer: draft?.answerJson ?? null,
    });
  }

  return items;
}

export async function startAttempt(
  tx: TenantTx,
  ctx: ServiceCtx,
  assessmentId: string,
  idempotencyKey: string,
  consent?: StartAttemptConsent | null,
) {
  // Audit M2: one start at a time per learner and assessment, so the count
  // below and the insert after it cannot interleave with another start.
  await attemptsRepository.lockAttemptStarts(tx, {
    tenantId: ctx.tenantId,
    assessmentId,
    membershipId: ctx.actorMembershipId,
  });

  const byKey = await attemptsRepository.findOwnByIdempotencyKey(tx, {
    idempotencyKey,
    membershipId: ctx.actorMembershipId,
    assessmentId,
  });
  if (byKey.kind === "foreign") {
    throw attemptKeyConflict();
  }
  if (byKey.kind === "own") {
    const existing = byKey.attempt;
    const metadata = parseAttemptMetadata(existing.metadata_json);
    return {
      data: {
        id: existing.id,
        assessmentId: existing.assessment_id,
        status: "STARTED" as const,
        startedAt: existing.started_at.toISOString(),
        dueAt: metadata.dueAt ?? null,
      },
    };
  }

  const assessment = await assessmentsRepository.findById(tx, assessmentId);
  if (!assessment || assessment.tenant_id !== ctx.tenantId || assessment.status !== "PUBLISHED") {
    throw assessmentNotPublished();
  }

  const config = extractAssessmentConfig(assessment.config_json);
  const grantsRaw =
    assessment.config_json &&
    typeof assessment.config_json === "object" &&
    !Array.isArray(assessment.config_json)
      ? (assessment.config_json as Record<string, unknown>)["learnerAttemptGrants"]
      : null;
  const extraGranted =
    grantsRaw &&
    typeof grantsRaw === "object" &&
    !Array.isArray(grantsRaw) &&
    typeof (grantsRaw as Record<string, unknown>)[ctx.actorMembershipId] === "number"
      ? Math.max(
          0,
          Math.floor((grantsRaw as Record<string, unknown>)[ctx.actorMembershipId] as number),
        )
      : 0;
  const attemptsUsed = await attemptsRepository.countAttemptsForMembership(tx, {
    assessmentId,
    membershipId: ctx.actorMembershipId,
  });

  if (attemptsUsed >= config.attemptsAllowed + extraGranted) {
    throw attemptLimitReached();
  }

  const dueAt =
    config.timeLimitSeconds != null
      ? new Date(Date.now() + config.timeLimitSeconds * 1000).toISOString()
      : null;

  const attempt = await attemptsRepository.insertAttempt(tx, {
    tenantId: ctx.tenantId,
    assessmentId,
    membershipId: ctx.actorMembershipId,
    idempotencyKey,
    dueAt,
  });

  if (config.proctoringLevel >= 1) {
    await startProctoringSession(tx, ctx, {
      attemptId: attempt.id,
      membershipId: ctx.actorMembershipId,
      level: config.proctoringLevel,
      consentedAt: consent?.consentedAt ?? null,
      consentLevel: consent?.level ?? config.proctoringLevel,
    });
  }

  await outbox.publish(tx, {
    ctx: {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      requestId: ctx.requestId,
    },
    eventType: "assessment.started",
    aggregateType: "attempt",
    aggregateId: attempt.id,
    payload: {
      attemptId: attempt.id,
      assessmentId,
      membershipId: ctx.actorMembershipId,
      startedAt: attempt.started_at.toISOString(),
    },
    idempotencyKey: `${ctx.requestId}:assessment.started:${attempt.id}`,
  });

  return {
    data: {
      id: attempt.id,
      assessmentId,
      status: "STARTED" as const,
      startedAt: attempt.started_at.toISOString(),
      dueAt,
    },
  };
}

export async function getAttempt(tx: TenantTx, ctx: ServiceCtx, attemptId: string) {
  let attempt = await attemptsRepository.findById(tx, attemptId);
  if (!attempt || attempt.tenant_id !== ctx.tenantId) {
    throw attemptNotFound();
  }

  // An attempt opened after its deadline (a closed tab, a returning learner, an instructor
  // reviewing) is finalized now rather than waiting for the worker's sweep, so nobody is ever
  // shown a runner that can no longer save.
  if (
    attempt.status === "STARTED" &&
    attemptDeadlinePhase(parseAttemptMetadata(attempt.metadata_json)) === "closed"
  ) {
    await finalizeExpiredAttempt(tx, ctx, attemptId);
    attempt = (await attemptsRepository.findById(tx, attemptId)) ?? attempt;
  }

  const assessment = await assessmentsRepository.findById(tx, attempt.assessment_id);
  if (!assessment) {
    throw assessmentNotFound();
  }

  const config = extractAssessmentConfig(assessment.config_json);
  const metadata = parseAttemptMetadata(attempt.metadata_json);
  const serverNow = new Date().toISOString();
  const scorePercent = attempt.score_pct != null ? Number(attempt.score_pct) : null;
  const passed = scorePercent != null ? scorePercent >= config.passMarkPercent : null;
  const requiresManualGrading = attempt.status === "SUBMITTED" && scorePercent == null;
  const reviewAllowed = canReviewAnswers({
    showAnswersPolicy: config.showAnswersPolicy,
    attemptStatus: attempt.status,
    passed,
  });

  const base = {
    id: attempt.id,
    assessmentId: attempt.assessment_id,
    status: toAttemptLifecycleStatus(attempt.status),
    startedAt: attempt.started_at.toISOString(),
    submittedAt: attempt.submitted_at?.toISOString() ?? null,
    dueAt: metadata.dueAt ?? null,
    serverNow,
    secureMode: config.secureMode,
    proctoringLevel: config.proctoringLevel,
    l1ProctoringEnabled: config.l1ProctoringEnabled,
    passMarkPercent: config.passMarkPercent,
  };

  if (attempt.status === "STARTED") {
    return {
      data: {
        ...base,
        items: await buildRunnerItems(tx, attempt.assessment_id, metadata, config),
      },
    };
  }

  return {
    data: {
      ...base,
      items: reviewAllowed
        ? await buildRunnerItems(tx, attempt.assessment_id, metadata, config)
        : [],
      canReviewAnswers: reviewAllowed,
      scorePercent,
      passed,
      requiresManualGrading,
    },
  };
}

export async function saveAttemptAnswer(
  tx: TenantTx,
  ctx: ServiceCtx,
  attemptId: string,
  input: SaveAnswerInput,
  idempotencyKey: string,
) {
  // Locked: this rewrites metadata_json wholesale, so an unlocked save racing a finalization
  // could overwrite the submission record the finalizer just wrote.
  const attempt = await attemptsRepository.findByIdForUpdate(tx, attemptId);
  if (
    !attempt ||
    attempt.tenant_id !== ctx.tenantId ||
    attempt.membership_id !== ctx.actorMembershipId
  ) {
    throw attemptNotFound();
  }

  if (attempt.status !== "STARTED") {
    throw attemptNotInProgress();
  }

  const metadata = parseAttemptMetadata(attempt.metadata_json);
  const replay = metadata.idempotencyAnswers?.[idempotencyKey];
  if (replay) {
    return {
      data: {
        assessmentItemId: replay.assessmentItemId,
        savedAt: replay.savedAt,
      },
    };
  }

  // Saves in flight at 00:00 are still accepted inside the grace window.
  if (attemptDeadlinePhase(metadata) === "closed") {
    throw attemptTimeExpired();
  }

  const assessmentItems = await assessmentsRepository.listAssessmentItems(
    tx,
    attempt.assessment_id,
  );
  const assessmentItem = assessmentItems.find((row) => row.item_id === input.itemId);
  if (!assessmentItem) {
    throw invalidAttemptItem();
  }

  const savedAt = new Date().toISOString();
  const nextMetadata: AttemptMetadata = {
    ...metadata,
    draftAnswers: {
      ...(metadata.draftAnswers ?? {}),
      [assessmentItem.id]: {
        answerJson: input.answerJson,
        updatedAt: savedAt,
      },
    },
    idempotencyAnswers: {
      ...(metadata.idempotencyAnswers ?? {}),
      [idempotencyKey]: {
        assessmentItemId: assessmentItem.id,
        answerJson: input.answerJson,
        savedAt,
      },
    },
  };

  await attemptsRepository.updateMetadata(tx, attemptId, nextMetadata);

  return {
    data: {
      assessmentItemId: assessmentItem.id,
      savedAt,
    },
  };
}

type SubmitAttemptResult = NonNullable<AttemptMetadata["submitIdempotency"]>[string];

/** The result view of an attempt that is already SUBMITTED or GRADED. */
async function submittedAttemptResult(
  tx: TenantTx,
  attempt: AttemptRow,
): Promise<SubmitAttemptResult> {
  const assessment = await assessmentsRepository.findById(tx, attempt.assessment_id);
  const config = assessment ? extractAssessmentConfig(assessment.config_json) : null;
  const scorePercent = attempt.score_pct != null ? Number(attempt.score_pct) : null;
  const passed =
    scorePercent != null && config != null ? scorePercent >= config.passMarkPercent : null;
  const status = toSubmittedAttemptStatus(attempt.status);

  return {
    id: attempt.id,
    status,
    submittedAt: attempt.submitted_at?.toISOString() ?? new Date().toISOString(),
    scorePercent,
    passed,
    requiresManualGrading: attempt.status === "SUBMITTED" && scorePercent == null,
    canReviewAnswers: config
      ? canReviewAnswers({
          showAnswersPolicy: config.showAnswersPolicy,
          attemptStatus: status,
          passed,
        })
      : false,
  };
}

export async function submitAttempt(
  tx: TenantTx,
  ctx: ServiceCtx,
  attemptId: string,
  idempotencyKey: string,
) {
  const attempt = await attemptsRepository.findByIdForUpdate(tx, attemptId);
  if (
    !attempt ||
    attempt.tenant_id !== ctx.tenantId ||
    attempt.membership_id !== ctx.actorMembershipId
  ) {
    throw attemptNotFound();
  }

  const metadata = parseAttemptMetadata(attempt.metadata_json);
  const replay = metadata.submitIdempotency?.[idempotencyKey];
  if (replay) {
    return { data: { ...replay, id: attemptId } };
  }

  if (attempt.status !== "STARTED") {
    // Already finalized, by an earlier submit or by the deadline. The learner gets their result
    // rather than an error, which is also what an auto-submit racing the sweep should see.
    if (attempt.status === "SUBMITTED" || attempt.status === "GRADED") {
      return { data: await submittedAttemptResult(tx, attempt) };
    }

    throw attemptNotInProgress();
  }

  // Audit finding H1: a submit after the deadline used to throw, leaving the attempt STARTED with
  // its saved answers never graded. It is now always accepted and graded from the answers saved
  // so far; saves after the grace window are already rejected, so nothing late is counted.
  return {
    data: await finalizeLockedAttempt(tx, ctx, attempt, {
      idempotencyKey,
      trigger: "learner",
    }),
  };
}

/**
 * Finalizes an in-progress attempt whose deadline and grace window have passed, grading the
 * answers saved before it closed. Returns false when there is nothing to do: the attempt is
 * missing, already finalized, untimed, or not yet past its grace window.
 *
 * Used by reads of an expired attempt and by the worker's deadline sweep. It is attributed to
 * the system, not to whoever happened to trigger it, because the time limit closed the attempt.
 */
export async function finalizeExpiredAttempt(
  tx: TenantTx,
  ctx: { tenantId: string; requestId: string },
  attemptId: string,
): Promise<boolean> {
  const attempt = await attemptsRepository.findByIdForUpdate(tx, attemptId);
  if (!attempt || attempt.tenant_id !== ctx.tenantId || attempt.status !== "STARTED") {
    return false;
  }

  if (attemptDeadlinePhase(parseAttemptMetadata(attempt.metadata_json)) !== "closed") {
    return false;
  }

  await finalizeLockedAttempt(
    tx,
    systemServiceCtx({
      tenantId: ctx.tenantId,
      requestId: ctx.requestId,
      source: "assessments.attempt_deadline",
    }),
    attempt,
    { idempotencyKey: `deadline:${attempt.id}`, trigger: "deadline" },
  );
  return true;
}

/**
 * Grades a STARTED attempt from its saved draft answers and records the submission.
 *
 * The caller must hold the attempt's row lock (`findByIdForUpdate`) and have checked that it is
 * STARTED, so concurrent finalizations cannot both grade it.
 */
async function finalizeLockedAttempt(
  tx: TenantTx,
  ctx: ServiceCtx,
  attempt: AttemptRow,
  args: { idempotencyKey: string; trigger: "learner" | "deadline" },
): Promise<SubmitAttemptResult> {
  const attemptId = attempt.id;
  const metadata = parseAttemptMetadata(attempt.metadata_json);
  const afterDeadline = attemptDeadlinePhase(metadata) !== "open";

  const assessment = await assessmentsRepository.findById(tx, attempt.assessment_id);
  if (!assessment) {
    throw assessmentNotFound();
  }

  const config = extractAssessmentConfig(assessment.config_json);
  const scoringItems = await loadScoringItems(tx, attempt.assessment_id);
  const answers = new Map<string, Record<string, unknown> | null>();

  for (const item of scoringItems) {
    const draft = metadata.draftAnswers?.[item.assessmentItemId];
    answers.set(item.assessmentItemId, draft?.answerJson ?? null);
  }

  const scoring = scoreAttempt({ items: scoringItems, answers });
  const passed =
    scoring.scorePercent != null ? scoring.scorePercent >= config.passMarkPercent : null;
  const nextStatus: SubmittedAttemptStatus = scoring.requiresManualGrading ? "SUBMITTED" : "GRADED";

  for (const itemResult of scoring.itemResults) {
    const answer = answers.get(itemResult.assessmentItemId);
    if (!answer && !itemResult.requiresManualGrading) {
      continue;
    }

    await attemptsRepository.insertAnswer(tx, {
      tenantId: ctx.tenantId,
      attemptId,
      assessmentItemId: itemResult.assessmentItemId,
      answerJson: answer ?? {},
      idempotencyKey: `${args.idempotencyKey}:${itemResult.assessmentItemId}`,
      isCorrect: itemResult.isCorrect,
      pointsAwarded: itemResult.pointsAwarded,
    });
  }

  if (scoring.requiresManualGrading) {
    await attemptsRepository.insertGradingTask(tx, {
      tenantId: ctx.tenantId,
      attemptId,
      assignedToMembershipId: readCreatedByMembershipId(assessment.config_json),
    });
  }

  const resultPayload = {
    id: attemptId,
    status: nextStatus,
    submittedAt: new Date().toISOString(),
    scorePercent: scoring.scorePercent,
    passed,
    requiresManualGrading: scoring.requiresManualGrading,
    canReviewAnswers: canReviewAnswers({
      showAnswersPolicy: config.showAnswersPolicy,
      attemptStatus: nextStatus,
      passed,
    }),
  } satisfies SubmitAttemptResult;

  const nextMetadata: AttemptMetadata = {
    ...metadata,
    submitIdempotency: {
      ...(metadata.submitIdempotency ?? {}),
      [args.idempotencyKey]: resultPayload,
    },
    submission: { trigger: args.trigger, afterDeadline },
  };

  await attemptsRepository.submitAttempt(tx, {
    attemptId,
    status: nextStatus,
    scorePercent: scoring.scorePercent,
    metadata: nextMetadata,
  });

  await finalizeProctoringReport(tx, ctx, attemptId);

  await auditWriter.write(
    tx,
    {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      platformPrincipalId: null,
      requestId: ctx.requestId,
      ...(ctx.systemSource ? { systemSource: ctx.systemSource } : {}),
    },
    {
      action: "attempt.submitted",
      target: { type: "attempt", id: attemptId },
      before: { status: attempt.status },
      after: {
        status: nextStatus,
        scorePercent: scoring.scorePercent,
        requiresManualGrading: scoring.requiresManualGrading,
      },
      reason: null,
      metadata: {
        assessmentId: attempt.assessment_id,
        trigger: args.trigger,
        afterDeadline,
      },
    },
  );

  // Consumers (gamification, competency, certificates, analytics) credit `payload.membershipId`,
  // so it must be the attempt's owner even when the deadline, not the learner, finalized it.
  await outbox.publish(tx, {
    ctx: {
      tenantId: ctx.tenantId,
      actorMembershipId: attempt.membership_id,
      requestId: ctx.requestId,
    },
    eventType: "assessment.submitted",
    aggregateType: "attempt",
    aggregateId: attemptId,
    payload: {
      attemptId,
      assessmentId: attempt.assessment_id,
      membershipId: attempt.membership_id,
      status: nextStatus,
      scorePercent: scoring.scorePercent,
      requiresManualGrading: scoring.requiresManualGrading,
    },
    idempotencyKey: `${ctx.requestId}:assessment.submitted:${attemptId}`,
  });

  return resultPayload;
}
