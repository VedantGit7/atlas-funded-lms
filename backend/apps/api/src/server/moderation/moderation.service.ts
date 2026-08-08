import type { TenantTx } from "@atlas/db";
import { auditWriter } from "@atlas/audit";
import { outbox } from "@atlas/events";
import {
  assertRegisteredContentAction,
  resolveCaseStatusAfterAppealUphold,
  resolveCaseStatusAfterDecision,
} from "./moderation.contract";
import type {
  CreateAppealBody,
  CreateModerationCaseBody,
  DecideModerationCaseBody,
  ModerationListQuery,
  ReviewAppealBody,
} from "./moderation.dto";
import {
  MODERATION_CASE_OPENED_AUDIT,
  MODERATION_DECIDED_AUDIT,
  MODERATION_DECIDED_EVENT,
  MODERATION_REPORTED_EVENT,
  moderationDecidedPayloadSchema,
  moderationReportedPayloadSchema,
} from "./moderation.events";
import {
  appealAlreadyOpen,
  appealNotAllowed,
  appealNotFound,
  appealSelfReviewBlocked,
  moderationCaseNotFound,
  moderationDuplicateOpenCase,
  moderationInvalidTransition,
  moderationUnregisteredContentAction,
} from "./moderation.errors";
import { moderationRepository } from "./moderation.repository";
import { communityRepository } from "../community/community.repository";
import { notificationRepository } from "../notifications/notification.repository";
import { buildSafeInboxPayload } from "../notifications/notification.service";
import {
  applyRegisteredContentAction,
  loadSafeTargetProjection,
  resolveTargetAuthorMembershipId,
} from "./moderation.target-port";
import type {
  AppealRow,
  ModerationCaseRow,
  ModerationDecisionRow,
  ModerationStatus,
  ServiceCtx,
} from "./moderation.types";

function mapDecisionDto(row: ModerationDecisionRow) {
  const metadata =
    row.decision_json && typeof row.decision_json === "object" && !Array.isArray(row.decision_json)
      ? (row.decision_json as Record<string, unknown>)
      : null;

  return {
    id: row.id,
    decisionKey: row.decision_key,
    decidedByMembershipId: row.decided_by_membership_id,
    occurredAt: row.occurred_at.toISOString(),
    metadata,
  };
}

function mapAppealDto(row: AppealRow) {
  return {
    id: row.id,
    status: row.status as "open" | "upheld" | "rejected",
    submittedByMembershipId: row.submitted_by_membership_id,
    body: row.body,
    createdAt: row.created_at.toISOString(),
  };
}

async function mapCaseDto(
  tx: TenantTx,
  row: ModerationCaseRow,
  options?: { includeAppeals?: boolean },
) {
  const [decisions, target, appeals] = await Promise.all([
    moderationRepository.listDecisionsForCase(tx, row.id),
    loadSafeTargetProjection(tx, {
      targetType: row.target_type as "post" | "comment",
      targetId: row.target_id,
      includeDeleted: true,
    }).catch(() => null),
    options?.includeAppeals
      ? moderationRepository.listAppealsForCase(tx, row.id)
      : Promise.resolve([]),
  ]);

  return {
    id: row.id,
    status: row.status,
    targetType: row.target_type as "post" | "comment",
    targetId: row.target_id,
    reasonKey: row.reason_key,
    openedByMembershipId: row.opened_by_membership_id,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    target,
    decisions: decisions.map(mapDecisionDto),
    ...(options?.includeAppeals ? { appeals: appeals.map(mapAppealDto) } : {}),
  };
}

async function writeModerationDecidedOutbox(
  tx: TenantTx,
  ctx: ServiceCtx,
  payload: {
    caseId: string;
    decisionKey: string;
    caseStatus: ModerationStatus;
    contentAction?: "delete" | null;
    appealId?: string | null;
    appealOutcome?: "uphold" | "reject" | null;
  },
) {
  const parsedPayload = moderationDecidedPayloadSchema.parse({
    caseId: payload.caseId,
    decisionKey: payload.decisionKey,
    caseStatus: payload.caseStatus,
    decidedByMembershipId: ctx.actorMembershipId,
    contentAction: payload.contentAction ?? null,
    appealId: payload.appealId ?? null,
    appealOutcome: payload.appealOutcome ?? null,
  });

  await outbox.publish(tx, {
    ctx: {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      requestId: ctx.requestId,
    },
    eventType: MODERATION_DECIDED_EVENT,
    aggregateType: "moderation_case",
    aggregateId: payload.caseId,
    payload: parsedPayload,
    idempotencyKey:
      ctx.idempotencyKey ?? `moderation.decided:${payload.caseId}:${payload.decisionKey}`,
  });
}

