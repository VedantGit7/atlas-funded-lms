import type { TenantTx } from "@atlas/db";
import { auditWriter } from "@atlas/audit";
import { outbox } from "@atlas/events";
import {
  appendWorkflowTransition,
  createWorkflowDefinition as createWorkflowDefinitionRepo,
  encodeWorkflowCursor,
  findAssessmentForWorkflow,
  findCourseForWorkflow,
  findLearningPathForWorkflow,
  findLatestTransitionForTarget,
  findWorkflowTransitionById,
  hasLaterTransitionForTarget,
  listPendingWorkflowItems,
  listWorkflowDefinitions as listWorkflowDefinitionsRepo,
  listWorkflowHistoryForTarget,
  updateAssessmentStatusForWorkflow,
  updateCourseStatusForWorkflow,
  updateLearningPathStatusForWorkflow,
  updateWorkflowDefinition as updateWorkflowDefinitionRepo,
  type WorkflowTargetType,
} from "./workflows.repository";
import type { WorkflowListQuery, WorkflowTransitionBody } from "./workflow-schemas";
import { workflowItemNotFound, workflowTransitionConflict } from "./workflow.errors";
import type { CourseLifecycleStatus } from "../courses/course-state-guards";
import {
  assertCourseInReviewForApproval,
  assertCourseReviewableForAction,
} from "../courses/course-state-guards";

type ServiceCtx = {
  tenantId: string;
  actorMembershipId: string;
  requestId: string;
};

type PublishLifecycleStatus = "DRAFT" | "REVIEW" | "PUBLISHED" | "ARCHIVED";

function deriveTransitionAction(
  fromState: string,
  toState: string,
  metadata: Record<string, unknown> | null,
): "submit" | "approve" | "reject" | "return" | null {
  const action = metadata?.["action"];
  if (action === "approve" || action === "reject" || action === "return") {
    return action;
  }

  if (fromState === "DRAFT" && toState === "REVIEW") {
    return "submit";
  }

  if (fromState === "REVIEW" && toState === "PUBLISHED") {
    return "approve";
  }

  if (fromState === "REVIEW" && toState === "DRAFT") {
    return "reject";
  }

  return null;
}

function assertPublishTargetInReview(status: string): void {
  if (status !== "REVIEW") {
    throw workflowTransitionConflict("Target is not in review state.");
  }
}

function assertPublishReviewTransition(nextStatus: PublishLifecycleStatus): void {
  if (nextStatus !== "PUBLISHED" && nextStatus !== "DRAFT") {
    throw workflowTransitionConflict("Invalid workflow transition for review.");
  }
}

async function readTargetPublishStatus(
  tx: TenantTx,
  targetType: WorkflowTargetType,
  targetId: string,
): Promise<string | null> {
  if (targetType === "course") {
    const course = await findCourseForWorkflow({ tx, courseId: targetId });
    return course?.status ?? null;
  }
  if (targetType === "assessment") {
    const assessment = await findAssessmentForWorkflow({ tx, assessmentId: targetId });
    return assessment?.status ?? null;
  }
  const path = await findLearningPathForWorkflow({ tx, pathId: targetId });
  return path?.status ?? null;
}

