import type { TenantTx } from "@atlas/db";
import { auditWriter } from "@atlas/audit";
import { outbox } from "@atlas/events";
import { findRolePermissionGrant } from "@atlas/authorization";
import {
  AssessmentConfigSchema,
  type CreateAssessmentInput,
  type ListAssessmentsQuery,
  type UpdateAssessmentInput,
} from "../../features/assessments/schemas";
import {
  assertAssessmentEditable,
  assertAssessmentPublishable,
  validateAssessmentItemPositions,
  validateUniqueItemIds,
  type AssessmentLifecycleStatus,
} from "./assessment-state-guards";
import {
  assessmentItemConflict,
  assessmentNotFound,
  assessmentNotEditable,
  assessmentPublishConflict,
  assessmentSlugConflict,
  assessmentWorkflowNotConfigured,
} from "./assessments.errors";
import {
  assessmentsRepository,
  buildAssessmentConfigJson,
  extractAssessmentConfig,
  readCreatedByMembershipId,
  readDescription,
  readItemRequired,
} from "./assessments.repository";
import {
  decodeExplanationJson,
  itemRegistryRepository,
} from "../item-registry/item-registry.repository";

type ServiceCtx = {
  tenantId: string;
  actorMembershipId: string;
  requestId: string;
};

function pageFrom<T extends { id: string }>(rows: T[], limit: number) {
  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, limit) : rows;

  return {
    data,
    page: {
      hasMore,
      nextCursor: hasMore ? (data[data.length - 1]?.id ?? null) : null,
    },
  };
}