async function buildModerationAppealActionPath(
  tx: TenantTx,
  moderationCase: ModerationCaseRow,
): Promise<string> {
  if (moderationCase.target_type === "post") {
    return `/community/posts/${moderationCase.target_id}?appealCase=${moderationCase.id}`;
  }

  const comment = await communityRepository.findCommentById(tx, moderationCase.target_id);
  if (!comment) {
    return `/community/posts/${moderationCase.target_id}?appealCase=${moderationCase.id}`;
  }

  return `/community/posts/${comment.post_id}?appealCase=${moderationCase.id}`;
}

async function notifyAuthorOfModerationAction(
  tx: TenantTx,
  ctx: ServiceCtx,
  moderationCase: ModerationCaseRow,
): Promise<void> {
  const authorMembershipId = await resolveTargetAuthorMembershipId(tx, {
    targetType: moderationCase.target_type as "post" | "comment",
    targetId: moderationCase.target_id,
  });

  const actionPath = await buildModerationAppealActionPath(tx, moderationCase);
  const idempotencyKey = `moderation-author-notify:${moderationCase.id}:actioned`;

  const existing = await notificationRepository.findDispatchByIdempotencyKey(tx, {
    tenantId: ctx.tenantId,
    idempotencyKey,
  });
  if (existing) {
    return;
  }

  await notificationRepository.insertDispatch(tx, {
    tenantId: ctx.tenantId,
    membershipId: authorMembershipId,
    channel: "in_app",
    templateKey: "moderation.decided",
    destination: null,
    idempotencyKey,
    status: "SENT",
    payloadJson: buildSafeInboxPayload({
      title: "Moderation action on your content",
      body: "A moderator took action on your post or comment. You can review it and submit an appeal.",
      actionPath,
    }),
    sentAt: new Date(),
  });
}

export async function listModerationCases(
  tx: TenantTx,
  ctx: ServiceCtx,
  query: ModerationListQuery,
) {
  if (query.caseId != null) {
    const moderationCase = await moderationRepository.findCaseById(tx, query.caseId);
    if (!moderationCase || moderationCase.tenant_id !== ctx.tenantId) {
      throw moderationCaseNotFound();
    }

    return {
      data: {
        items: [await mapCaseDto(tx, moderationCase, { includeAppeals: true })],
      },
      page: {
        nextCursor: null,
        hasMore: false,
      },
    };
  }

  const rows =
    query.view === "appeals"
      ? await moderationRepository.listCasesWithOpenAppeals(tx, {
          limit: query.limit,
          ...(query.cursor != null ? { cursor: query.cursor } : {}),
        })
      : await moderationRepository.listCases(tx, {
          limit: query.limit,
          ...(query.status != null ? { status: query.status } : {}),
          ...(query.targetType != null ? { targetType: query.targetType } : {}),
          ...(query.cursor != null ? { cursor: query.cursor } : {}),
        });

  const hasMore = rows.length > query.limit;
  const pageRows = hasMore ? rows.slice(0, query.limit) : rows;
  const lastItem = pageRows.at(-1);

  return {
    data: {
      items: await Promise.all(
        pageRows.map((row) => mapCaseDto(tx, row, { includeAppeals: query.view === "appeals" })),
      ),
    },
    page: {
      nextCursor: hasMore && lastItem != null ? lastItem.id : null,
      hasMore,
    },
  };
}

export async function createModerationCase(
  tx: TenantTx,
  ctx: ServiceCtx,
  input: CreateModerationCaseBody,
) {
  await loadSafeTargetProjection(tx, {
    targetType: input.targetType,
    targetId: input.targetId,
  });

  const existing = await moderationRepository.findOpenCaseForTarget(tx, {
    targetType: input.targetType,
    targetId: input.targetId,
  });
  if (existing) {
    throw moderationDuplicateOpenCase();
  }

  const created = await moderationRepository.insertCase(tx, {
    targetType: input.targetType,
    targetId: input.targetId,
    reasonKey: input.reasonKey ?? null,
    openedByMembershipId: ctx.actorMembershipId,
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
      action: MODERATION_CASE_OPENED_AUDIT,
      target: { type: "moderation_case", id: created.id },
      before: null,
      after: {
        status: created.status,
        targetType: created.target_type,
        targetId: created.target_id,
        reasonKey: created.reason_key,
      },
      reason: null,
      metadata: {},
    },
  );

  const payload = moderationReportedPayloadSchema.parse({
    caseId: created.id,
    targetType: input.targetType,
    targetId: input.targetId,
    openedByMembershipId: ctx.actorMembershipId,
    reasonKey: created.reason_key,
  });

  await outbox.publish(tx, {
    ctx: {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      requestId: ctx.requestId,
    },
    eventType: MODERATION_REPORTED_EVENT,
    aggregateType: "moderation_case",
    aggregateId: created.id,
    payload,
    idempotencyKey: ctx.idempotencyKey ?? `moderation.reported:${created.id}`,
  });

  return { data: await mapCaseDto(tx, created, { includeAppeals: true }) };
}