async function resolveIdempotentWorkflowAction(
  tx: TenantTx,
  pending: NonNullable<Awaited<ReturnType<typeof findWorkflowTransitionById>>>,
  input: WorkflowTransitionBody,
) {
  const latest = await findLatestTransitionForTarget({
    tx,
    targetType: pending.targetType,
    targetId: pending.targetId,
  });

  if (!latest || latest.id === pending.id) {
    return null;
  }

  const latestAction = deriveTransitionAction(
    latest.fromState,
    latest.toState,
    latest.metadataJson,
  );
  const targetStatus = await readTargetPublishStatus(
    tx,
    pending.targetType as WorkflowTargetType,
    pending.targetId,
  );

  if (input.action === "approve" && latestAction === "approve" && targetStatus === "PUBLISHED") {
    return {
      data: {
        id: latest.id,
        workflowDefinitionId: pending.workflowDefinitionId,
        targetType: pending.targetType as WorkflowTargetType,
        targetId: pending.targetId,
        action: input.action,
        fromState: latest.fromState,
        toState: latest.toState,
        targetStatus: "PUBLISHED" as const,
        occurredAt: latest.occurredAt.toISOString(),
        comment: latest.reason,
      },
    };
  }

  if (
    (input.action === "reject" || input.action === "return") &&
    latestAction === input.action &&
    targetStatus === "DRAFT"
  ) {
    return {
      data: {
        id: latest.id,
        workflowDefinitionId: pending.workflowDefinitionId,
        targetType: pending.targetType as WorkflowTargetType,
        targetId: pending.targetId,
        action: input.action,
        fromState: latest.fromState,
        toState: latest.toState,
        targetStatus: "DRAFT" as const,
        occurredAt: latest.occurredAt.toISOString(),
        comment: latest.reason,
      },
    };
  }

  return null;
}

function mapQueueItem(row: {
  id: string;
  workflowDefinitionId: string;
  targetType: WorkflowTargetType;
  targetId: string;
  fromState: string;
  toState: string;
  actorMembershipId: string;
  reason: string | null;
  occurredAt: Date;
  targetTitle: string;
  targetStatus: string;
  targetOwnerMembershipId: string | null;
}) {
  return {
    id: row.id,
    workflowDefinitionId: row.workflowDefinitionId,
    target: {
      type: row.targetType,
      id: row.targetId,
      title: row.targetTitle,
      status: row.targetStatus as PublishLifecycleStatus,
      createdByMembershipId: row.targetOwnerMembershipId ?? undefined,
    },
    fromState: row.fromState,
    toState: row.toState,
    submittedByMembershipId: row.actorMembershipId,
    submittedAt: row.occurredAt.toISOString(),
    comment: row.reason,
    availableActions: ["approve", "reject", "return"] as Array<"approve" | "reject" | "return">,
  };
}

export async function listReviewQueue(tx: TenantTx, _ctx: ServiceCtx, query: WorkflowListQuery) {
  if (query.status === "acted" || query.status === "all") {
    return {
      data: [],
      page: { nextCursor: null, hasMore: false },
    };
  }

  const result = await listPendingWorkflowItems({
    tx,
    limit: query.limit,
    ...(query.cursor != null ? { cursor: query.cursor } : {}),
    ...(query.targetType != null ? { targetType: query.targetType } : {}),
  });

  const lastItem = result.items.at(-1);

  return {
    data: result.items.map(mapQueueItem),
    page: {
      nextCursor:
        result.hasMore && lastItem != null ? encodeWorkflowCursor(lastItem.occurredAt) : null,
      hasMore: result.hasMore,
    },
  };
}