function mapAssessmentSummary(row: {
  id: string;
  slug: string;
  title: string;
  assessment_type: string;
  status: string;
  config_json: unknown;
  created_at: Date;
  updated_at: Date;
}) {
  const config = extractAssessmentConfig(row.config_json);

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: readDescription(row.config_json),
    assessmentType: row.assessment_type as CreateAssessmentInput["assessmentType"],
    status: row.status as AssessmentLifecycleStatus,
    config: {
      attemptsAllowed: config.attemptsAllowed,
      timeLimitSeconds: config.timeLimitSeconds ?? null,
      passMarkPercent: config.passMarkPercent,
      shuffleItems: config.shuffleItems,
      shuffleOptions: config.shuffleOptions,
      secureMode: config.secureMode,
      proctoringLevel: config.proctoringLevel,
      l1ProctoringEnabled: config.l1ProctoringEnabled,
      showAnswersPolicy: config.showAnswersPolicy,
    },
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

async function isAdminBypass(tx: TenantTx, ctx: ServiceCtx): Promise<boolean> {
  const grant = await findRolePermissionGrant({
    tx,
    tenantId: ctx.tenantId,
    membershipId: ctx.actorMembershipId,
    permissionKey: "assessment.read",
  });

  const roleKeys = grant?.roleKeys ?? [];
  return roleKeys.includes("owner") || roleKeys.includes("admin");
}

async function requireOwnedAssessment(tx: TenantTx, ctx: ServiceCtx, assessmentId: string) {
  const assessment = await assessmentsRepository.findById(tx, assessmentId);

  if (!assessment || assessment.tenant_id !== ctx.tenantId) {
    throw assessmentNotFound();
  }

  const owner = readCreatedByMembershipId(assessment.config_json);
  if (owner !== ctx.actorMembershipId) {
    throw assessmentNotFound();
  }

  return assessment;
}

async function hydrateAssessmentItems(
  tx: TenantTx,
  assessmentId: string,
  includeAnswerKeys: boolean,
) {
  const rows = await assessmentsRepository.listAssessmentItems(tx, assessmentId);
  const items = [];

  for (const row of rows) {
    const item = await itemRegistryRepository.findItemById(tx, row.item_id);
    if (!item) {
      continue;
    }

    const options = await itemRegistryRepository.listItemOptions(tx, row.item_id);
    const decoded = decodeExplanationJson(item.explanation_json);

    items.push({
      id: row.id,
      itemId: row.item_id,
      position: row.position,
      points: Number(row.points),
      required: readItemRequired(row.config_json),
      itemTypeKey: item.item_type_key,
      contentJson: item.stem_json as Record<string, unknown>,
      ...(includeAnswerKeys
        ? {
            answerKeyJson: decoded.answerKeyJson,
            options: options.map((option) => ({
              id: option.id,
              optionJson: option.option_json as Record<string, unknown>,
              isCorrect: option.is_correct ?? null,
              position: option.position,
            })),
          }
        : {
            options: options.map((option) => ({
              id: option.id,
              optionJson: option.option_json as Record<string, unknown>,
              position: option.position,
            })),
          }),
    });
  }

  return items;
}

export async function listAssessments(tx: TenantTx, ctx: ServiceCtx, query: ListAssessmentsQuery) {
  const admin = await isAdminBypass(tx, ctx);
  const learnerOnly = !admin;

  const rows = await assessmentsRepository.listAssessments(tx, {
    limit: query.limit,
    ...(query.cursor != null ? { cursor: query.cursor } : {}),
    ...(query.type != null ? { assessmentType: query.type } : {}),
    ...(query.status != null ? { status: query.status } : {}),
    ...(query.q != null ? { q: query.q } : {}),
    ...(admin
      ? {}
      : learnerOnly
        ? { publishedOnly: true }
        : { ownerMembershipId: ctx.actorMembershipId }),
  });

  const paged = pageFrom(rows, query.limit);

  return {
    data: paged.data.map(mapAssessmentSummary),
    page: paged.page,
  };
}

export async function createAssessment(
  tx: TenantTx,
  ctx: ServiceCtx,
  input: CreateAssessmentInput,
) {
  const configJson = buildAssessmentConfigJson({
    createdByMembershipId: ctx.actorMembershipId,
    description: input.description ?? null,
    config: input.config,
  });

  let created;
  try {
    created = await assessmentsRepository.insertAssessment(tx, {
      tenantId: ctx.tenantId,
      title: input.title,
      assessmentType: input.assessmentType,
      configJson,
    });
  } catch {
    throw assessmentSlugConflict();
  }

  return {
    data: {
      ...mapAssessmentSummary(created),
      items: [],
    },
  };
}

export async function getAssessment(
  tx: TenantTx,
  ctx: ServiceCtx,
  assessmentId: string,
  options?: { learnerView?: boolean },
) {
  const assessment = await assessmentsRepository.findById(tx, assessmentId);

  if (!assessment || assessment.tenant_id !== ctx.tenantId) {
    throw assessmentNotFound();
  }

  const owner = readCreatedByMembershipId(assessment.config_json);
  const admin = await isAdminBypass(tx, ctx);
  const isOwner = owner === ctx.actorMembershipId;

  if (options?.learnerView || (!admin && !isOwner)) {
    if (assessment.status !== "PUBLISHED") {
      throw assessmentNotFound();
    }
  }

  const includeAnswerKeys = isOwner || admin;

  return {
    data: {
      ...mapAssessmentSummary(assessment),
      items: await hydrateAssessmentItems(tx, assessmentId, includeAnswerKeys),
    },
  };
}

export async function getLearnerAssessmentOverview(
  tx: TenantTx,
  ctx: ServiceCtx,
  assessmentId: string,
) {
  const assessment = await assessmentsRepository.findById(tx, assessmentId);

  if (!assessment || assessment.tenant_id !== ctx.tenantId || assessment.status !== "PUBLISHED") {
    throw assessmentNotFound();
  }

  const config = extractAssessmentConfig(assessment.config_json);
  const attemptsUsed = await tx.attempt.count({
    where: {
      assessment_id: assessmentId,
      membership_id: ctx.actorMembershipId,
      status: { notIn: ["ABANDONED", "VOIDED"] },
    },
  });

  const itemCount = await assessmentsRepository.countAssessmentItems(tx, assessmentId);
  const attemptsRemaining =
    config.attemptsAllowed > attemptsUsed ? config.attemptsAllowed - attemptsUsed : 0;

  return {
    data: {
      id: assessment.id,
      title: assessment.title,
      description: readDescription(assessment.config_json),
      assessmentType: assessment.assessment_type as CreateAssessmentInput["assessmentType"],
      status: assessment.status as AssessmentLifecycleStatus,
      config: {
        attemptsAllowed: config.attemptsAllowed,
        timeLimitSeconds: config.timeLimitSeconds ?? null,
        passMarkPercent: config.passMarkPercent,
        shuffleItems: config.shuffleItems,
        shuffleOptions: config.shuffleOptions,
        secureMode: config.secureMode,
        proctoringLevel: config.proctoringLevel,
        l1ProctoringEnabled: config.l1ProctoringEnabled,
        showAnswersPolicy: config.showAnswersPolicy,
      },
      itemCount,
      attemptsUsed,
      attemptsRemaining,
    },
  };
}

export async function updateAssessment(
  tx: TenantTx,
  ctx: ServiceCtx,
  assessmentId: string,
  input: UpdateAssessmentInput,
) {
  const assessment = await requireOwnedAssessment(tx, ctx, assessmentId);
  assertAssessmentEditable(assessment.status as AssessmentLifecycleStatus);

  if (input.items) {
    validateAssessmentItemPositions(input.items.map((item) => item.position));
    validateUniqueItemIds(input.items.map((item) => item.itemId));

    for (const item of input.items) {
      const exists = await assessmentsRepository.itemExistsInTenant(tx, item.itemId);
      if (!exists) {
        throw assessmentItemConflict("One or more items do not exist in this tenant.");
      }
    }

    await assessmentsRepository.replaceAssessmentItems(tx, {
      tenantId: ctx.tenantId,
      assessmentId,
      items: input.items.map((item) => ({
        itemId: item.itemId,
        position: item.position,
        points: item.points,
        required: item.required,
      })),
    });
  }

  const currentConfig = extractAssessmentConfig(assessment.config_json);
  const mergedConfig = input.config ? { ...currentConfig, ...input.config } : currentConfig;
  const nextConfig = AssessmentConfigSchema.parse(mergedConfig);
  const currentDescription = readDescription(assessment.config_json);
  const nextDescription = input.description !== undefined ? input.description : currentDescription;

  const updated = await assessmentsRepository.updateAssessment(tx, {
    assessmentId,
    ...(input.title != null ? { title: input.title } : {}),
    ...(input.assessmentType != null ? { assessmentType: input.assessmentType } : {}),
    configJson: buildAssessmentConfigJson({
      createdByMembershipId: ctx.actorMembershipId,
      description: nextDescription,
      config: nextConfig,
    }),
  });

  if (!updated) {
    throw assessmentNotFound();
  }

  return {
    data: {
      ...mapAssessmentSummary(updated),
      items: await hydrateAssessmentItems(tx, assessmentId, true),
    },
  };
}

export async function deleteAssessment(tx: TenantTx, ctx: ServiceCtx, assessmentId: string) {
  const assessment = await requireOwnedAssessment(tx, ctx, assessmentId);

  const deleted = await assessmentsRepository.softDelete(tx, assessmentId);
  if (!deleted) {
    throw assessmentNotFound();
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
      action: "assessment.deleted",
      target: { type: "assessment", id: assessmentId },
      before: {
        id: assessment.id,
        title: assessment.title,
        status: assessment.status,
      },
      after: null,
      reason: null,
      metadata: {},
    },
  );

  return {
    data: {
      id: assessmentId,
      deleted: true as const,
    },
  };
}