export async function decideModerationCase(
  tx: TenantTx,
  ctx: ServiceCtx,
  caseId: string,
  input: DecideModerationCaseBody,
) {
  const moderationCase = await moderationRepository.findCaseById(tx, caseId);
  if (!moderationCase || moderationCase.tenant_id !== ctx.tenantId) {
    throw moderationCaseNotFound();
  }

  const nextStatus = resolveCaseStatusAfterDecision({
    currentStatus: moderationCase.status,
    decisionKey: input.decisionKey,
  });
  if (nextStatus == null) {
    throw moderationInvalidTransition("This decision is not allowed for the current case status.");
  }

  let contentAction: "delete" | null = null;
  if (input.contentAction != null) {
    try {
      contentAction = assertRegisteredContentAction(input.contentAction);
    } catch {
      throw moderationUnregisteredContentAction();
    }

    if (input.decisionKey !== "actioned") {
      throw moderationInvalidTransition("Content actions are only allowed when actioning a case.");
    }
  }

  const decision = await moderationRepository.insertDecision(tx, {
    caseId,
    decidedByMembershipId: ctx.actorMembershipId,
    decisionKey: input.decisionKey,
    decisionJson: {
      reason: input.reason ?? null,
      contentAction,
    },
  });

  const updated = await moderationRepository.updateCaseStatus(tx, {
    caseId,
    status: nextStatus,
  });
  if (!updated) {
    throw moderationCaseNotFound();
  }

  if (contentAction != null) {
    await applyRegisteredContentAction(tx, {
      targetType: moderationCase.target_type as "post" | "comment",
      targetId: moderationCase.target_id,
      contentAction,
    });
  }

  await auditWriter.write(
    tx,
    {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      platformPrincipalId: null,
      requestId: ctx.requestId,
    },
    {
      action: MODERATION_DECIDED_AUDIT,
      target: { type: "moderation_case", id: caseId },
      before: { status: moderationCase.status },
      after: { status: updated.status, decisionKey: input.decisionKey, contentAction },
      reason: input.reason ?? null,
      metadata: { decisionId: decision.id },
    },
  );

  await writeModerationDecidedOutbox(tx, ctx, {
    caseId,
    decisionKey: input.decisionKey,
    caseStatus: updated.status,
    contentAction,
  });

  if (updated.status === "ACTIONED") {
    await notifyAuthorOfModerationAction(tx, ctx, moderationCase);
  }

  return { data: await mapCaseDto(tx, updated, { includeAppeals: true }) };
}

export async function createAppeal(tx: TenantTx, ctx: ServiceCtx, input: CreateAppealBody) {
  const moderationCase = await moderationRepository.findCaseById(tx, input.moderationCaseId);
  if (!moderationCase || moderationCase.tenant_id !== ctx.tenantId) {
    throw moderationCaseNotFound();
  }

  if (moderationCase.status !== "ACTIONED") {
    throw appealNotAllowed("Appeals are only allowed for actioned moderation cases.");
  }

  const targetAuthorMembershipId = await resolveTargetAuthorMembershipId(tx, {
    targetType: moderationCase.target_type as "post" | "comment",
    targetId: moderationCase.target_id,
  });

  if (targetAuthorMembershipId !== ctx.actorMembershipId) {
    throw appealNotAllowed("Only the affected content author may submit an appeal.");
  }

  const existingAppeal = await moderationRepository.findOpenAppealForCase(tx, moderationCase.id);
  if (existingAppeal) {
    throw appealAlreadyOpen();
  }

  const appeal = await moderationRepository.insertAppeal(tx, {
    caseId: moderationCase.id,
    submittedByMembershipId: ctx.actorMembershipId,
    body: input.body,
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
      action: MODERATION_DECIDED_AUDIT,
      target: { type: "appeal", id: appeal.id },
      before: null,
      after: {
        moderationCaseId: appeal.moderation_case_id,
        status: appeal.status,
      },
      reason: null,
      metadata: { phase: "appeal_submitted" },
    },
  );

  return {
    data: {
      id: appeal.id,
      moderationCaseId: appeal.moderation_case_id,
      status: appeal.status as "open" | "upheld" | "rejected",
      body: appeal.body,
      createdAt: appeal.created_at.toISOString(),
    },
  };
}