async function actOnCourseWorkflow(
  tx: TenantTx,
  ctx: ServiceCtx,
  pending: NonNullable<Awaited<ReturnType<typeof findWorkflowTransitionById>>>,
  input: WorkflowTransitionBody,
) {
  const course = await findCourseForWorkflow({
    tx,
    courseId: pending.targetId,
  });

  if (!course) {
    throw workflowItemNotFound();
  }

  assertCourseInReviewForApproval(course.status as CourseLifecycleStatus);

  const nextStatus: CourseLifecycleStatus = input.action === "approve" ? "PUBLISHED" : "DRAFT";
  assertCourseReviewableForAction("REVIEW", nextStatus);

  const transition = await appendWorkflowTransition({
    tx,
    tenantId: ctx.tenantId,
    workflowDefinitionId: pending.workflowDefinitionId,
    targetType: pending.targetType,
    targetId: pending.targetId,
    fromState: "REVIEW",
    toState: nextStatus,
    actorMembershipId: ctx.actorMembershipId,
    reason: input.comment ?? null,
    metadata: {
      action: input.action,
      pendingTransitionId: pending.id,
    },
  });

  await updateCourseStatusForWorkflow({
    tx,
    courseId: pending.targetId,
    status: nextStatus,
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
      action: "workflow.transition",
      target: { type: "course", id: pending.targetId },
      before: { status: course.status, workflowTransitionId: pending.id },
      after: { status: nextStatus, workflowTransitionId: transition.id, action: input.action },
      reason: input.comment ?? null,
      metadata: {
        targetType: pending.targetType,
        workflowDefinitionId: pending.workflowDefinitionId,
        fromState: "REVIEW",
        toState: nextStatus,
      },
    },
  );

  await outbox.publish(tx, {
    ctx: {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      requestId: ctx.requestId,
    },
    eventType: "workflow.transitioned",
    aggregateType: "workflow_transition",
    aggregateId: transition.id,
    payload: {
      workflowTransitionId: transition.id,
      pendingTransitionId: pending.id,
      targetType: pending.targetType,
      targetId: pending.targetId,
      action: input.action,
      fromState: "REVIEW",
      toState: nextStatus,
    },
    idempotencyKey: `${ctx.requestId}:workflow.transitioned:${transition.id}`,
  });

  if (input.action === "approve") {
    await outbox.publish(tx, {
      ctx: {
        tenantId: ctx.tenantId,
        actorMembershipId: ctx.actorMembershipId,
        requestId: ctx.requestId,
      },
      eventType: "course.published",
      aggregateType: "course",
      aggregateId: pending.targetId,
      payload: {
        courseId: pending.targetId,
        publishedAt: new Date().toISOString(),
        workflowTransitionId: transition.id,
      },
      idempotencyKey: `${ctx.requestId}:course.published:${pending.targetId}`,
    });
  }

  return {
    data: {
      id: transition.id,
      workflowDefinitionId: pending.workflowDefinitionId,
      targetType: "course" as const,
      targetId: pending.targetId,
      action: input.action,
      fromState: "REVIEW",
      toState: nextStatus,
      targetStatus: nextStatus,
      occurredAt: new Date().toISOString(),
      comment: input.comment ?? null,
    },
  };
}

async function actOnAssessmentWorkflow(
  tx: TenantTx,
  ctx: ServiceCtx,
  pending: NonNullable<Awaited<ReturnType<typeof findWorkflowTransitionById>>>,
  input: WorkflowTransitionBody,
) {
  const assessment = await findAssessmentForWorkflow({
    tx,
    assessmentId: pending.targetId,
  });

  if (!assessment) {
    throw workflowItemNotFound();
  }

  assertPublishTargetInReview(assessment.status);

  const nextStatus: PublishLifecycleStatus = input.action === "approve" ? "PUBLISHED" : "DRAFT";
  assertPublishReviewTransition(nextStatus);

  const transition = await appendWorkflowTransition({
    tx,
    tenantId: ctx.tenantId,
    workflowDefinitionId: pending.workflowDefinitionId,
    targetType: pending.targetType,
    targetId: pending.targetId,
    fromState: "REVIEW",
    toState: nextStatus,
    actorMembershipId: ctx.actorMembershipId,
    reason: input.comment ?? null,
    metadata: {
      action: input.action,
      pendingTransitionId: pending.id,
    },
  });

  await updateAssessmentStatusForWorkflow({
    tx,
    assessmentId: pending.targetId,
    status: nextStatus,
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
      action: "workflow.transition",
      target: { type: "assessment", id: pending.targetId },
      before: { status: assessment.status, workflowTransitionId: pending.id },
      after: { status: nextStatus, workflowTransitionId: transition.id, action: input.action },
      reason: input.comment ?? null,
      metadata: {
        targetType: pending.targetType,
        workflowDefinitionId: pending.workflowDefinitionId,
        fromState: "REVIEW",
        toState: nextStatus,
      },
    },
  );

  await outbox.publish(tx, {
    ctx: {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      requestId: ctx.requestId,
    },
    eventType: "workflow.transitioned",
    aggregateType: "workflow_transition",
    aggregateId: transition.id,
    payload: {
      workflowTransitionId: transition.id,
      pendingTransitionId: pending.id,
      targetType: pending.targetType,
      targetId: pending.targetId,
      action: input.action,
      fromState: "REVIEW",
      toState: nextStatus,
    },
    idempotencyKey: `${ctx.requestId}:workflow.transitioned:${transition.id}`,
  });

  return {
    data: {
      id: transition.id,
      workflowDefinitionId: pending.workflowDefinitionId,
      targetType: "assessment" as const,
      targetId: pending.targetId,
      action: input.action,
      fromState: "REVIEW",
      toState: nextStatus,
      targetStatus: nextStatus,
      occurredAt: new Date().toISOString(),
      comment: input.comment ?? null,
    },
  };
}