export async function submitAssessmentForReview(
  tx: TenantTx,
  ctx: ServiceCtx,
  assessmentId: string,
  input: { reason?: string },
) {
  const assessment = await requireOwnedAssessment(tx, ctx, assessmentId);
  assertAssessmentPublishable(assessment.status as AssessmentLifecycleStatus);

  const itemCount = await assessmentsRepository.countAssessmentItems(tx, assessmentId);
  if (itemCount < 1) {
    throw assessmentPublishConflict("Assessment must contain at least one item before review.");
  }

  const workflow = await assessmentsRepository.findWorkflowDefinitionByKey(
    tx,
    "assessment.publish",
  );
  if (!workflow) {
    throw assessmentWorkflowNotConfigured();
  }

  const transition = await assessmentsRepository.insertWorkflowTransition(tx, {
    tenantId: ctx.tenantId,
    workflowDefinitionId: workflow.id,
    targetType: "assessment",
    targetId: assessmentId,
    fromState: "DRAFT",
    toState: "REVIEW",
    actorMembershipId: ctx.actorMembershipId,
    reason: input.reason ?? null,
    metadata: { action: "submit" },
  });

  await assessmentsRepository.updateStatus(tx, assessmentId, "REVIEW");

  await auditWriter.write(
    tx,
    {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      platformPrincipalId: null,
      requestId: ctx.requestId,
    },
    {
      action: "assessment.submitted_for_review",
      target: { type: "assessment", id: assessmentId },
      before: { status: assessment.status },
      after: { status: "REVIEW", workflowTransitionId: transition.id },
      reason: input.reason ?? null,
      metadata: { workflowDefinitionId: workflow.id },
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
      targetType: "assessment",
      targetId: assessmentId,
      action: "submit",
      fromState: "DRAFT",
      toState: "REVIEW",
    },
    idempotencyKey: `${ctx.requestId}:workflow.transitioned:${transition.id}`,
  });

  return {
    data: {
      id: assessmentId,
      status: "REVIEW" as const,
      submittedAt: new Date().toISOString(),
      workflowTransitionId: transition.id,
    },
  };
}

export async function publishAssessmentForTests(tx: TenantTx, assessmentId: string): Promise<void> {
  await assessmentsRepository.updateStatus(tx, assessmentId, "PUBLISHED");
}

export { assessmentNotEditable };