export async function reviewAppeal(
  tx: TenantTx,
  ctx: ServiceCtx,
  appealId: string,
  input: ReviewAppealBody,
) {
  const appeal = await moderationRepository.findAppealById(tx, appealId);
  if (!appeal || appeal.tenant_id !== ctx.tenantId) {
    throw appealNotFound();
  }

  if (appeal.status !== "open") {
    throw appealNotAllowed("This appeal has already been reviewed.");
  }

  if (appeal.submitted_by_membership_id === ctx.actorMembershipId) {
    throw appealSelfReviewBlocked();
  }

  const moderationCase = await moderationRepository.findCaseById(tx, appeal.moderation_case_id);
  if (!moderationCase) {
    throw appealNotFound();
  }

  const appealStatus = input.outcome === "uphold" ? "upheld" : "rejected";
  const updatedAppeal = await moderationRepository.updateAppealStatus(tx, {
    appealId,
    status: appealStatus,
  });
  if (!updatedAppeal) {
    throw appealNotFound();
  }

  let updatedCase = moderationCase;

  if (input.outcome === "uphold") {
    const nextCaseStatus = resolveCaseStatusAfterAppealUphold({
      currentStatus: moderationCase.status,
      nextCaseStatus: input.nextCaseStatus ?? "REJECTED",
    });

    if (nextCaseStatus == null) {
      throw moderationInvalidTransition("Only actioned cases can be changed by an upheld appeal.");
    }

    const caseUpdate = await moderationRepository.updateCaseStatus(tx, {
      caseId: moderationCase.id,
      status: nextCaseStatus,
    });
    if (!caseUpdate) {
      throw moderationCaseNotFound();
    }
    updatedCase = caseUpdate;
  }

  await moderationRepository.insertDecision(tx, {
    caseId: moderationCase.id,
    decidedByMembershipId: ctx.actorMembershipId,
    decisionKey: `appeal_${input.outcome}`,
    decisionJson: {
      appealId,
      reason: input.reason ?? null,
      nextCaseStatus: input.nextCaseStatus ?? null,
    },
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
      action: MODERATION_DECIDED_AUDIT,
      target: { type: "moderation_case", id: moderationCase.id },
      before: { caseStatus: moderationCase.status, appealStatus: appeal.status },
      after: { caseStatus: updatedCase.status, appealStatus: updatedAppeal.status },
      reason: input.reason ?? null,
      metadata: { appealId, outcome: input.outcome },
    },
  );

  await writeModerationDecidedOutbox(tx, ctx, {
    caseId: moderationCase.id,
    decisionKey: `appeal_${input.outcome}`,
    caseStatus: updatedCase.status,
    appealId,
    appealOutcome: input.outcome,
  });

  return {
    data: {
      appealId: updatedAppeal.id,
      outcome: input.outcome,
      appealStatus: updatedAppeal.status as "upheld" | "rejected",
      caseStatus: updatedCase.status,
    },
  };
}

export async function deletePostAsModerator(tx: TenantTx, ctx: ServiceCtx, postId: string) {
  const post = await loadSafeTargetProjection(tx, { targetType: "post", targetId: postId });

  await applyRegisteredContentAction(tx, {
    targetType: "post",
    targetId: postId,
    contentAction: "delete",
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
      action: MODERATION_DECIDED_AUDIT,
      target: { type: "post", id: postId },
      before: { deleted: post.deleted },
      after: { deleted: true, contentAction: "delete" },
      reason: null,
      metadata: { moderationPath: true },
    },
  );

  return { data: { id: postId, deleted: true as const } };
}

export async function deleteCommentAsModerator(
  tx: TenantTx,
  ctx: ServiceCtx,
  commentId: string,
  options?: { skipOwnershipCheck?: boolean },
) {
  const existing = await loadSafeTargetProjection(tx, {
    targetType: "comment",
    targetId: commentId,
  });

  if (!options?.skipOwnershipCheck && existing.authorMembershipId !== ctx.actorMembershipId) {
    // Authorization handled by can(); service only applies delete.
  }

  await applyRegisteredContentAction(tx, {
    targetType: "comment",
    targetId: commentId,
    contentAction: "delete",
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
      action: MODERATION_DECIDED_AUDIT,
      target: { type: "comment", id: commentId },
      before: { deleted: existing.deleted },
      after: { deleted: true, contentAction: "delete" },
      reason: null,
      metadata: { moderationPath: true },
    },
  );

  return { data: { id: commentId, deleted: true as const } };
}