async function actOnLearningPathWorkflow(
  tx: TenantTx,
  ctx: ServiceCtx,
  pending: NonNullable<Awaited<ReturnType<typeof findWorkflowTransitionById>>>,
  input: WorkflowTransitionBody,
) {
  const path = await findLearningPathForWorkflow({
    tx,
    pathId: pending.targetId,
  });

  if (!path) {
    throw workflowItemNotFound();
  }

  assertPublishTargetInReview(path.status);

  const nextStatus: PublishLifecycleStatus = input.action === "approve" ? "PUBLISHED" : "DRAFT";
  assertPublishReviewTransition(nextStatus);

  const transition = await appendWorkflowTransition({
    tx,
    tenantId: ctx.tenantId,
    workflowDefinitionId: pending.workflowDefinitionId,
    targetType: pending.targetType,
    targetId: pending.targetId,
    fromState: "REVIEW",
    toState: nextStatus,
    actorMembershipId: ctx.actorMembershipId,
    reason: input.comment ?? null,
    metadata: {
      action: input.action,
      pendingTransitionId: pending.id,
    },
  });

  await updateLearningPathStatusForWorkflow({
    tx,
    pathId: pending.targetId,
    status: nextStatus,
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
      action: "workflow.transition",
      target: { type: "learning_path", id: pending.targetId },
      before: { status: path.status, workflowTransitionId: pending.id },
      after: { status: nextStatus, workflowTransitionId: transition.id, action: input.action },
      reason: input.comment ?? null,
      metadata: {
        targetType: pending.targetType,
        workflowDefinitionId: pending.workflowDefinitionId,
        fromState: "REVIEW",
        toState: nextStatus,
      },
    },
  );

  await outbox.publish(tx, {
    ctx: {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      requestId: ctx.requestId,
    },
    eventType: "workflow.transitioned",
    aggregateType: "workflow_transition",
    aggregateId: transition.id,
    payload: {
      workflowTransitionId: transition.id,
      pendingTransitionId: pending.id,
      targetType: pending.targetType,
      targetId: pending.targetId,
      action: input.action,
      fromState: "REVIEW",
      toState: nextStatus,
    },
    idempotencyKey: `${ctx.requestId}:workflow.transitioned:${transition.id}`,
  });

  return {
    data: {
      id: transition.id,
      workflowDefinitionId: pending.workflowDefinitionId,
      targetType: "learning_path" as const,
      targetId: pending.targetId,
      action: input.action,
      fromState: "REVIEW",
      toState: nextStatus,
      targetStatus: nextStatus,
      occurredAt: new Date().toISOString(),
      comment: input.comment ?? null,
    },
  };
}

