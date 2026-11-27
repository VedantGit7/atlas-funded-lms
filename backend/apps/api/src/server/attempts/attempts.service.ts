import type { TenantTx } from "@atlas/db";
import { auditWriter } from "@atlas/audit";
import { outbox } from "@atlas/events";
import type { SaveAnswerInput } from "../assessments/schemas";
import {
  assessmentsRepository,
  extractAssessmentConfig,
  extraAttemptsGranted,
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
import {
  itemsInAttempt,
  orderItems,
  orderOptions,
  planPresentationOrder,
  readPresentationOrder,
  type PresentationOrder,
} from "./presentation-order";
import {
  decodeChoiceAnswer,
  encodeChoiceAnswer,
  newChoiceSalt,
  presentChoices,
} from "./attempt-choices";
import { reviewItem } from "./attempt-review";
import { completeQuizLessonsForPass } from "../lessons/quiz-lesson-completion";
import { findQuizLessonsForMember } from "../lessons/quiz-lessons";

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

/**
 * Draw the attempt's item and option order once, at start (audit M9). Stored
 * even when nothing is shuffled, so a reordering by the author does not move
 * questions under a learner mid-attempt.
 */
async function planAttemptPresentation(
  tx: TenantTx,
  assessmentId: string,
  config: ReturnType<typeof extractAssessmentConfig>,
): Promise<PresentationOrder> {
  const rows = await assessmentsRepository.listAssessmentItems(tx, assessmentId);
  const loaded = config.shuffleOptions
    ? await itemRegistryRepository.loadItemsWithOptions(
        tx,
        rows.map((row) => row.item_id),
      )
    : new Map<string, { options: Array<{ id: string; position: number }> }>();
  const items = rows.map((row) => ({
    id: row.id,
    position: row.position,
    options: loaded.get(row.item_id)?.options ?? [],
  }));
  return planPresentationOrder({
    items,
    shuffleItems: config.shuffleItems,
    shuffleOptions: config.shuffleOptions,
    drawCount: config.questionsPerAttempt ?? null,
  });
}

/** The questions this attempt is marked on: the ones it asked. */
async function loadScoringItems(
  tx: TenantTx,
  assessmentId: string,
  order: PresentationOrder | undefined,
): Promise<ScoringItem[]> {
  const rows = itemsInAttempt(
    await assessmentsRepository.listAssessmentItems(tx, assessmentId),
    order,
  );
  const loaded = await itemRegistryRepository.loadItemsWithOptions(
    tx,
    rows.map((row) => row.item_id),
  );
  const items: ScoringItem[] = [];

  for (const row of rows) {
    const found = loaded.get(row.item_id);
    if (!found) {
      continue;
    }

    const { item, options } = found;
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

function optionLabel(optionJson: unknown, position: number): string {
  const label =
    optionJson && typeof optionJson === "object" && !Array.isArray(optionJson)
      ? (optionJson as Record<string, unknown>)["label"]
      : null;
  return typeof label === "string" && label.trim() ? label : `Option ${String(position)}`;
}

function isManualGradingType(itemTypeKey: string): boolean {
  return (
    itemTypeKey === "short_answer" ||
    itemTypeKey === "long_answer" ||
    itemTypeKey === "file_upload" ||
    itemTypeKey === "assignment"
  );
}

/**
 * The attempt's questions.
 *
 * `runner`: for answering. Matching and ordering questions carry their items
 * as opaque, shuffled choices (attempt-choices.ts), and saved answers use the
 * same tokens. `review`: after submission, when the quiz allows review. Each
 * question carries its answer and the correct one in words (attempt-review.ts).
 */
async function buildRunnerItems(
  tx: TenantTx,
  attempt: Pick<AttemptRow, "id" | "assessment_id">,
  metadata: AttemptMetadata,
  config: ReturnType<typeof extractAssessmentConfig>,
  mode: "runner" | "review" = "runner",
) {
  const graded =
    mode === "review"
      ? new Map(
          (await attemptsRepository.listAnswersForAttempt(tx, attempt.id)).map((row) => [
            row.assessment_item_id,
            row,
          ]),
        )
      : new Map<string, never>();
  const rows = await assessmentsRepository.listAssessmentItems(tx, attempt.assessment_id);
  // Audit M9: the order drawn at start, the same on every fetch.
  const order = readPresentationOrder(metadata.presentation);
  const orderedRows = orderItems(rows, {
    order,
    attemptId: attempt.id,
    shuffleItems: config.shuffleItems,
  });

  const loaded = await itemRegistryRepository.loadItemsWithOptions(
    tx,
    orderedRows.map((row) => row.item_id),
  );
  const items = [];

  for (const row of orderedRows) {
    const found = loaded.get(row.item_id);
    if (!found) {
      continue;
    }

    const { item } = found;
    const answerKey = decodeExplanationJson(item.explanation_json).answerKeyJson;
    const options = orderOptions(found.options, {
      order,
      attemptId: attempt.id,
      assessmentItemId: row.id,
      shuffleOptions: config.shuffleOptions,
    });

    const draft = metadata.draftAnswers?.[row.id];
    const saved = draft?.answerJson ?? null;
    const salt = metadata.choiceSalt;
    const choices =
      mode === "runner" && salt
        ? presentChoices({
            itemTypeKey: item.item_type_key,
            answerKey,
            salt,
            assessmentItemId: row.id,
          })
        : null;
    const points = Number(row.points);

    let review = null;
    if (mode === "review") {
      const answerRow = graded.get(row.id);
      const manual = isManualGradingType(item.item_type_key);
      review = {
        isCorrect: manual ? null : (answerRow?.is_correct ?? false),
        pointsAwarded: manual ? null : Number(answerRow?.points_awarded ?? 0),
        points,
        markedByInstructor: manual,
        ...reviewItem({
          itemTypeKey: item.item_type_key,
          answerKeyJson: answerKey,
          options: found.options.map((option) => ({
            id: option.id,
            label: optionLabel(option.option_json, option.position),
            isCorrect: option.is_correct ?? null,
            position: option.position,
          })),
          answerJson: saved,
        }),
      };
    }

    items.push({
      id: row.item_id,
      assessmentItemId: row.id,
      itemId: row.item_id,
      itemTypeKey: item.item_type_key,
      position: row.position,
      points,
      required: readItemRequired(row.config_json),
      contentJson: item.stem_json as Record<string, unknown>,
      options: options.map((option) => ({
        id: option.id,
        optionJson: option.option_json as Record<string, unknown>,
        position: option.position,
      })),
      savedAnswer:
        saved && choices && salt
          ? encodeChoiceAnswer({
              itemTypeKey: item.item_type_key,
              salt,
              assessmentItemId: row.id,
              answerJson: saved,
            })
          : saved,
      ...(choices ? { choices } : {}),
      ...(review ? { review } : {}),
    });
  }

  return items;
}

/**
 * Attempts started before choice salts existed get one on their next read, so
 * their matching and ordering questions can be answered. Locked, because a
 * save rewrites the metadata too.
 */
async function ensureChoiceSalt(tx: TenantTx, attempt: AttemptRow): Promise<AttemptRow> {
  if (parseAttemptMetadata(attempt.metadata_json).choiceSalt) return attempt;
  const locked = await attemptsRepository.findByIdForUpdate(tx, attempt.id);
  if (!locked || locked.status !== "STARTED") return locked ?? attempt;
  const metadata = parseAttemptMetadata(locked.metadata_json);
  if (metadata.choiceSalt) return locked;
  const next: AttemptMetadata = { ...metadata, choiceSalt: newChoiceSalt() };
  await attemptsRepository.updateMetadata(tx, locked.id, next);
  return { ...locked, metadata_json: next };
}

/** The first course lesson this quiz belongs to, for the learner's way back. */
async function lessonLinkFor(
  tx: TenantTx,
  attempt: Pick<AttemptRow, "assessment_id" | "membership_id">,
) {
  const [lesson] = await findQuizLessonsForMember(tx, {
    assessmentId: attempt.assessment_id,
    membershipId: attempt.membership_id,
  });
  return lesson
    ? { courseId: lesson.courseId, lessonId: lesson.lessonId, title: lesson.title }
    : null;
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
  const extraGranted = extraAttemptsGranted(assessment.config_json, ctx.actorMembershipId);
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
    presentation: await planAttemptPresentation(tx, assessmentId, config),
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

  if (attempt.status === "STARTED" && attempt.membership_id === ctx.actorMembershipId) {
    attempt = await ensureChoiceSalt(tx, attempt);
  }

  const assessment = await assessmentsRepository.findById(tx, attempt.assessment_id);
  if (!assessment) {
    throw assessmentNotFound();
  }

  const config = extractAssessmentConfig(assessment.config_json);
  const metadata = parseAttemptMetadata(attempt.metadata_json);
  const serverNow = new Date().toISOString();
  const lesson =
    attempt.membership_id === ctx.actorMembershipId ? await lessonLinkFor(tx, attempt) : null;
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
    title: assessment.title,
    lesson,
  };

  if (attempt.status === "STARTED") {
    return {
      data: {
        ...base,
        items: await buildRunnerItems(tx, attempt, metadata, config),
      },
    };
  }

  return {
    data: {
      ...base,
      items: reviewAllowed ? await buildRunnerItems(tx, attempt, metadata, config, "review") : [],
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
  // Only the questions this attempt asks (a random draw asks some of them).
  const assessmentItem = itemsInAttempt(
    assessmentItems,
    readPresentationOrder(metadata.presentation),
  ).find((row) => row.item_id === input.itemId);
  if (!assessmentItem) {
    throw invalidAttemptItem();
  }

  // Matching and ordering answers arrive in the attempt's opaque tokens and
  // are stored with the real ids, so grading is unchanged (attempt-choices.ts).
  let answerJson = input.answerJson;
  if (metadata.choiceSalt) {
    const loaded = (await itemRegistryRepository.loadItemsWithOptions(tx, [input.itemId])).get(
      input.itemId,
    );
    if (loaded) {
      answerJson = decodeChoiceAnswer({
        itemTypeKey: loaded.item.item_type_key,
        answerKey: decodeExplanationJson(loaded.item.explanation_json).answerKeyJson,
        salt: metadata.choiceSalt,
        assessmentItemId: assessmentItem.id,
        answerJson: input.answerJson,
      });
    }
  }

  const savedAt = new Date().toISOString();
  const nextMetadata: AttemptMetadata = {
    ...metadata,
    draftAnswers: {
      ...(metadata.draftAnswers ?? {}),
      [assessmentItem.id]: {
        answerJson,
        updatedAt: savedAt,
      },
    },
    idempotencyAnswers: {
      ...(metadata.idempotencyAnswers ?? {}),
      [idempotencyKey]: {
        assessmentItemId: assessmentItem.id,
        answerJson,
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
  const scoringItems = await loadScoringItems(
    tx,
    attempt.assessment_id,
    readPresentationOrder(metadata.presentation),
  );
  const answers = new Map<string, Record<string, unknown> | null>();

  for (const item of scoringItems) {
    const draft = metadata.draftAnswers?.[item.assessmentItemId];
    answers.set(item.assessmentItemId, draft?.answerJson ?? null);
  }

  const scoring = scoreAttempt({
    items: scoringItems,
    answers,
    negativeMarkPercent: config.negativeMarkPercent,
  });
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

  // Passing completes the quiz's lessons (QA review 2 H23).
  if (passed === true) {
    await completeQuizLessonsForPass(tx, ctx, {
      assessmentId: attempt.assessment_id,
      membershipId: attempt.membership_id,
    });
  }

  return resultPayload;
}