export async function actOnWorkflowTransition(
  tx: TenantTx,
  ctx: ServiceCtx,
  workflowId: string,
  input: WorkflowTransitionBody,
) {
  const pending = await findWorkflowTransitionById({
    tx,
    transitionId: workflowId,
  });

  if (!pending) {
    throw workflowItemNotFound();
  }

  if (
    pending.targetType !== "course" &&
    pending.targetType !== "assessment" &&
    pending.targetType !== "learning_path"
  ) {
    throw workflowItemNotFound();
  }

  if (pending.toState !== "REVIEW" || pending.fromState !== "DRAFT") {
    throw workflowTransitionConflict("This workflow item is no longer pending review.");
  }

  const laterExists = await hasLaterTransitionForTarget({
    tx,
    targetType: pending.targetType,
    targetId: pending.targetId,
    pendingTransitionId: pending.id,
  });

  if (laterExists) {
    const idempotent = await resolveIdempotentWorkflowAction(tx, pending, input);
    if (idempotent) {
      return idempotent;
    }
    throw workflowTransitionConflict("This workflow transition has already been acted on.");
  }

  if (pending.targetType === "course") {
    const course = await findCourseForWorkflow({ tx, courseId: pending.targetId });
    if (!course || course.status !== "REVIEW") {
      throw workflowTransitionConflict("Course is no longer in review state.");
    }
    return actOnCourseWorkflow(tx, ctx, pending, input);
  }

  if (pending.targetType === "assessment") {
    const assessment = await findAssessmentForWorkflow({ tx, assessmentId: pending.targetId });
    if (!assessment || assessment.status !== "REVIEW") {
      throw workflowTransitionConflict("Assessment is no longer in review state.");
    }
    return actOnAssessmentWorkflow(tx, ctx, pending, input);
  }

  const path = await findLearningPathForWorkflow({ tx, pathId: pending.targetId });
  if (!path || path.status !== "REVIEW") {
    throw workflowTransitionConflict("Learning path is no longer in review state.");
  }
  return actOnLearningPathWorkflow(tx, ctx, pending, input);
}

export async function getWorkflowHistory(tx: TenantTx, targetType: string, targetId: string) {
  const rows = await listWorkflowHistoryForTarget({
    tx,
    targetType,
    targetId,
  });

  return {
    data: {
      items: rows.map((row) => ({
        id: row.id,
        fromState: row.fromState,
        toState: row.toState,
        actorMembershipId: row.actorMembershipId,
        reason: row.reason,
        occurredAt: row.occurredAt.toISOString(),
        action: deriveTransitionAction(row.fromState, row.toState, row.metadataJson),
      })),
    },
  };
}

function mapWorkflowDefinition(row: {
  id: string;
  key: string;
  name: string;
  definition_json: Record<string, unknown>;
  status: "ACTIVE" | "ARCHIVED" | "DRAFT";
  updated_at: Date;
}) {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    definitionJson: row.definition_json,
    status: row.status,
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function listWorkflowDefinitions(tx: TenantTx) {
  const rows = await listWorkflowDefinitionsRepo(tx);
  return { data: rows.map(mapWorkflowDefinition) };
}

export async function createWorkflowDefinitionRecord(
  tx: TenantTx,
  ctx: ServiceCtx,
  input: { key: string; name: string; definitionJson: Record<string, unknown> },
) {
  const row = await createWorkflowDefinitionRepo({
    tx,
    key: input.key,
    name: input.name,
    definitionJson: input.definitionJson,
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
      action: "workflow.definition.created",
      target: { type: "workflow_definition", id: row.id },
      before: null,
      after: { key: row.key, name: row.name },
      reason: null,
      metadata: {},
    },
  );

  return { data: mapWorkflowDefinition(row) };
}

export async function updateWorkflowDefinitionRecord(
  tx: TenantTx,
  ctx: ServiceCtx,
  id: string,
  input: {
    name?: string;
    definitionJson?: Record<string, unknown>;
    status?: "ACTIVE" | "ARCHIVED" | "DRAFT";
  },
) {
  const beforeRows = await listWorkflowDefinitionsRepo(tx);
  const before = beforeRows.find((row) => row.id === id) ?? null;

  const row = await updateWorkflowDefinitionRepo({
    tx,
    id,
    ...input,
  });

  if (!row) {
    throw workflowItemNotFound();
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
      action: "workflow.definition.updated",
      target: { type: "workflow_definition", id: row.id },
      before: before ? { key: before.key, name: before.name, status: before.status } : null,
      after: { key: row.key, name: row.name, status: row.status },
      reason: null,
      metadata: {},
    },
  );

  return { data: mapWorkflowDefinition(row) };
}
